'use client'

import { useState, useRef, useCallback } from 'react'
import { useGrid } from './useGrid'
import { useAutoSave } from './useAutoSave'
import Cell from './Cell'
import ColumnHeader, { HEADER_TOTAL_HEIGHT } from './ColumnHeader'
import FileUploadModal from './FileUploadModal'
import ColumnManagerPanel from './ColumnManagerPanel'
import type { Column, GuestRow } from './actions'
import { deleteGuests } from './actions'

const ROW_HEIGHT = 26
const ROW_NUM_WIDTH = 46

type SaveStatus = 'saved' | 'saving' | 'error'

type Props = {
  eventId: string
  initialColumns: Column[]
  initialRows: GuestRow[]
  onSaveStatusChange: (s: SaveStatus) => void
  onAlert: (msg: string, type?: 'warn' | 'error' | 'info') => void
}

export default function SpreadsheetGrid({
  eventId, initialColumns, initialRows, onSaveStatusChange, onAlert,
}: Props) {
  const grid = useGrid(initialColumns, initialRows)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [dockOpen, setDockOpen]           = useState(false)
  const [activeDockCol, setActiveDockCol] = useState(0)
  const dockOpenRef = useRef(false)
  const [editingHeaderIdx, setEditingHeaderIdx] = useState<number | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  // 컬럼 DnD
  const [dragColIdx, setDragColIdx] = useState<number | null>(null)
  const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null)

  // 행 DnD
  const [dragRowIdx, setDragRowIdx] = useState<number | null>(null)
  const [dragOverRowIdx, setDragOverRowIdx] = useState<number | null>(null)

  // 셀 드래그 선택
  const isMouseDownRef = useRef(false)

  // 정렬 & 값 필터
  const [sortState, setSortState] = useState<Record<string, 'asc' | 'desc' | null>>({})
  const [valueFilters, setValueFilters] = useState<Record<string, string[]>>({})

  const containerRef = useRef<HTMLDivElement>(null)

  const { schedule: scheduleSave } = useAutoSave(
    eventId,
    grid.columns,
    grid.flushDirty,
    onSaveStatusChange
  )

  const handleCellChange = useCallback((v: string) => {
    grid.setEditValue(v)
    scheduleSave()
  }, [grid, scheduleSave])

  // 필터 + 정렬 적용
  const filteredRows = (() => {
    let result = [...grid.rows]

    // 텍스트 필터 (하단 필터 행)
    result = result.filter(row =>
      grid.columns.every(col => {
        const fv = filters[col.id]
        if (!fv) return true
        const cv = (row.data[col.id] ?? '').toLowerCase()
        return cv.includes(fv.toLowerCase())
      })
    )

    // 값 필터 (체크박스)
    result = result.filter(row =>
      grid.columns.every(col => {
        const vf = valueFilters[col.id]
        if (!vf || vf.length === 0) return true
        const cv = row.data[col.id] ?? ''
        if (vf.includes('__empty__') && cv === '') return true
        return vf.filter(v => v !== '__empty__').includes(cv)
      })
    )

    // 정렬 (마지막 sortState 기준)
    const sortCol = grid.columns.find(c => sortState[c.id])
    if (sortCol) {
      const dir = sortState[sortCol.id]
      result.sort((a, b) => {
        const av = (a.data[sortCol.id] ?? '').toLowerCase()
        const bv = (b.data[sortCol.id] ?? '').toLowerCase()
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }

    return result
  })()

  const rowNumStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: ROW_NUM_WIDTH,
    flexShrink: 0,
    backgroundColor: '#F0EBE1',
    borderRight: '2px solid rgba(61,26,46,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    color: '#8B6A5A',
    userSelect: 'none',
    ...extra,
  })

  const checkDuplicate = useCallback(() => {
    const nameCol = grid.columns.find(c => c.name === '이름')?.id
    const phoneCol = grid.columns.find(c => c.name === '연락처')?.id
    if (!nameCol || !phoneCol) return
    const seen = new Set<string>()
    grid.rows.forEach(row => {
      const key = `${row.data[nameCol] ?? ''}__${row.data[phoneCol] ?? ''}`
      if (key !== '__' && seen.has(key)) {
        onAlert(`중복 데이터 감지: "${row.data[nameCol]}" (${row.data[phoneCol]})`, 'warn')
      }
      seen.add(key)
    })
  }, [grid.columns, grid.rows, onAlert])

  const { contextMenu, setContextMenu } = grid

  const handleAddColAfter = () => {
    grid.addColumn('')
    setEditingHeaderIdx(grid.columns.length)
    scheduleSave()
    setContextMenu(null)
  }
  const handleDeleteCol = () => {
    if (contextMenu === null) return
    if (!confirm('이 컬럼을 삭제하시겠습니까?')) { setContextMenu(null); return }
    grid.deleteColumn(contextMenu.colIndex)
    scheduleSave()
    setContextMenu(null)
  }

  const handleDeleteRows = useCallback(async () => {
    if (!grid.selection) return
    const minR = Math.min(grid.selection.anchor.row, grid.selection.focus.row)
    const maxR = Math.max(grid.selection.anchor.row, grid.selection.focus.row)
    const toDelete = grid.rows.slice(minR, maxR + 1).map(r => r.id)
    grid.deleteSelectedRows()
    await deleteGuests(toDelete)
    onSaveStatusChange('saved')
  }, [grid, onSaveStatusChange])

  const handleImport = useCallback((newRows: GuestRow[], newColumns?: Column[]) => {
    if (newColumns) {
      grid.setColumns(prev => {
        const existingIds = new Set(prev.map(c => c.id))
        const toAdd = newColumns.filter(c => !existingIds.has(c.id))
        return [...prev, ...toAdd]
      })
    }
    grid.setRows(prev => {
      const offset = prev.length
      return [...prev, ...newRows.map((r, i) => ({ ...r, row_index: offset + i }))]
    })
    scheduleSave()
    setShowUpload(false)
    onAlert(`${newRows.length}행을 가져왔습니다.`, 'info')
  }, [grid, scheduleSave, onAlert])

  const totalWidth = ROW_NUM_WIDTH + grid.columns.reduce((s, c) => s + c.width, 0)

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 툴바 */}
      <div style={{
        height: 38, display: 'flex', alignItems: 'center', padding: '0 12px',
        borderBottom: '1px solid rgba(61,26,46,0.1)', backgroundColor: '#fff', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ToolBtn label="📂 파일 가져오기" onClick={() => setShowUpload(true)} />
          <div style={{ width: 1, height: 16, backgroundColor: 'rgba(61,26,46,0.12)', margin: '0 2px' }} />
          <ToolBtn label="+ 행 추가" onClick={grid.addRow} primary />
          {grid.selection && (
            <ToolBtn label="− 행 삭제" onClick={handleDeleteRows} danger />
          )}
        </div>
        <div style={{ flex: 1 }} />
        <ToolBtn
          label={dockOpen ? '⚙ 컬럼 설정 닫기' : '⚙ 컬럼 설정'}
          onClick={() => {
            const next = !dockOpen
            if (next) setActiveDockCol(grid.selection?.anchor.col ?? 0)
            setDockOpen(next)
            dockOpenRef.current = next
          }}
        />
      </div>

      {/* 그리드 컨테이너 */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={e => { grid.handleKeyDown(e); scheduleSave() }}
        onPaste={e => { grid.handlePaste(e); scheduleSave(); checkDuplicate() }}
        onBlur={() => { if (grid.editingCell) grid.commitEdit(grid.editingCell.row, grid.editingCell.col) }}
        onMouseUp={() => { isMouseDownRef.current = false }}
        onMouseLeave={() => { isMouseDownRef.current = false }}
        style={{ flex: 1, overflow: 'auto', outline: 'none', minHeight: 0 }}
      >
        <div style={{ minWidth: totalWidth }}>
          {/* 헤더 행 */}
          <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 20 }}>
            <div style={{
              ...rowNumStyle({ height: HEADER_TOTAL_HEIGHT, position: 'sticky', left: 0, zIndex: 30 }),
              flexDirection: 'column', borderBottom: '2px solid rgba(61,26,46,0.15)',
            }}>
              <span style={{ fontSize: 10, opacity: 0.5 }}>#</span>
            </div>
            {grid.columns.map((col, ci) => (
              <ColumnHeader
                key={col.id}
                col={col}
                colIndex={ci}
                isSelected={
                  !!grid.selection &&
                  Math.min(grid.selection.anchor.col, grid.selection.focus.col) <= ci &&
                  ci <= Math.max(grid.selection.anchor.col, grid.selection.focus.col)
                }
                autoFocusEdit={editingHeaderIdx === ci}
                onAutoFocusDone={() => setEditingHeaderIdx(null)}
                filterValue={filters[col.id] ?? ''}
                onFilterChange={v => setFilters(prev => ({ ...prev, [col.id]: v }))}
                onRename={name => { grid.renameColumn(ci, name); scheduleSave() }}
                onResize={(idx, w) => { grid.resizeColumn(idx, w); scheduleSave() }}
                onContextMenu={(e, idx) => setContextMenu({ x: e.clientX, y: e.clientY, colIndex: idx })}
                onColumnClick={ci => {
                  grid.setSelection({ anchor: { row: 0, col: ci }, focus: { row: filteredRows.length - 1, col: ci } })
                  if (dockOpenRef.current) setActiveDockCol(ci)
                }}
                // DnD
                onDragStart={setDragColIdx}
                onDragOver={setDragOverColIdx}
                onDrop={toIdx => {
                  if (dragColIdx !== null && dragColIdx !== toIdx) {
                    grid.reorderColumn(dragColIdx, toIdx)
                    scheduleSave()
                  }
                  setDragColIdx(null)
                  setDragOverColIdx(null)
                }}
                isDragOver={dragOverColIdx === ci && dragColIdx !== ci}
                // sort
                sortDir={sortState[col.id] ?? null}
                onSort={dir => setSortState(prev => ({ ...prev, [col.id]: dir }))}
                // value filter
                allValues={grid.rows.map(r => r.data[col.id] ?? '')}
                selectedValues={valueFilters[col.id] ?? []}
                onSelectedValuesChange={vals => setValueFilters(prev => ({ ...prev, [col.id]: vals }))}
              />
            ))}
            {/* 컬럼 추가 */}
            <div
              onClick={() => {
                grid.addColumn('')
                setEditingHeaderIdx(grid.columns.length)
                scheduleSave()
              }}
              style={{
                height: HEADER_TOTAL_HEIGHT, width: 36, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: '#8B6A5A', cursor: 'pointer',
                backgroundColor: '#F0EBE1',
                borderBottom: '2px solid rgba(61,26,46,0.15)',
              }}
              title="컬럼 추가"
            >+</div>
          </div>

          {/* 데이터 행 */}
          {filteredRows.map((row, ri) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                borderTop: dragOverRowIdx === ri && dragRowIdx !== ri ? '2px solid #FF5C1A' : '2px solid transparent',
              }}
              onDragOver={e => { e.preventDefault(); setDragOverRowIdx(ri) }}
              onDrop={e => {
                e.preventDefault()
                if (dragRowIdx !== null && dragRowIdx !== ri) {
                  grid.reorderRow(dragRowIdx, ri)
                  scheduleSave()
                }
                setDragRowIdx(null)
                setDragOverRowIdx(null)
              }}
            >
              {/* 행 번호 */}
              <div
                draggable
                onDragStart={() => setDragRowIdx(ri)}
                onDragEnd={() => { setDragRowIdx(null); setDragOverRowIdx(null) }}
                style={{
                  ...rowNumStyle({ height: ROW_HEIGHT, position: 'sticky', left: 0, zIndex: 10 }),
                  borderBottom: '1px solid rgba(61,26,46,0.08)',
                  cursor: 'grab',
                  backgroundColor: grid.isInSelection(ri, 0) ? 'rgba(255,92,26,0.06)' : '#F0EBE1',
                  fontSize: dragRowIdx === ri ? 10 : 11,
                  color: dragRowIdx === ri ? '#FF5C1A' : '#8B6A5A',
                }}
                onClick={() => grid.setSelection({ anchor: { row: ri, col: 0 }, focus: { row: ri, col: grid.columns.length - 1 } })}
              >
                {ri + 1}
              </div>
              {/* 셀들 */}
              {grid.columns.map((col, ci) => {
                const isEditing = grid.editingCell?.row === ri && grid.editingCell?.col === ci
                return (
                  <div
                    key={col.id}
                    style={{ borderBottom: '1px solid rgba(61,26,46,0.08)', borderRight: '1px solid rgba(61,26,46,0.06)', flexShrink: 0 }}
                  >
                    <Cell
                      value={grid.getCellValue(ri, ci)}
                      isEditing={isEditing}
                      isSelected={grid.isInSelection(ri, ci)}
                      isAnchor={grid.isAnchor(ri, ci)}
                      colType={col.type}
                      colOptions={col.options}
                      editValue={isEditing ? grid.editValue : ''}
                      onEditChange={handleCellChange}
                      onDirectChange={(v) => {
                        // dropdown / survey: edit mode 없이 직접 값 변경
                        grid.setCellValue(ri, ci, v)
                        scheduleSave()
                      }}
                      onMouseDown={e => {
                        const fromSelect = e.target instanceof HTMLSelectElement
                        // <select> 클릭 시: preventDefault 하면 네이티브 드롭다운이 열리지 않음
                        if (!fromSelect) e.preventDefault()
                        isMouseDownRef.current = true
                        if (grid.editingCell) grid.commitEdit(grid.editingCell.row, grid.editingCell.col)
                        grid.setSelection({ anchor: { row: ri, col: ci }, focus: { row: ri, col: ci } })
                        if (!fromSelect) containerRef.current?.focus()
                        // dock이 열려 있으면 선택 컬럼으로 자동 전환
                        if (dockOpenRef.current && ci < grid.columns.length) setActiveDockCol(ci)
                      }}
                      onMouseEnter={() => {
                        if (!isMouseDownRef.current) return
                        if (!grid.selection) return
                        grid.setSelection(prev => prev ? { anchor: prev.anchor, focus: { row: ri, col: ci } } : null)
                      }}
                      onDoubleClick={() => grid.enterEdit(ri, ci)}
                      width={col.width}
                      rowHeight={ROW_HEIGHT}
                    />
                  </div>
                )
              })}
            </div>
          ))}

          {/* 빈 행 추가 */}
          <div style={{ display: 'flex' }}>
            <div
              style={{ ...rowNumStyle({ height: ROW_HEIGHT }), borderBottom: '1px solid rgba(61,26,46,0.08)', cursor: 'pointer', color: '#FF5C1A', fontSize: 16 }}
              onClick={grid.addRow}
              title="행 추가"
            >+</div>
            {grid.columns.map(col => (
              <div
                key={col.id}
                style={{ width: col.width, height: ROW_HEIGHT, flexShrink: 0, borderBottom: '1px solid rgba(61,26,46,0.08)', borderRight: '1px solid rgba(61,26,46,0.06)', cursor: 'pointer' }}
                onClick={grid.addRow}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setContextMenu(null)} />
          <div style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50,
            backgroundColor: '#fff', border: '1px solid rgba(61,26,46,0.15)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: '4px 0', minWidth: 150,
          }}>
            {[
              { label: '컬럼 추가', action: handleAddColAfter },
              { label: '컬럼 삭제', action: handleDeleteCol },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 14px', fontSize: 13, background: 'none', border: 'none',
                  cursor: 'pointer', color: '#3D1A2E',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,92,26,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 하단 상태바 */}
      <div style={{
        height: 24, borderTop: '1px solid rgba(61,26,46,0.1)',
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 12px',
        backgroundColor: '#faf8f4', fontSize: 11, color: '#8B6A5A', flexShrink: 0,
      }}>
        <span>{filteredRows.length}행</span>
        {grid.selection && (
          <span style={{ color: 'rgba(61,26,46,0.4)' }}>
            {Math.abs(grid.selection.focus.row - grid.selection.anchor.row) + 1}행 선택됨
          </span>
        )}
      </div>

      {/* 파일 업로드 모달 */}
      {showUpload && (
        <FileUploadModal
          columns={grid.columns}
          onImport={handleImport}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* 컬럼 설정 사이드 독 */}
      <ColumnManagerPanel
        open={dockOpen}
        col={grid.columns[activeDockCol] ?? null}
        colIndex={activeDockCol}
        totalCols={grid.columns.length}
        onUpdate={patch => { grid.updateColumn(activeDockCol, patch); scheduleSave() }}
        onDelete={() => {
          grid.deleteColumn(activeDockCol)
          scheduleSave()
          const remaining = grid.columns.length - 1
          if (remaining === 0) { setDockOpen(false); dockOpenRef.current = false }
          else setActiveDockCol(Math.min(activeDockCol, remaining - 1))
        }}
        onClose={() => { setDockOpen(false); dockOpenRef.current = false }}
      />
    </div>
  )
}

function ToolBtn({ label, onClick, primary = false, danger = false }: { label: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  const bg = primary ? '#FF5C1A' : 'transparent'
  const color = primary ? '#fff' : danger ? '#FF5C1A' : '#3D1A2E'
  const border = primary ? 'none' : danger ? '1px solid rgba(255,92,26,0.3)' : '1px solid rgba(61,26,46,0.15)'
  return (
    <button
      onClick={onClick}
      style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, border, cursor: 'pointer', backgroundColor: bg, color }}
      onMouseEnter={e => {
        if (primary) return
        e.currentTarget.style.backgroundColor = danger ? 'rgba(255,92,26,0.06)' : 'rgba(61,26,46,0.05)'
      }}
      onMouseLeave={e => { if (!primary) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {label}
    </button>
  )
}
