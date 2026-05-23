'use client'

import { useState, useEffect, useCallback } from 'react'
import type { EventSettings, StaffMember } from './types'
import { DEFAULT_SETTINGS } from './types'
import { loadSheet3, updateSettings } from './actions'
import SettingsFlow from './SettingsFlow'
import StaffManager from './StaffManager'

type Props = {
  eventId: string
  onAlert: (msg: string, type?: 'warn' | 'error' | 'info') => void
  onSettingsChange?: (settings: EventSettings) => void
}

export default function Sheet3({ eventId, onAlert, onSettingsChange }: Props) {
  const [settings, setSettings] = useState<EventSettings>({ ...DEFAULT_SETTINGS })
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'flow' | 'staff'>('flow')
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadSheet3(eventId).then(data => {
      setSettings(data.settings)
      setStaff(data.staff)
      setLoading(false)
    })
  }, [eventId])

  const handleSettingsChange = useCallback((next: EventSettings) => {
    setSettings(next)
    onSettingsChange?.(next)   // 부모(EventMasterClient)로 즉시 전파 → Sheet2 연동
    if (saveTimer) clearTimeout(saveTimer)
    const t = setTimeout(async () => {
      try {
        await updateSettings(eventId, next)
      } catch {
        onAlert('설정 저장에 실패했습니다.', 'error')
      }
    }, 600)
    setSaveTimer(t)
  }, [eventId, saveTimer, onAlert, onSettingsChange])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: '#8B6A5A' }}>
        불러오는 중...
      </div>
    )
  }

  const activeCount = Object.values(settings).filter(Boolean).length

  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: '#F5F0E8' }}>
      {/* 사이드바 내비게이션 */}
      <div style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid rgba(61,26,46,0.1)',
        backgroundColor: '#faf8f4',
        display: 'flex', flexDirection: 'column',
        padding: '16px 10px',
        gap: 4,
      }}>
        <NavItem
          label="기능 설정"
          icon="⚙"
          active={activeSection === 'flow'}
          badge={activeCount > 0 ? `${activeCount}개 활성` : undefined}
          onClick={() => setActiveSection('flow')}
        />
        <NavItem
          label="스태프 관리"
          icon="👥"
          active={activeSection === 'staff'}
          badge={staff.length > 0 ? `${staff.length}명` : undefined}
          onClick={() => setActiveSection('staff')}
        />
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {activeSection === 'flow' && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#3D1A2E', margin: '0 0 6px' }}>
                기능 설정
              </h2>
              <p style={{ fontSize: 12, color: '#8B6A5A', margin: 0, lineHeight: 1.5 }}>
                이벤트에서 사용할 기능을 단계적으로 활성화하세요.
                이전 단계가 켜져 있어야 다음 단계를 활성화할 수 있습니다.
              </p>
            </div>
            <SettingsFlow settings={settings} onChange={handleSettingsChange} />
          </div>
        )}

        {activeSection === 'staff' && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#3D1A2E', margin: '0 0 6px' }}>
                스태프 관리
              </h2>
              <p style={{ fontSize: 12, color: '#8B6A5A', margin: 0, lineHeight: 1.5 }}>
                이벤트 관리에 참여할 스태프를 이메일로 초대하고 역할을 지정하세요.
              </p>
            </div>
            <StaffManager
              eventId={eventId}
              staff={staff}
              onAlert={onAlert}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function NavItem({ label, icon, active, badge, onClick }: {
  label: string
  icon: string
  active: boolean
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 12px', borderRadius: 8, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        backgroundColor: active ? 'rgba(217,79,53,0.08)' : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.05)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#D94F35' : '#3D1A2E' }}>
        {label}
      </span>
      {badge && (
        <span style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 9999, flexShrink: 0,
          backgroundColor: active ? 'rgba(217,79,53,0.15)' : 'rgba(61,26,46,0.08)',
          color: active ? '#D94F35' : '#8B6A5A', fontWeight: 600,
        }}>
          {badge}
        </span>
      )}
    </button>
  )
}
