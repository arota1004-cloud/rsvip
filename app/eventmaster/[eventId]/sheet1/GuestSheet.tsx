'use client'

import '@fortune-sheet/react/dist/index.css'
import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Sheet, CellWithRowAndCol, SheetConfig } from '@fortune-sheet/core'
import type { Column, GuestRow } from './actions'
import { saveColumns, upsertGuests } from './actions'
import ColumnManagerPanel from './ColumnManagerPanel'
import FileUploadModal from './FileUploadModal'

// FortuneSheet는 Canvas 기반 → SSR 불가
const Workbook = dynamic(
  () => import('@fortune-sheet/react').then(m => ({ default: m.Workbook })),
  { ssr: false, loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 13, color: '#8B6A5A' }}>
      불러오는 중...
    </div>
  ) }
)

type SaveStatus = 'saved' | 'saving' | 'error'

type Props = {
  eventId: string
  initialColumns: Column[]
  initialRows: GuestRow[]
  readOnly?: boolean
  onSaveStatusChange: (s: SaveStatus, savedAt?: string) => void
  onAlert: (msg: string, type?: 'warn' | 'error' | 'info') => void
}

// ─── 색상 ─────────────────────────────────────────────────────────────────────
const RSVP_STYLES: Record<string, { bg: string; fc: string }> = {
  Y: { bg: 'rgba(34,197,94,0.15)',   fc: '#15803d' },
  N: { bg: 'rgba(239,68,68,0.12)',   fc: '#dc2626' },
  U: { bg: 'rgba(107,114,128,0.12)', fc: '#6b7280' },
}
const HEADER_BG = '#F0EBE1'
const HEADER_FC = '#3D1A2E'
const DEFAULT_ROW_COUNT = 100

// ─── DB → FortuneSheet 변환 ───────────────────────────────────────────────────
function buildCelldata(columns: Column[], rows: GuestRow[]): CellWithRowAndCol[] {
  const cells: CellWithRowAndCol[] = []

  // Row 0: 헤더
  columns.forEach((col, ci) => {
    cells.push({
      r: 0, c: ci,
      v: { v: col.name, m: col.name, bl: 1, bg: HEADER_BG, fc: HEADER_FC, fs: 11 },
    })
  })

  // Row 1+: 데이터
  rows.forEach((row, ri) => {
    columns.forEach((col, ci) => {
      const v = row.data[col.id] ?? ''
      if (v === '') return
      const rs = col.type === 'survey' ? RSVP_STYLES[v] : null
      cells.push({
        r: ri + 1, c: ci,
        v: { v, m: String(v), ...(rs ? { bg: rs.bg, fc: rs.fc, bl: 1 } : {}) },
      })
    })
  })

  return cells
}

function buildConfig(columns: Column[]): SheetConfig {
  const columnlen: Record<string, number> = {}
  columns.forEach((col, ci) => { columnlen[ci] = col.width })
  return { columnlen, rowlen: { 0: 28 } }
}

function buildDataVerification(columns: Column[], rowCount: number): Record<string, unknown> {
  const dv: Record<string, unknown> = {}
  columns.forEach((col, ci) => {
    const opts =
      col.type === 'survey' ? 'Y,N,U'
      : col.type === 'dropdown' && col.options?.length ? col.options.join(',')
      : null
    if (!opts) return
    for (let ri = 1; ri <= rowCount; ri++) {
      dv[`${ri}_${ci}`] = { type: 'dropdown', value1: opts, prohibitInput: 0, hintShow: 0 }
    }
  })
  return dv
}

function makeSheet(columns: Column[], rows: GuestRow[]): Sheet {
  const totalRows = Math.max(rows.length, DEFAULT_ROW_COUNT)
  return {
    name: '게스트 목록',
    id: 'guest_sheet',
    celldata: buildCelldata(columns, rows),
    config: buildConfig(columns),
    dataVerification: buildDataVerification(columns, totalRows),
    frozen: { type: 'row', range: { row_focus: 0, column_focus: 0 } },
    row: totalRows + 5,
    column: Math.max(columns.length + 2, 12),
    defaultRowHeight: 24,
  }
}

// 셀 우클릭 메뉴 — 한국어 불가(영문 only) 항목만 최소 노출
const CELL_CONTEXT_MENU = ['copy', 'paste', 'clear', 'insert-row', 'delete-row']

