'use client'

import { useState, useRef, useCallback, DragEvent } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { Column, GuestRow } from './actions'

type Props = {
  columns: Column[]
  onImport: (rows: GuestRow[]) => void
  onClose: () => void
}

type MappingEntry = { fileCol: string; gridColId: string | '__new__' | '__skip__'; newColName?: string }

export default function FileUploadModal({ columns, onImport, onClose }: Props) {
  const [dragging, setDragging] = useState(false)
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [mapping, setMapping] = useState<MappingEntry[]>([])
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    setError('')
    try {
      let allRows: string[][]
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
        allRows = result.data
      } else {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        allRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
      }

      if (allRows.length === 0) { setError('파일이 비어 있습니다.'); return }

      const headers = allRows[0].map(h => String(h ?? ''))
      const dataRows = firstRowIsHeader ? allRows.slice(1) : allRows

      // 기본 매핑: 헤더 이름이 기존 컬럼 이름과 일치하면 자동 연결
      const initMapping: MappingEntry[] = headers.map(h => {
        const matched = columns.find(c => c.name === h)
        return matched
          ? { fileCol: h, gridColId: matched.id }
          : { fileCol: h, gridColId: '__new__', newColName: h }
      })

      setParsed({ headers, rows: dataRows.map(r => r.map(v => String(v ?? ''))) })
      setMapping(initMapping)
    } catch {
      setError('파일을 읽을 수 없습니다. xlsx 또는 csv 형식인지 확인해 주세요.')
    }
  }, [columns, firstRowIsHeader])

  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleImport = () => {
    if (!parsed) return

    // 1. 새 컬럼 결정 (__new__ 항목 → 새 컬럼 ID 발급)
    const resolvedCols: Map<string, string> = new Map() // fileColName → colId
    const addedCols: Column[] = []

    mapping.forEach(m => {
      if (m.gridColId === '__skip__') return
      if (m.gridColId === '__new__') {
        const id = `col_${crypto.randomUUID().slice(0, 8)}`
        resolvedCols.set(m.fileCol, id)
        addedCols.push({ id, name: m.newColName || m.fileCol, width: 130, type: 'text' })
      } else {
        resolvedCols.set(m.fileCol, m.gridColId)
      }
    })

    // 2. GuestRow 생성
    const newRows: GuestRow[] = parsed.rows.map((row, ri) => {
      const data: Record<string, string> = {}
      mapping.forEach((m, ci) => {
        if (m.gridColId === '__skip__') return
        const colId = resolvedCols.get(m.fileCol)
        if (colId) data[colId] = row[ci] ?? ''
      })
      return { id: crypto.randomUUID(), row_index: ri, data }
    })

    onImport(newRows)
  }

  const btn = (label: string, action: () => void, primary = false) => (
    <button
      onClick={action}
      style={{
        padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        backgroundColor: primary ? '#FF5C1A' : 'rgba(61,26,46,0.07)',
        color: primary ? '#fff' : '#3D1A2E',
        border: 'none',
      }}
    >{label}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 680,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(61,26,46,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#3D1A2E', margin: 0 }}>파일 가져오기</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8B6A5A', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {!parsed ? (
            // ── 업로드 영역 ─────────────────────────────────────────
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? '#FF5C1A' : 'rgba(61,26,46,0.2)'}`,
                  borderRadius: 12, padding: '40px 20px',
                  textAlign: 'center', cursor: 'pointer',
                  backgroundColor: dragging ? 'rgba(255,92,26,0.04)' : '#faf8f4',
                  transition: 'all 0.15s',
                }}
              >
                <p style={{ fontSize: 14, color: '#3D1A2E', fontWeight: 600, marginBottom: 6 }}>
                  파일을 여기에 드래그하거나 클릭해서 선택
                </p>
                <p style={{ fontSize: 12, color: '#8B6A5A' }}>.xlsx · .csv 형식 지원</p>
                <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleFileChange} />
              </div>

              {error && <p style={{ marginTop: 12, fontSize: 12, color: '#FF5C1A' }}>{error}</p>}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: '#3D1A2E', cursor: 'pointer' }}>
                <input type="checkbox" checked={firstRowIsHeader} onChange={e => setFirstRowIsHeader(e.target.checked)} />
                첫 번째 행을 헤더로 사용
              </label>
            </>
          ) : (
            // ── 컬럼 매핑 ──────────────────────────────────────────
            <>
              <p style={{ fontSize: 13, color: '#8B6A5A', marginBottom: 16 }}>
                파일의 열을 기존 컬럼에 연결하거나 새 컬럼으로 추가하세요. ({parsed.rows.length}행 감지)
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mapping.map((m, i) => (
                  <div key={m.fileCol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', backgroundColor: '#faf8f4', borderRadius: 8, border: '1px solid rgba(61,26,46,0.08)' }}>
                    {/* 파일 열 이름 */}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#3D1A2E', width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.fileCol || `열 ${i + 1}`}
                    </span>
                    <span style={{ color: '#8B6A5A', fontSize: 16 }}>→</span>

                    {/* 매핑 드롭다운 */}
                    <select
                      value={m.gridColId}
                      onChange={e => setMapping(prev => prev.map((x, xi) => xi === i ? { ...x, gridColId: e.target.value as MappingEntry['gridColId'] } : x))}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(61,26,46,0.15)', fontSize: 12, color: '#3D1A2E', backgroundColor: '#fff' }}
                    >
                      <option value="__new__">새 컬럼으로 추가</option>
                      <option value="__skip__">건너뛰기</option>
                      {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    {/* 새 컬럼 이름 입력 */}
                    {m.gridColId === '__new__' && (
                      <input
                        value={m.newColName ?? m.fileCol}
                        onChange={e => setMapping(prev => prev.map((x, xi) => xi === i ? { ...x, newColName: e.target.value } : x))}
                        placeholder="새 컬럼 이름"
                        style={{ width: 120, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(61,26,46,0.15)', fontSize: 12, color: '#3D1A2E' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* 미리보기 (첫 3행) */}
              {parsed.rows.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#8B6A5A', marginBottom: 8 }}>미리보기 (최대 3행)</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                      <thead>
                        <tr>
                          {parsed.headers.map((h, i) => (
                            <th key={i} style={{ padding: '4px 8px', backgroundColor: '#F0EBE1', border: '1px solid rgba(61,26,46,0.1)', fontWeight: 600, color: '#3D1A2E', textAlign: 'left' }}>{h || `열 ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 3).map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{ padding: '4px 8px', border: '1px solid rgba(61,26,46,0.08)', color: '#3D1A2E', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(61,26,46,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {parsed ? (
            <>
              {btn('다시 선택', () => setParsed(null))}
              {btn(`${parsed.rows.length}행 가져오기`, handleImport, true)}
            </>
          ) : (
            btn('닫기', onClose)
          )}
        </div>
      </div>
    </div>
  )
}
