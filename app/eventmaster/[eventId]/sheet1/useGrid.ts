'use client'

import { useState, useCallback, useRef } from 'react'
import type { Column, GuestRow } from './actions'

export type CellAddr = { row: number; col: number }
export type Selection = { anchor: CellAddr; focus: CellAddr }

export type GridState = {
  columns: Column[]
  rows: GuestRow[]
  selection: Selection | null
  editingCell: CellAddr | null
  editValue: string
  contextMenu: { x: number; y: number; colIndex: number } | null
}

function padRows(rows: GuestRow[], count = 100): GuestRow[] {
  if (rows.length >= count) return rows
  const padded = [...rows]
  while (padded.length < count) {
    padded.push({ id: crypto.randomUUID(), row_index: padded.length, data: {} })
  }
  return padded
}

export function useGrid(initialColumns: Column[], initialRows: GuestRow[]) {
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [rows, setRows] = useState<GuestRow[]>(() => padRows(initialRows))
  const [selection, setSelection] = useState<Selection | null>(null)
  const [editingCell, setEditingCell] = useState<CellAddr | null>(null)
  const [editValue, setEditValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; colIndex: number } | null>(null)

  // 변경된 row id 추적 (auto-save용)
  const dirtyRowIds = useRef<Set<string>>(new Set())

  const markDirty = useCallback((rowId: string) => {
    dirtyRowIds.current.add(rowId)
  }, [])

  const flushDirty = useCallback((): GuestRow[] => {
    const ids = dirtyRowIds.current
    dirtyRowIds.current = new Set()
    return rows.filter(r => ids.has(r.id))
  }, [rows])

  // ── 셀 값 읽기/쓰기 ──────────────────────────────────────────────
  const getCellValue = useCallback(
    (row: number, col: number) => {
      const r = rows[row]
      if (!r) return ''
      return r.data[columns[col]?.id] ?? ''
    },
    [rows, columns]
  )

  const setCellValue = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      setRows(prev => {
        const next = [...prev]
        const colId = columns[colIdx]?.id
        if (!colId) return prev
        // 행이 없으면 새로 생성
        while (next.length <= rowIdx) {
          next.push({ id: crypto.randomUUID(), row_index: next.length, data: {} })
        }
        const row = { ...next[rowIdx], data: { ...next[rowIdx].data, [colId]: value } }
        markDirty(row.id)
        next[rowIdx] = row
        return next
      })
    },
    [columns, markDirty]
  )

  // ── 편집 ──────────────────────────────────────────────────────────
  const enterEdit = useCallback(
    (row: number, col: number, initialChar?: string) => {
      setEditingCell({ row, col })
      setEditValue(initialChar ?? getCellValue(row, col))
    },
    [getCellValue]
  )

  const commitEdit = useCallback(
    (row: number, col: number) => {
      setCellValue(row, col, editValue)
      setEditingCell(null)
      setEditValue('')
    },
    [editValue, setCellValue]
  )

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
  }, [])

  // ── 선택 범위 계산 ────────────────────────────────────────────────
  const isInSelection = useCallback(
    (row: number, col: number) => {
      if (!selection) return false
      const minR = Math.min(selection.anchor.row, selection.focus.row)
      const maxR = Math.max(selection.anchor.row, selection.focus.row)
      const minC = Math.min(selection.anchor.col, selection.focus.col)
      const maxC = Math.max(selection.anchor.col, selection.focus.col)
      return row >= minR && row <= maxR && col >= minC && col <= maxC
    },
    [selection]
  )

  const isAnchor = useCallback(
    (row: number, col: number) =>
      selection?.anchor.row === row && selection?.anchor.col === col,
    [selection]
  )

  // ── 키보드 네비게이션 ──────────────────────────────────────────────
  const move = useCallback(
    (row: number, col: number, dr: number, dc: number) => {
      const maxRow = Math.max(rows.length, 1)
      const maxCol = columns.length - 1
      const nr = Math.max(0, Math.min(maxRow, row + dr))
      const nc = Math.max(0, Math.min(maxCol, col + dc))
      setSelection({ anchor: { row: nr, col: nc }, focus: { row: nr, col: nc } })
      return { row: nr, col: nc }
    },
    [rows.length, columns.length]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const anchor = selection?.anchor
      if (!anchor) return

      const { row, col } = anchor

      if (editingCell) {
        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); return }
        if (e.key === 'Enter') { e.preventDefault(); commitEdit(row, col); move(row, col, 1, 0); return }
        if (e.key === 'Tab')  { e.preventDefault(); commitEdit(row, col); move(row, col, 0, e.shiftKey ? -1 : 1); return }
        return
      }

      if (e.key === 'ArrowUp')    { e.preventDefault(); move(row, col, -1,  0); return }
      if (e.key === 'ArrowDown')  { e.preventDefault(); move(row, col,  1,  0); return }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); move(row, col,  0, -1); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); move(row, col,  0,  1); return }
      if (e.key === 'Tab')        { e.preventDefault(); move(row, col,  0, e.shiftKey ? -1 : 1); return }
      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); enterEdit(row, col); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setCellValue(row, col, ''); return }
      // 일반 문자 입력 → 즉시 편집 모드
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { enterEdit(row, col, e.key); return }
    },
    [selection, editingCell, move, enterEdit, commitEdit, cancelEdit, setCellValue]
  )

  // ── 붙여넣기 ──────────────────────────────────────────────────────
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      if (!text || !selection) return
      const pastedRows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n').map(r => r.split('\t'))
      const { row: startRow, col: startCol } = selection.anchor
      pastedRows.forEach((pr, ri) => {
        pr.forEach((val, ci) => {
          if (startCol + ci < columns.length) {
            setCellValue(startRow + ri, startCol + ci, val)
          }
        })
      })
      setSelection({
        anchor: { row: startRow, col: startCol },
        focus: {
          row: startRow + pastedRows.length - 1,
          col: startCol + pastedRows[0].length - 1,
        },
      })
    },
    [selection, columns.length, setCellValue]
  )

  // ── 행 추가/삭제 ──────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setRows(prev => [
      ...prev,
      { id: crypto.randomUUID(), row_index: prev.length, data: {} },
    ])
  }, [])

  const deleteSelectedRows = useCallback(() => {
    if (!selection) return
    const minR = Math.min(selection.anchor.row, selection.focus.row)
    const maxR = Math.max(selection.anchor.row, selection.focus.row)
    setRows(prev => {
      const next = prev.filter((_, i) => i < minR || i > maxR)
      return next.map((r, i) => ({ ...r, row_index: i }))
    })
    setSelection(null)
  }, [selection])

  // ── 컬럼 조작 ─────────────────────────────────────────────────────
  const addColumn = useCallback((name: string, type: Column['type'] = 'text', options?: string[]) => {
    const id = `col_${crypto.randomUUID().slice(0, 8)}`
    setColumns(prev => [...prev, { id, name, width: 130, type, ...(options ? { options } : {}) }])
  }, [])

  const renameColumn = useCallback((colIndex: number, name: string) => {
    setColumns(prev => prev.map((c, i) => i === colIndex ? { ...c, name } : c))
  }, [])

  const updateColumn = useCallback((colIndex: number, patch: Partial<Column>) => {
    setColumns(prev => prev.map((c, i) => i === colIndex ? { ...c, ...patch } : c))
  }, [])

  const deleteColumn = useCallback((colIndex: number) => {
    const colId = columns[colIndex]?.id
    if (!colId) return
    setColumns(prev => prev.filter((_, i) => i !== colIndex))
    setRows(prev => prev.map(r => {
      const data = { ...r.data }
      delete data[colId]
      return { ...r, data }
    }))
  }, [columns])

  const resizeColumn = useCallback((colIndex: number, width: number) => {
    setColumns(prev => prev.map((c, i) => i === colIndex ? { ...c, width: Math.max(60, width) } : c))
  }, [])

  const reorderColumn = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    setColumns(prev => {
      const next = [...prev]
      const [col] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, col)
      return next
    })
  }, [])

  const reorderRow = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    setRows(prev => {
      const next = [...prev]
      const [row] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, row)
      return next.map((r, i) => ({ ...r, row_index: i }))
    })
  }, [])

  return {
    columns, setColumns,
    rows, setRows,
    selection, setSelection,
    editingCell, setEditingCell,
    editValue, setEditValue,
    contextMenu, setContextMenu,
    getCellValue, setCellValue,
    enterEdit, commitEdit, cancelEdit,
    isInSelection, isAnchor,
    handleKeyDown, handlePaste,
    addRow, deleteSelectedRows,
    addColumn, renameColumn, updateColumn, deleteColumn, resizeColumn,
    reorderColumn, reorderRow,
    flushDirty,
  }
}
