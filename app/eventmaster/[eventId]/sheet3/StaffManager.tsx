'use client'

import { useState, useTransition } from 'react'
import type { StaffMember } from './types'
import { inviteStaff, updateStaffRole, removeStaff } from './actions'

type Props = {
  eventId: string
  staff: StaffMember[]
  onAlert: (msg: string, type?: 'warn' | 'error' | 'info') => void
}

const ROLE_LABEL: Record<StaffMember['role'], string> = {
  editor: '편집자',
  viewer: '뷰어',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function StaffManager({ eventId, staff: initialStaff, onAlert }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [isPending, startTransition] = useTransition()

  const handleInvite = () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      onAlert('유효한 이메일 주소를 입력해 주세요.', 'warn')
      return
    }
    if (staff.some(s => s.email === trimmed)) {
      onAlert('이미 초대된 이메일입니다.', 'warn')
      return
    }
    startTransition(async () => {
      try {
        const newMember = await inviteStaff(eventId, trimmed, role)
        setStaff(prev => [...prev, newMember])
        setEmail('')
        onAlert(`${trimmed}에게 초대장을 발송했습니다.`, 'info')
      } catch {
        onAlert('초대 중 오류가 발생했습니다.', 'error')
      }
    })
  }

  const handleRoleChange = (id: string, newRole: 'editor' | 'viewer') => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, role: newRole } : s))
    startTransition(async () => {
      try {
        await updateStaffRole(id, newRole)
      } catch {
        onAlert('역할 변경에 실패했습니다.', 'error')
      }
    })
  }

  const handleRemove = (id: string, memberEmail: string) => {
    if (!confirm(`"${memberEmail}" 스태프의 접근을 취소할까요?`)) return
    setStaff(prev => prev.filter(s => s.id !== id))
    startTransition(async () => {
      try {
        await removeStaff(id)
        onAlert('스태프 접근이 취소되었습니다.', 'info')
      } catch {
        onAlert('접근 취소에 실패했습니다.', 'error')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 초대 폼 */}
      <div style={{
        border: '1px solid rgba(61,26,46,0.12)',
        borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(61,26,46,0.08)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#3D1A2E', margin: 0 }}>스태프 초대</p>
          <p style={{ fontSize: 11, color: '#8B6A5A', margin: '3px 0 0' }}>
            이메일로 초대하면 해당 사용자가 이 이벤트에 접근할 수 있습니다.
          </p>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            placeholder="이메일 주소 입력"
            style={{
              flex: '1 1 200px', padding: '9px 12px', fontSize: 13, borderRadius: 8,
              border: '1.5px solid rgba(61,26,46,0.15)', outline: 'none', color: '#3D1A2E',
            }}
            onFocus={e => (e.target.style.borderColor = '#D94F35')}
            onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.15)')}
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as 'editor' | 'viewer')}
            style={{
              padding: '9px 12px', fontSize: 13, borderRadius: 8, flexShrink: 0,
              border: '1.5px solid rgba(61,26,46,0.15)', outline: 'none', color: '#3D1A2E',
              backgroundColor: '#fff', cursor: 'pointer',
            }}
            onFocus={e => (e.target.style.borderColor = '#D94F35')}
            onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.15)')}
          >
            <option value="viewer">뷰어</option>
            <option value="editor">편집자</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={isPending || !email.trim()}
            style={{
              padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: 'none', flexShrink: 0,
              cursor: isPending || !email.trim() ? 'not-allowed' : 'pointer',
              backgroundColor: email.trim() ? '#D94F35' : 'rgba(61,26,46,0.1)',
              color: email.trim() ? '#fff' : '#8B6A5A',
            }}
          >
            {isPending ? '초대 중...' : '초대'}
          </button>
        </div>

        {/* 역할 안내 */}
        <div style={{ padding: '0 18px 14px', display: 'flex', gap: 16 }}>
          {[
            { role: '편집자', desc: '게스트 편집, 초대장 발송, 설정 변경 가능' },
            { role: '뷰어', desc: '게스트 목록과 이력 조회만 가능' },
          ].map(item => (
            <div key={item.role} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', whiteSpace: 'nowrap', marginTop: 1 }}>
                {item.role}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(61,26,46,0.5)', lineHeight: 1.4 }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 스태프 목록 */}
      {staff.length > 0 ? (
        <div style={{
          border: '1px solid rgba(61,26,46,0.12)',
          borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(61,26,46,0.08)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#3D1A2E', margin: 0 }}>
              현재 스태프 ({staff.length}명)
            </p>
          </div>
          {staff.map((member, i) => (
            <div
              key={member.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px',
                borderBottom: i < staff.length - 1 ? '1px solid rgba(61,26,46,0.06)' : 'none',
              }}
            >
              {/* 아바타 */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                backgroundColor: 'rgba(61,26,46,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#8B6A5A',
              }}>
                {member.email[0].toUpperCase()}
              </div>

              {/* 이메일 + 초대일 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#3D1A2E', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.email}
                </p>
                <p style={{ fontSize: 11, color: '#8B6A5A', margin: '2px 0 0' }}>
                  {member.accepted_at ? `수락 · ${formatDate(member.accepted_at)}` : `초대 발송 · ${formatDate(member.invited_at)}`}
                </p>
              </div>

              {/* 역할 선택 */}
              <select
                value={member.role}
                onChange={e => handleRoleChange(member.id, e.target.value as 'editor' | 'viewer')}
                style={{
                  padding: '5px 10px', fontSize: 12, borderRadius: 6, flexShrink: 0,
                  border: '1px solid rgba(61,26,46,0.15)', outline: 'none', color: '#3D1A2E',
                  backgroundColor: '#faf8f4', cursor: 'pointer',
                }}
              >
                <option value="viewer">뷰어</option>
                <option value="editor">편집자</option>
              </select>

              {/* 수락 상태 배지 + 미수락 시 초대 링크 복사 */}
              {member.accepted_at ? (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 9999, flexShrink: 0,
                  backgroundColor: 'rgba(34,197,94,0.1)', color: '#16A34A', fontWeight: 600,
                }}>
                  수락됨
                </span>
              ) : (
                <button
                  title="초대 링크 복사"
                  onClick={() => {
                    const url = `${window.location.origin}/staff-invite/${member.id}`
                    navigator.clipboard.writeText(url).then(() => {
                      onAlert(`초대 링크가 복사되었습니다. ${member.email}에 전달해 주세요.`, 'info')
                    })
                  }}
                  style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 9999, flexShrink: 0,
                    backgroundColor: 'rgba(234,179,8,0.1)', color: '#A16207', fontWeight: 600,
                    border: '1px solid rgba(234,179,8,0.25)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.1)'
                  }}
                >
                  🔗 링크 복사
                </button>
              )}

              {/* 삭제 */}
              <button
                onClick={() => handleRemove(member.id, member.email)}
                title="접근 취소"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'rgba(61,26,46,0.3)', padding: '4px 6px', flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#D94F35')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(61,26,46,0.3)')}
              >✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          border: '1px dashed rgba(61,26,46,0.15)', borderRadius: 12,
          padding: '28px 0', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: '#8B6A5A', margin: 0 }}>아직 초대된 스태프가 없습니다.</p>
        </div>
      )}
    </div>
  )
}
