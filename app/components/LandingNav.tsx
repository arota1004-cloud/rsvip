'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from '@/app/auth/actions'

type UserEvent = {
  id: string
  name: string
  dates: string[]
  created_at: string
}

type Props = {
  isLoggedIn: false
} | {
  isLoggedIn: true
  user: {
    name: string
    email: string
    avatarUrl?: string
  }
  events: UserEvent[]
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function LandingNav(props: Props) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <nav className="flex items-center justify-between px-8 py-6">
      <Link href="/" className="text-xl font-bold tracking-tight" style={{ color: '#D94F35' }}>
        RSViP
      </Link>

      {!props.isLoggedIn ? (
        <Link
          href="/auth"
          className="text-sm font-medium px-5 py-2 rounded-full transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#D94F35', color: '#F5F0E8' }}
        >
          로그인
        </Link>
      ) : (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          {/* 프로필 버튼 */}
          <button
            onClick={() => setOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '6px 14px 6px 6px',
              borderRadius: 9999,
              border: `1.5px solid ${open ? '#D94F35' : 'rgba(61,26,46,0.15)'}`,
              background: open ? 'rgba(217,79,53,0.04)' : '#fff',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <Avatar name={props.user.name} avatarUrl={props.user.avatarUrl} size={30} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#3D1A2E', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {props.user.name}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#8B6A5A', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* 드롭다운 패널 */}
          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 300, zIndex: 50,
              backgroundColor: '#fff',
              border: '1px solid rgba(61,26,46,0.12)',
              borderRadius: 14,
              boxShadow: '0 8px 32px rgba(61,26,46,0.12)',
              overflow: 'hidden',
            }}>
              {/* 유저 정보 */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(61,26,46,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={props.user.name} avatarUrl={props.user.avatarUrl} size={38} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#3D1A2E', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {props.user.name}
                  </p>
                  <p style={{ fontSize: 11, color: '#8B6A5A', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {props.user.email}
                  </p>
                </div>
              </div>

              {/* 이벤트 목록 헤더 */}
              <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  나의 이벤트
                </span>
                <Link
                  href="/eventgenerate"
                  onClick={() => setOpen(false)}
                  style={{ fontSize: 11, fontWeight: 600, color: '#D94F35', textDecoration: 'none' }}
                >
                  + 새 이벤트
                </Link>
              </div>

              {/* 이벤트 리스트 */}
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {props.events.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: '#8B6A5A', margin: '0 0 10px' }}>아직 생성한 이벤트가 없습니다.</p>
                    <Link
                      href="/eventgenerate"
                      onClick={() => setOpen(false)}
                      style={{
                        display: 'inline-block', fontSize: 12, fontWeight: 600,
                        padding: '7px 16px', borderRadius: 8,
                        backgroundColor: '#D94F35', color: '#fff', textDecoration: 'none',
                      }}
                    >
                      첫 이벤트 만들기
                    </Link>
                  </div>
                ) : (
                  props.events.map(event => (
                    <Link
                      key={event.id}
                      href={`/eventmaster/${event.id}`}
                      onClick={() => setOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', textDecoration: 'none',
                        borderBottom: '1px solid rgba(61,26,46,0.05)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(217,79,53,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* 이벤트 아이콘 */}
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        backgroundColor: 'rgba(217,79,53,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15,
                      }}>
                        🎪
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#3D1A2E', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {event.name}
                        </p>
                        <p style={{ fontSize: 11, color: '#8B6A5A', margin: '2px 0 0' }}>
                          {event.dates.length > 0 ? event.dates[0] : formatDate(event.created_at)}
                        </p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 'auto', color: 'rgba(61,26,46,0.25)', flexShrink: 0 }}>
                        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  ))
                )}
              </div>

              {/* 하단: 로그아웃 */}
              <div style={{ borderTop: '1px solid rgba(61,26,46,0.08)', padding: '8px 8px' }}>
                <form action={signOut}>
                  <button
                    type="submit"
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12,
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: '#8B6A5A', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.05)'; e.currentTarget.style.color = '#3D1A2E' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8B6A5A' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    로그아웃
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}

function Avatar({ name, avatarUrl, size }: { name: string; avatarUrl?: string; size: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: '#D94F35',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: '#fff',
      userSelect: 'none',
    }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}
