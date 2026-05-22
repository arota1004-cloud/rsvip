'use client'

import { useState } from 'react'
import type { Invitation } from './actions'

type Props = {
  invitations: Invitation[]
  activeId: string
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export default function VariationList({ invitations, activeId, onSelect, onRename, onDuplicate, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([invitations[0]?.id]))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const commitRename = (id: string) => {
    if (editName.trim()) onRename(id, editName.trim())
    setEditingId(null)
    setEditName('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {invitations.map(inv => {
        const isExpanded = expanded.has(inv.id)
        const isActive = inv.id === activeId

        return (
          <div key={inv.id} style={{
            border: `1px solid ${isActive ? '#D94F35' : 'rgba(61,26,46,0.1)'}`,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: '#fff',
          }}>
            {/* 헤더 행 */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', cursor: 'pointer',
                backgroundColor: isActive ? 'rgba(217,79,53,0.04)' : 'transparent',
              }}
              onClick={() => { onSelect(inv.id); toggle(inv.id) }}
            >
              {/* 접기/펼치기 아이콘 (Excel 그룹화 UX) */}
              <span style={{ fontSize: 10, color: '#8B6A5A', width: 12, flexShrink: 0, userSelect: 'none' }}>
                {isExpanded ? '▾' : '▸'}
              </span>

              {/* 이름 */}
              {editingId === inv.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => commitRename(inv.id)}
                  onKeyDown={e => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commitRename(inv.id)
                    if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '2px 6px', borderRadius: 4, border: '1.5px solid #D94F35', outline: 'none', color: '#3D1A2E' }}
                />
              ) : (
                <span
                  onDoubleClick={e => { e.stopPropagation(); setEditingId(inv.id); setEditName(inv.name) }}
                  style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#D94F35' : '#3D1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {inv.name}
                </span>
              )}

              {/* 필터 조건 수 배지 */}
              {inv.filter_rules.length > 0 && (
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, backgroundColor: 'rgba(61,26,46,0.07)', color: '#8B6A5A', flexShrink: 0 }}>
                  필터 {inv.filter_rules.length}
                </span>
              )}

              {/* 액션 버튼들 */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <IconBtn title="복제" onClick={() => onDuplicate(inv.id)}>⧉</IconBtn>
                {invitations.length > 1 && (
                  <IconBtn title="삭제" onClick={() => { if (confirm(`"${inv.name}"을 삭제할까요?`)) onDelete(inv.id) }} danger>✕</IconBtn>
                )}
              </div>
            </div>

            {/* 접기 인디케이터 (Excel 좌측 접기선 UX) */}
            {!isExpanded && (
              <div style={{ height: 3, backgroundColor: 'rgba(61,26,46,0.04)', borderTop: '1px solid rgba(61,26,46,0.06)' }} />
            )}
          </div>
        )
      })}

      {/* 새 초대장 추가 */}
      <button
        onClick={() => {
          const firstName = invitations[0]
          if (firstName) onDuplicate(firstName.id)
        }}
        style={{
          padding: '7px 0', fontSize: 12, color: '#8B6A5A',
          background: 'none', border: '1px dashed rgba(61,26,46,0.2)',
          borderRadius: 8, cursor: 'pointer', width: '100%',
          marginTop: 4,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#D94F35'; e.currentTarget.style.color = '#D94F35' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,26,46,0.2)'; e.currentTarget.style.color = '#8B6A5A' }}
      >
        + 배리에이션 추가
      </button>
    </div>
  )
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 5px', borderRadius: 4, fontSize: 13, lineHeight: 1,
        color: danger ? 'rgba(217,79,53,0.4)' : 'rgba(61,26,46,0.35)',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = danger ? '#D94F35' : '#3D1A2E'; e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.color = danger ? 'rgba(217,79,53,0.4)' : 'rgba(61,26,46,0.35)'; e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {children}
    </button>
  )
}
