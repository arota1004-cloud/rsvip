'use client'

import { useState, useRef, useEffect } from 'react'
import type { Column } from './actions'

type Props = {
  col: Column
  colIndex: number
  isSelected: boolean
  autoFocusEdit?: boolean
  onRename: (name: string) => void
  onResize: (colIndex: number, width: number) => void
  onContextMenu: (e: React.MouseEvent, colIndex: number) => void
  onColumnClick: (colIndex: number) => void
  filterValue: string
  onFilterChange: (v: string) => void
  onAutoFocusDone?: () => void
  // DnD
  onDragStart: (colIndex: number) => void
  onDragOver: (colIndex: number) => void
  onDrop: (colIndex: number) => void
  isDragOver: boolean
  // sort
  sortDir: 'asc' | 'desc' | null
  onSort: (dir: 'asc' | 'desc' | null) => void
  // rows (for dropdown filter checkboxes)
  allValues: string[]
  selectedValues: string[]
  onSelectedValuesChange: (v: string[]) => void
}

const HEADER_HEIGHT = 28
const FILTER_HEIGHT = 24

export default function ColumnHeader({
  col, colIndex, isSelected, autoFocusEdit,
  onRename, onResize, onContextMenu, onColumnClick,
  filterValue, onFilterChange, onAutoFocusDone,
  onDragStart, onDragOver, onDrop, isDragOver,
  sortDir, onSort,
  allValues, selectedValues, onSelectedValuesChange,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(col.name)
  const [showFilter, setShowFilter] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const resizeStartX = useRef<number | null>(null)
  const resizeStartW = useRef<number>(col.width)

  useEffect(() => {
    if (autoFocusEdit) {
      setEditing(true)
      setEditName('')
      onAutoFocusDone?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusEdit])

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  useEffect(() => {
    if (!editing) setEditName(col.name)
  }, [col.name, editing])

  // 필터 패널 외부 클릭 닫기
  useEffect(() => {
    if (!showFilter) return
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFilter])

  const commitRename = () => {
    const newName = editName.trim()
    if (newName) onRename(newName)
    else setEditName(col.name)
    setEditing(false)
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    resizeStartX.current = e.clientX
    resizeStartW.current = col.width
    const onMove = (me: MouseEvent) => {
      if (resizeStartX.current === null) return
      onResize(colIndex, resizeStartW.current + me.clientX - resizeStartX.current)
    }
    const onUp = () => {
      resizeStartX.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const hasFilter = sortDir !== null || filterValue !== '' || selectedValues.length > 0
  const uniqueVals = Array.from(new Set(allValues.filter(v => v !== '')))

  return (
    <div
      style={{
        width: col.width, display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: 0,
        borderLeft: isDragOver ? '2px solid #FF5C1A' : '2px solid transparent',
        transition: 'border-color 0.1s',
      }}
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(colIndex) }}
      onDragOver={e => { e.preventDefault(); onDragOver(colIndex) }}
      onDrop={e => { e.preventDefault(); onDrop(colIndex) }}
    >
      {/* 헤더 셀 */}
      <div
        onDoubleClick={() => { setEditing(true); setEditName(col.name) }}
        onContextMenu={e => { e.preventDefault(); onContextMenu(e, colIndex) }}
        onClick={() => onColumnClick(colIndex)}
        style={{
          height: HEADER_HEIGHT, width: col.width, boxSizing: 'border-box',
          display: 'flex', alignItems: 'center',
          paddingLeft: 6, paddingRight: 22,
          fontSize: 12, fontWeight: 600, color: '#3D1A2E',
          backgroundColor: isSelected ? 'rgba(255,92,26,0.08)' : '#F0EBE1',
          borderRight: '1px solid rgba(61,26,46,0.12)',
          borderBottom: '2px solid rgba(61,26,46,0.15)',
          cursor: 'default', userSelect: 'none',
          overflow: 'hidden', whiteSpace: 'nowrap', position: 'relative',
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setEditName(col.name); setEditing(false) }
            }}
            placeholder="컬럼 이름"
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, fontWeight: 600, backgroundColor: 'transparent', color: '#3D1A2E' }}
          />
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {col.name || <span style={{ color: 'rgba(61,26,46,0.3)', fontWeight: 400 }}>컬럼 이름</span>}
          </span>
        )}

        {/* 필터 아이콘 */}
        <button
          onClick={e => { e.stopPropagation(); setShowFilter(v => !v) }}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 10, lineHeight: 1,
            color: hasFilter ? '#FF5C1A' : 'rgba(61,26,46,0.3)',
          }}
          title="필터/정렬"
        >
          {hasFilter ? '▼' : '⌄'}
        </button>

        {/* 너비 조정 핸들 */}
        <div onMouseDown={handleResizeMouseDown} style={{ position: 'absolute', right: 0, top: 0, width: 4, height: '100%', cursor: 'col-resize', zIndex: 10 }} />
      </div>

      {/* 타입별 하단 행 */}
      <div style={{ height: FILTER_HEIGHT, width: col.width, boxSizing: 'border-box', borderRight: '1px solid rgba(61,26,46,0.12)', borderBottom: '1px solid rgba(61,26,46,0.12)', backgroundColor: '#faf8f4', display: 'flex', alignItems: 'center' }}>
        {col.type === 'dropdown' && (col.options?.length ?? 0) > 0 ? (
          <select
            value={filterValue}
            onChange={e => onFilterChange(e.target.value)}
            style={{ width: '100%', height: '100%', border: 'none', outline: 'none', padding: '0 4px', fontSize: 11, backgroundColor: 'transparent', color: filterValue ? '#3D1A2E' : 'rgba(61,26,46,0.4)', cursor: 'pointer' }}
          >
            <option value="">전체</option>
            {(col.options ?? []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : col.type === 'survey' ? (
          <span style={{ fontSize: 10, color: 'rgba(61,26,46,0.35)', padding: '0 6px', userSelect: 'none' }}>회신</span>
        ) : (
          <input
            value={filterValue}
            onChange={e => onFilterChange(e.target.value)}
            placeholder="필터..."
            style={{ width: '100%', height: '100%', border: 'none', outline: 'none', padding: '0 6px', fontSize: 11, backgroundColor: 'transparent', color: '#3D1A2E' }}
          />
        )}
      </div>

      {/* 필터/정렬 드롭다운 패널 */}
      {showFilter && (
        <div
          ref={filterRef}
          style={{
            position: 'absolute', top: HEADER_HEIGHT + FILTER_HEIGHT, left: 0, zIndex: 200,
            backgroundColor: '#fff', border: '1px solid rgba(61,26,46,0.15)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: 180, padding: '6px 0',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* 정렬 */}
          <div style={{ padding: '4px 12px 6px', borderBottom: '1px solid rgba(61,26,46,0.07)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#8B6A5A', letterSpacing: 0.4, textTransform: 'uppercase' }}>정렬</p>
            {([['asc', '오름차순 A→Z'], ['desc', '내림차순 Z→A'], [null, '정렬 해제']] as const).map(([dir, label]) => (
              <button
                key={String(dir)}
                onClick={() => { onSort(dir); setShowFilter(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  padding: '5px 6px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer',
                  color: sortDir === dir ? '#FF5C1A' : '#3D1A2E', borderRadius: 5,
                  fontWeight: sortDir === dir ? 600 : 400,
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,92,26,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {sortDir === dir && <span style={{ fontSize: 10 }}>✓</span>}
                {label}
              </button>
            ))}
          </div>

          {/* 값 필터 (text / survey) */}
          {col.type !== 'dropdown' && uniqueVals.length > 0 && (
            <div style={{ padding: '6px 12px', maxHeight: 160, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#8B6A5A', letterSpacing: 0.4, textTransform: 'uppercase' }}>값 필터</p>
                {selectedValues.length > 0 && (
                  <button onClick={() => onSelectedValuesChange([])} style={{ background: 'none', border: 'none', fontSize: 10, color: '#FF5C1A', cursor: 'pointer', padding: 0 }}>초기화</button>
                )}
              </div>
              {uniqueVals.map(v => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer', fontSize: 12, color: '#3D1A2E' }}>
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(v)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...selectedValues, v]
                        : selectedValues.filter(s => s !== v)
                      onSelectedValuesChange(next)
                    }}
                    style={{ accentColor: '#FF5C1A' }}
                  />
                  {v}
                </label>
              ))}
            </div>
          )}

          {/* 빈 값 포함 필터 */}
          <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(61,26,46,0.07)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#3D1A2E' }}>
              <input
                type="checkbox"
                checked={selectedValues.includes('__empty__')}
                onChange={e => {
                  const next = e.target.checked
                    ? [...selectedValues, '__empty__']
                    : selectedValues.filter(s => s !== '__empty__')
                  onSelectedValuesChange(next)
                }}
                style={{ accentColor: '#FF5C1A' }}
              />
              빈 값
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export const HEADER_TOTAL_HEIGHT = HEADER_HEIGHT + FILTER_HEIGHT
