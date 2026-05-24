'use client'

import { useRef, useEffect } from 'react'
import type { Column } from './actions'

const RSVP_COLORS: Record<string, { bg: string; text: string }> = {
  Y: { bg: 'rgba(34,197,94,0.15)',   text: '#15803d' },
  N: { bg: 'rgba(239,68,68,0.12)',   text: '#dc2626' },
  U: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
}

const RSVP_LABELS: Record<string, string> = {
  Y: '참석',
  N: '불참',
  U: '미정',
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
  onDirectChange?: (v: string) => void   // dropdown/survey 직접 변경 (edit mode 불필요)
  onMouseDown: (e: React.MouseEvent) => void
  onMouseEnter: () => void
  onDoubleClick: () => void
  width: number
  rowHeight: number
}

export default function Cell({
  value, isEditing, isSelected, isAnchor,
  colType, colOptions,
  editValue, onEditChange, onDirectChange,
  onMouseDown, onMouseEnter, onDoubleClick,
  width, rowHeight,
}: Props) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  // 텍스트 편집 모드 진입 시 자동 포커스
  useEffect(() => {
    if (isEditing && colType === 'text') inputRef.current?.focus()
  }, [isEditing, colType])

  const borderStyle = isAnchor
    ? '2px solid #FF5C1A'
    : isSelected
    ? '1px solid rgba(255,92,26,0.3)'
    : '1px solid transparent'

  const bgStyle = isAnchor
    ? 'rgba(255,92,26,0.04)'
    : isSelected
    ? 'rgba(255,92,26,0.07)'
    : 'transparent'

  // ── dropdown / survey: 항상 <select> 렌더링 ─────────────────────────────────
  // (edit mode / display mode 구분 없이 단일 클릭으로 바로 선택 가능)
  if (colType === 'survey' || colType === 'dropdown') {
    const opts = colType === 'survey'
      ? [
          { value: '',  label: '—' },
          { value: 'Y', label: 'Y — 참석' },
          { value: 'N', label: 'N — 불참' },
          { value: 'U', label: 'U — 미정' },
        ]
      : [
          { value: '', label: '선택...' },
          ...(colOptions ?? []).map(o => ({ value: o, label: o })),
        ]

    const rsvpStyle = colType === 'survey' && value ? RSVP_COLORS[value] ?? null : null

    return (
      <div
        onMouseEnter={onMouseEnter}
        onDoubleClick={onDoubleClick}
        // select를 클릭할 때는 preventDefault를 하지 않아야 네이티브 드롭다운이 열림
        // → SpreadsheetGrid의 onMouseDown이 HTMLSelectElement를 감지해 처리
        onMouseDown={onMouseDown}
        style={{
          width, height: rowHeight, boxSizing: 'border-box',
          border: borderStyle,
          backgroundColor: rsvpStyle ? rsvpStyle.bg : bgStyle,
          position: 'relative',
          display: 'flex', alignItems: 'center',
        }}
      >
        {/* 선택된 값 배지 (포인터 이벤트 없음 → select가 클릭 수신) */}
        {rsvpStyle && value ? (
          <span style={{
            pointerEvents: 'none',
            position: 'absolute', left: 6,
            fontSize: 11, padding: '1px 7px', borderRadius: 9999,
            backgroundColor: rsvpStyle.bg, color: rsvpStyle.text, fontWeight: 700,
            zIndex: 1,
          }}>
            {value} — {RSVP_LABELS[value]}
          </span>
        ) : value ? (
          <span style={{
            pointerEvents: 'none',
            position: 'absolute', left: 6,
            fontSize: 11, padding: '1px 7px', borderRadius: 9999,
            backgroundColor: 'rgba(61,26,46,0.07)', color: '#3D1A2E',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: width - 30, zIndex: 1,
          }}>
            {value}
          </span>
        ) : (
          <span style={{
            pointerEvents: 'none',
            position: 'absolute', left: 6,
            fontSize: 11, color: 'rgba(61,26,46,0.3)',
            zIndex: 1,
          }}>
            {colType === 'survey' ? '선택' : '선택...'}
          </span>
        )}

        {/* 투명 select — 항상 오버레이로 클릭 수신 */}
        <select
          ref={selectRef}
          value={value}
          onChange={e => onDirectChange?.(e.target.value)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            opacity: 0,           // 완전 투명: 배지는 위 span이 표시
            cursor: 'pointer',
            border: 'none', outline: 'none',
            zIndex: 2,            // span 위에서 클릭 수신
          }}
        >
          {opts.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* ▼ 드롭다운 화살표 */}
        <span style={{
          position: 'absolute', right: 4, top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 8, color: 'rgba(61,26,46,0.4)',
          pointerEvents: 'none', zIndex: 1,
        }}>▼</span>
      </div>
    )
  }

  // ── 텍스트: 편집 모드 ─────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div style={{ width, height: rowHeight, boxSizing: 'border-box', border: '2px solid #FF5C1A', backgroundColor: '#fff' }}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          style={{
            width: '100%', height: '100%', padding: '0 6px',
            fontSize: 12, border: 'none', outline: 'none',
            backgroundColor: 'transparent', color: '#3D1A2E',
          }}
        />
      </div>
    )
  }

  // ── 텍스트: 표시 모드 ─────────────────────────────────────────────────────────
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
      style={{
        width, height: rowHeight, boxSizing: 'border-box',
        border: borderStyle,
        backgroundColor: bgStyle,
        padding: '0 6px', fontSize: 12, color: '#3D1A2E',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden', whiteSpace: 'nowrap',
        cursor: 'default', userSelect: 'none',
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  )
}