// ─── FortuneSheet → DB 변환 ───────────────────────────────────────────────────
function extractRows(
  sheetData: Sheet,
  columns: Column[],
  rowIdMap: Map<number, string>,
): { rows: GuestRow[]; newMap: Map<number, string> } {
  const matrix: (({ v?: unknown } | null))[][] = sheetData.data ?? []
  const rows: GuestRow[] = []
  const newMap = new Map<number, string>()

  for (let ri = 1; ri < matrix.length; ri++) {
    const rowArr = matrix[ri]
    if (!rowArr) continue
    const rowData: Record<string, string> = {}
    columns.forEach((col, ci) => {
      const cell = rowArr[ci]
      const v = cell?.v != null ? String(cell.v) : ''
      if (v) rowData[col.id] = v
    })
    const id = rowIdMap.get(ri) ?? crypto.randomUUID()
    newMap.set(ri, id)
    rows.push({ id, row_index: ri - 1, data: rowData })
  }
  return { rows, newMap }
}

function nowStr() {
  const d = new Date()
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function GuestSheet({ eventId, initialColumns, initialRows, readOnly = false, onSaveStatusChange, onAlert }: Props) {
  const [columns, setColumns]       = useState<Column[]>(initialColumns)
  const [showUpload, setShowUpload] = useState(false)

  // FortuneSheet 재마운트 제어 (선택지 적용 시 dataVerification 갱신)
  const [remountKey, setRemountKey]           = useState(0)
  const [activeSheetData, setActiveSheetData] = useState<Sheet[]>(() => [makeSheet(initialColumns, initialRows)])

  // ── 우측 컬럼 설정 dock ──────────────────────────────────────────────────────
  const [dockOpen, setDockOpen]         = useState(false)
  const [activeDockCol, setActiveDockCol] = useState(0)
  // ref: hook 클로저에서 항상 최신 상태를 읽기 위해
  const dockOpenRef = useRef(false)
  useEffect(() => { dockOpenRef.current = dockOpen }, [dockOpen])

  const workbookRef   = useRef<any>(null)
  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedColRef = useRef<number>(0)
  const columnsRef    = useRef<Column[]>(initialColumns)
  const rowIdMap      = useRef<Map<number, string>>(
    new Map(initialRows.map((r, i) => [i + 1, r.id]))
  )

  // columns 변경 시 ref 동기화
  useEffect(() => { columnsRef.current = columns }, [columns])

  // ─ 자동저장 (2초 디바운스) ───────────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    onSaveStatusChange('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const currentSheets: Sheet[] | undefined = workbookRef.current?.getAllSheets?.()
        const sheet = currentSheets?.[0]
        if (!sheet) return

        const { rows, newMap } = extractRows(sheet, columnsRef.current, rowIdMap.current)
        rowIdMap.current = newMap

        await upsertGuests(eventId, rows)
        await saveColumns(eventId, columnsRef.current)

        onSaveStatusChange('saved', nowStr())
      } catch {
        onSaveStatusChange('error')
      }
    }, 2000)
  }, [eventId, onSaveStatusChange])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // ─ 중복 감지 ─────────────────────────────────────────────────────────────────
  const checkDuplicates = useCallback((sheet: Sheet) => {
    const matrix = sheet.data ?? []
    const cols = columnsRef.current
    const emailIdx = cols.findIndex(c => c.name === '이메일')
    const phoneIdx = cols.findIndex(c => c.name === '연락처')
    if (emailIdx < 0 && phoneIdx < 0) return

    const seen = new Map<string, number>()
    for (let ri = 1; ri < matrix.length; ri++) {
      const row = matrix[ri]
      if (!row) continue
      const email = emailIdx >= 0 ? (String(row[emailIdx]?.v ?? '')) : ''
      const phone = phoneIdx >= 0 ? (String(row[phoneIdx]?.v ?? '')) : ''
      if (!email && !phone) continue

      const key = `${email}__${phone}`
      if (seen.has(key)) {
        const prev = seen.get(key)!
        const field = email ? '이메일' : '연락처'
        onAlert(`${prev + 1}행 / ${ri + 1}행 ${field} 중복 감지 — 확인 후 수정해주세요`, 'warn')
      }
      seen.set(key, ri)
    }
  }, [onAlert])

  // ─ FortuneSheet 변경 콜백 ────────────────────────────────────────────────────
  const handleChange = useCallback((data: Sheet[]) => {
    scheduleSave()
    if (data[0]) checkDuplicates(data[0])
  }, [scheduleSave, checkDuplicates])

  // ─ 컬럼 관리 패널에서 업데이트 ───────────────────────────────────────────────
  const handleColUpdate = useCallback((idx: number, patch: Partial<Column>) => {
    setColumns(prev => {
      const next = prev.map((c, i) => i === idx ? { ...c, ...patch } : c)
      columnsRef.current = next
      // 헤더 이름 변경 시 FortuneSheet 셀도 업데이트
      if (patch.name !== undefined) {
        workbookRef.current?.setCellValue?.(0, idx, patch.name, { id: 'guest_sheet' })
      }
      scheduleSave()
      return next
    })
  }, [scheduleSave])

  const handleColDelete = useCallback((idx: number) => {
    workbookRef.current?.deleteRowOrColumn?.('column', idx, idx, { id: 'guest_sheet' })
    setColumns(prev => {
      const next = prev.filter((_, i) => i !== idx)
      columnsRef.current = next
      // 삭제 후 dock이 열려 있으면 인접 컬럼으로 이동
      if (next.length === 0) {
        setDockOpen(false)
        dockOpenRef.current = false
      } else {
        setActiveDockCol(Math.min(idx, next.length - 1))
      }
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  // ─ 파일 가져오기 ─────────────────────────────────────────────────────────────
  const handleImport = useCallback((newRows: GuestRow[]) => {
    if (!workbookRef.current) return
    const wb = workbookRef.current
    const cols = columnsRef.current

    // 현재 마지막 데이터 행 다음부터 삽입
    const currentSheets: Sheet[] | undefined = wb.getAllSheets?.()
    const matrix = currentSheets?.[0]?.data ?? []
    let lastRow = 1
    for (let ri = matrix.length - 1; ri >= 1; ri--) {
      if (matrix[ri]?.some((c: any) => c?.v != null && c.v !== '')) { lastRow = ri + 1; break }
    }

    newRows.forEach((row, ri) => {
      const insertRow = lastRow + ri
      cols.forEach((col, ci) => {
        const v = row.data[col.id] ?? ''
        if (v) {
          const rs = col.type === 'survey' ? RSVP_STYLES[v] : null
          wb.setCellValue?.(insertRow, ci, v, { id: 'guest_sheet' })
          if (rs) {
            wb.setCellFormat?.(insertRow, ci, 'bg', rs.bg, { id: 'guest_sheet' })
            wb.setCellFormat?.(insertRow, ci, 'fc', rs.fc, { id: 'guest_sheet' })
          }
        }
      })
      rowIdMap.current.set(insertRow, row.id)
    })

    setShowUpload(false)
    onAlert(`${newRows.length}행을 가져왔습니다.`, 'info')
    scheduleSave()
  }, [onAlert, scheduleSave])

  // ─ 선택지 적용: 현재 데이터 추출 → 새 dataVerification으로 FortuneSheet 재마운트 ─
  const handleSaveOptions = useCallback(async () => {
    const currentSheets: Sheet[] | undefined = workbookRef.current?.getAllSheets?.()
    const sheet = currentSheets?.[0]

    // FortuneSheet 현재 데이터 추출
    const { rows: currentRows, newMap } = sheet
      ? extractRows(sheet, columnsRef.current, rowIdMap.current)
      : { rows: [], newMap: new Map<number, string>() }
    if (sheet) rowIdMap.current = newMap

    // 업데이트된 컬럼(options 포함)으로 시트 재빌드 → 재마운트
    const newSheet = makeSheet(columnsRef.current, currentRows)
    setActiveSheetData([newSheet])
    setRemountKey(k => k + 1)

    // 즉시 DB 저장
    onSaveStatusChange('saving')
    try {
      await Promise.all([
        currentRows.length > 0 ? upsertGuests(eventId, currentRows) : Promise.resolve(),
        saveColumns(eventId, columnsRef.current),
      ])
      onSaveStatusChange('saved', nowStr())
    } catch {
      onSaveStatusChange('error')
    }
  }, [eventId, onSaveStatusChange])

  // ─ 수동 저장 버튼 ────────────────────────────────────────────────────────────
  const handleManualSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    onSaveStatusChange('saving')
    try {
      const currentSheets: Sheet[] | undefined = workbookRef.current?.getAllSheets?.()
      const sheet = currentSheets?.[0]
      if (sheet) {
        const { rows, newMap } = extractRows(sheet, columnsRef.current, rowIdMap.current)
        rowIdMap.current = newMap
        await upsertGuests(eventId, rows)
      }
      await saveColumns(eventId, columnsRef.current)
      onSaveStatusChange('saved', nowStr())
    } catch {
      onSaveStatusChange('error')
    }
  }, [eventId, onSaveStatusChange])

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 툴바 */}
      <div style={{
        height: 38, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 4,
        borderBottom: '1px solid rgba(61,26,46,0.1)', backgroundColor: '#fff', flexShrink: 0,
      }}>
        {readOnly ? (
          <span style={{
            fontSize: 11, color: '#8B6A5A', padding: '3px 10px',
            borderRadius: 6, backgroundColor: 'rgba(61,26,46,0.06)',
            border: '1px solid rgba(61,26,46,0.12)',
          }}>
            🔒 읽기 전용 — 편집 권한이 없습니다
          </span>
        ) : (
          <>
            <ToolBtn label="📂 파일 가져오기" onClick={() => setShowUpload(true)} />
            <div style={{ flex: 1 }} />
            {/* 수동 저장 버튼 — 즉시 저장 후 TopDock에 "저장됨 · HH:mm" 표시 */}
            <ToolBtn label="💾 저장" onClick={handleManualSave} primary />
            <div style={{ width: 6 }} />
            <ToolBtn
              label={dockOpen ? '⚙ 컬럼 설정 닫기' : '⚙ 컬럼 설정'}
              active={dockOpen}
              onClick={() => {
                const next = !dockOpen
                if (next) setActiveDockCol(Math.min(selectedColRef.current, Math.max(0, columnsRef.current.length - 1)))
                setDockOpen(next)
                dockOpenRef.current = next
              }}
            />
          </>
        )}
      </div>

      {/* FortuneSheet 워크북 — key 변경 시 재마운트 (dataVerification 갱신) */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Workbook
          key={remountKey}
          ref={workbookRef}
          data={activeSheetData}
          onChange={readOnly ? undefined : handleChange}
          lang="en"
          showToolbar={false}
          showFormulaBar={false}
          showSheetTabs={false}
          allowEdit={!readOnly}
          // 중국어 컨텍스트 메뉴 완전 제거 — 우리 툴바로 대체
          cellContextMenu={readOnly ? [] : CELL_CONTEXT_MENU}
          headerContextMenu={[]}
          sheetTabContextMenu={[]}
          filterContextMenu={[]}
          hooks={readOnly ? {} : {
            afterSelectionChange: (_sheetId: string, selection: any) => {
              const col = selection?.column?.[0] ?? 0
              selectedColRef.current = col
              // dock이 열려 있으면 선택 컬럼으로 자동 전환
              if (dockOpenRef.current && col < columnsRef.current.length) {
                setActiveDockCol(col)
              }
            },
            beforeUpdateCell: (r: number, c: number) => {
              if (r === 0) return false
              const invIdx = columnsRef.current.findIndex(col => col.id === '__inv__')
              if (invIdx >= 0 && c === invIdx) return false
              return true
            },
          }}
        />
      </div>

      {/* 컬럼 설정 사이드 독 — 항상 렌더링, open prop으로 슬라이드 제어 */}
      <ColumnManagerPanel
        open={dockOpen}
        col={columns[activeDockCol] ?? null}
        colIndex={activeDockCol}
        totalCols={columns.length}
        onUpdate={patch => handleColUpdate(activeDockCol, patch)}
        onDelete={() => handleColDelete(activeDockCol)}
        onClose={() => { setDockOpen(false); dockOpenRef.current = false }}
        onSaveOptions={handleSaveOptions}
      />

      {/* 파일 업로드 모달 */}
      {showUpload && (
        <FileUploadModal
          columns={columns}
          onImport={handleImport}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}

function ToolBtn({
  label, onClick, active = false, primary = false,
}: {
  label: string
  onClick: () => void
  active?: boolean
  primary?: boolean
}) {
  if (primary) {
    return (
      <button
        onClick={onClick}
        style={{
          padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          border: 'none', cursor: 'pointer',
          backgroundColor: '#FF5C1A', color: '#fff',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#C04030')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FF5C1A')}
      >
        {label}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        border: `1px solid ${active ? '#FF5C1A' : 'rgba(61,26,46,0.15)'}`,
        cursor: 'pointer',
        backgroundColor: active ? 'rgba(255,92,26,0.07)' : 'transparent',
        color: active ? '#FF5C1A' : '#3D1A2E',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.05)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {label}
    </button>
  )
}
