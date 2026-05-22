'use client'

import { useRef, useEffect } from 'react'
import type { Column } from './actions'

const RSVP_COLORS: Record<string, { bg: string; text: string }> = {
  Y: { bg: 'rgba(34,197,94,0.15)',   text: '#15803d' },
  N: { bg: 'rgba(239,68,68,0.12)',   text: '#dc2626' },
  U: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
}

type Props = {
  value: string
  isEditing: boolean
  isSelected: boolean
  isAnchor: boolean
  colType: Column['type']
  colOptions?: string[]
  editValue: string
  onEditChange: (v: string) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseEnter: () => void
  onDoubleClick: () => void
  width: number
  rowHeight: number
}

export default function Cell({
  value, isEditing, isSelected, isAnchor,
  colType, colOptions,
  editValue, onEditChange, onMouseDown, onMouseEnter, onDoubleClick,
  width, rowHeight,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      selectRef.current?.focus()
    }
  }, [isEditing])

  const borderStyle = isAnchor
    ? '2px solid #D94F35'
    : isSelected
    ? '1px solid rgba(217,79,53,0.3)'
    : '1px solid transparent'

  const bgStyle = isAnchor
    ? 'rgba(217,79,53,0.04)'
    : isSelected
    ? 'rgba(217,79,53,0.07)'
    : 'transparent'

  // 편집 모드 — select (rsvp / dropdown)
  if (isEditing && (colType === 'survey' || colType === 'dropdown')) {
    const options = colType === 'survey'
      ? [{ value: '', label: '-' }, { value: 'Y', label: 'Y — 참석' }, { value: 'N', label: 'N — 불참' }, { value: 'U', label: 'U — 미정' }]
      : [{ value: '', label: '선택...' }, ...(colOptions ?? []).map(o => ({ value: o, label: o }))]

    return (
      <div style={{ width, height: rowHeight, boxSizing: 'border-box', border: '2px solid #D94F35' }}>
        <select
          ref={selectRef}
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          style={{ width: '100%', height: '100%', padding: '0 4px', fontSize: 12, border: 'none', outline: 'none', backgroundColor: '#fff', color: '#3D1A2E', cursor: 'pointer' }}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }

  // 편집 모드 — text
  if (isEditing) {
    return (
      <div style={{ width, height: rowHeight, boxSizing: 'border-box', border: '2px solid #D94F35', backgroundColor: '#fff' }}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          style={{ width: '100%', height: '100%', padding: '0 6px', fontSize: 12, border: 'none', outline: 'none', backgroundColor: 'transparent', color: '#3D1A2E' }}
        />
      </div>
    )
  }

  // 표시 모드 — RSVP 배지
  const rsvpStyle = colType === 'survey' && value && RSVP_COLORS[value] ? RSVP_COLORS[value] : null

  // 표시 모드 — dropdown 값 (배지)
  const isDropdown = colType === 'dropdown' && value

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
      style={{
        width, height: rowHeight, boxSizing: 'border-box',
        border: borderStyle,
        backgroundColor: rsvpStyle ? rsvpStyle.bg : bgStyle,
        padding: '0 6px', fontSize: 12,
        color: rsvpStyle ? rsvpStyle.text : '#3D1A2E',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden', whiteSpace: 'nowrap',
        cursor: 'default', userSelect: 'none',
        fontWeight: rsvpStyle ? 600 : 400,
        position: 'relative',
      }}
    >
      {rsvpStyle ? (
        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 9999, backgroundColor: rsvpStyle.bg }}>
          {value}
        </span>
      ) : isDropdown ? (
        <span style={{ flex: 1, fontSize: 11, padding: '1px 7px', borderRadius: 9999, backgroundColor: 'rgba(61,26,46,0.07)', color: '#3D1A2E', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </span>
      ) : (
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      )}
      {colType === 'dropdown' && (
        <span style={{ flexShrink: 0, fontSize: 8, color: 'rgba(61,26,46,0.35)', marginLeft: 2, lineHeight: 1 }}>▼</span>
      )}
    </div>
  )
}
