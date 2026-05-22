'use client'

import type { EventSettings } from './actions'

type Props = {
  settings: EventSettings
  onChange: (settings: EventSettings) => void
}

type Step = {
  key: keyof EventSettings
  title: string
  description: string
  icon: string
  dependsOn?: keyof EventSettings
}

const STEPS: Step[] = [
  {
    key: 'invitationEnabled',
    title: '초대장 발송',
    description: '게스트 목록에 등록된 대상에게 이메일·링크로 초대장을 발송합니다.',
    icon: '✉️',
  },
  {
    key: 'rsvpEnabled',
    title: 'RSVP 수집',
    description: '초대장 링크를 통해 참석 여부와 추가 정보를 수집합니다.',
    icon: '📋',
    dependsOn: 'invitationEnabled',
  },
  {
    key: 'confirmedInviteEnabled',
    title: '확정 초대장 발송',
    description: 'RSVP 응답 후 참석 확정자에게 최종 안내장을 발송합니다.',
    icon: '✅',
    dependsOn: 'rsvpEnabled',
  },
  {
    key: 'qrCheckinEnabled',
    title: 'QR 체크인',
    description: '현장에서 QR 코드로 게스트 체크인을 처리합니다.',
    icon: '📱',
    dependsOn: 'invitationEnabled',
  },
  {
    key: 'postEventEnabled',
    title: '행사 후 안내',
    description: '행사 종료 후 참석자에게 감사 메시지와 자료를 발송합니다.',
    icon: '🎊',
    dependsOn: 'invitationEnabled',
  },
]

export default function SettingsFlow({ settings, onChange }: Props) {
  const isEnabled = (step: Step): boolean => {
    if (!step.dependsOn) return true
    return settings[step.dependsOn]
  }

  const toggle = (key: keyof EventSettings) => {
    const next = { ...settings, [key]: !settings[key] }

    // 부모가 꺼지면 자식도 강제로 끔
    if (!next[key]) {
      STEPS.forEach(s => {
        if (s.dependsOn === key) next[s.key] = false
      })
    }
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {STEPS.map((step, i) => {
        const active = settings[step.key]
        const available = isEnabled(step)

        return (
          <div
            key={step.key}
            style={{
              borderRadius: 12,
              border: `1px solid ${active ? 'rgba(217,79,53,0.3)' : available ? 'rgba(61,26,46,0.12)' : 'rgba(61,26,46,0.06)'}`,
              backgroundColor: active ? 'rgba(217,79,53,0.03)' : available ? '#fff' : '#faf8f4',
              opacity: available ? 1 : 0.55,
              overflow: 'hidden',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 14 }}>
              {/* 단계 번호 + 아이콘 */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                backgroundColor: active ? 'rgba(217,79,53,0.1)' : 'rgba(61,26,46,0.06)',
              }}>
                {step.icon}
              </div>

              {/* 텍스트 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#8B6A5A',
                    letterSpacing: 0.5,
                  }}>
                    STEP {i + 1}
                  </span>
                  {!available && (
                    <span style={{ fontSize: 10, color: '#8B6A5A', padding: '1px 6px', borderRadius: 9999, backgroundColor: 'rgba(61,26,46,0.07)' }}>
                      이전 단계 필요
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: active ? '#D94F35' : available ? '#3D1A2E' : '#8B6A5A', margin: '0 0 3px' }}>
                  {step.title}
                </p>
                <p style={{ fontSize: 12, color: '#8B6A5A', margin: 0, lineHeight: 1.5 }}>
                  {step.description}
                </p>
              </div>

              {/* 토글 */}
              <button
                role="switch"
                aria-checked={active}
                disabled={!available}
                onClick={() => available && toggle(step.key)}
                style={{
                  position: 'relative', width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                  backgroundColor: active ? '#D94F35' : 'rgba(61,26,46,0.18)',
                  border: 'none', cursor: available ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 4, left: active ? 24 : 4,
                  width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: '#fff', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>

            {/* 활성 상태 추가 정보 */}
            {active && step.key === 'rsvpEnabled' && (
              <div style={{
                padding: '8px 18px 12px 72px',
                borderTop: '1px solid rgba(61,26,46,0.06)',
              }}>
                <p style={{ fontSize: 11, color: '#D94F35', margin: 0, fontWeight: 600 }}>
                  RSVP 추가 질문은 시트2 → RSVP 설정에서 구성할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
