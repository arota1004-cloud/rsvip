'use client'

import { useState } from 'react'
import type { EventSettings } from './types'

type Props = {
  settings: EventSettings
  onChange: (settings: EventSettings) => void
}

// ─── 단계 정의 ────────────────────────────────────────────────────────────────
type Step = {
  enabledKey: keyof EventSettings
  title: string
  description: string
  icon: string
  dependsOn?: keyof EventSettings
}

const STEPS: Step[] = [
  {
    enabledKey: 'invitationEnabled',
    title: '초대장 발송',
    description: '게스트 목록에 등록된 대상에게 초대장을 발송합니다.',
    icon: '✉️',
  },
  {
    enabledKey: 'rsvpEnabled',
    title: 'RSVP 수집',
    description: '초대장 링크를 통해 참석 여부와 추가 정보를 수집합니다.',
    icon: '📋',
    dependsOn: 'invitationEnabled',
  },
  {
    enabledKey: 'confirmedInviteEnabled',
    title: '확정 초대장 발송 (QR)',
    description: '참석 확정자에게 QR 코드가 담긴 최종 안내장을 발송합니다.',
    icon: '✅',
    dependsOn: 'rsvpEnabled',
  },
  {
    enabledKey: 'qrCheckinEnabled',
    title: 'QR 체크인',
    description: '현장에서 QR 코드로 게스트 체크인을 처리합니다.',
    icon: '📱',
    dependsOn: 'invitationEnabled',
  },
  {
    enabledKey: 'postEventEnabled',
    title: '사후 자료 요청',
    description: '행사 종료 후 참석자에게 감사 메시지와 자료를 발송합니다.',
    icon: '🎊',
    dependsOn: 'invitationEnabled',
  },
]

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      style={{
        position: 'relative', width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        backgroundColor: on ? '#D94F35' : 'rgba(61,26,46,0.18)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 4, left: on ? 24 : 4,
        width: 16, height: 16, borderRadius: '50%',
        backgroundColor: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function SubRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: '#8B6A5A', whiteSpace: 'nowrap', minWidth: 100, paddingTop: 6 }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          disabled={opt.disabled}
          onClick={() => !opt.disabled && onChange(opt.value)}
          style={{
            padding: '4px 12px', fontSize: 12, borderRadius: 9999,
            border: `1px solid ${value === opt.value ? '#D94F35' : 'rgba(61,26,46,0.18)'}`,
            backgroundColor: value === opt.value ? 'rgba(217,79,53,0.08)' : '#fff',
            color: opt.disabled
              ? 'rgba(61,26,46,0.3)'
              : value === opt.value ? '#D94F35' : '#3D1A2E',
            fontWeight: value === opt.value ? 700 : 400,
            cursor: opt.disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function DateInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="datetime-local"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontSize: 12, padding: '4px 10px', borderRadius: 8,
        border: '1px solid rgba(61,26,46,0.2)',
        backgroundColor: '#faf8f4', color: '#3D1A2E',
        outline: 'none', width: '100%', maxWidth: 220,
      }}
    />
  )
}

function SmallToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative', width: 36, height: 20, borderRadius: 10,
        backgroundColor: on ? '#D94F35' : 'rgba(61,26,46,0.18)',
        border: 'none', cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 19 : 3,
        width: 14, height: 14, borderRadius: '50%',
        backgroundColor: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ─── 서브 설정 섹션 ────────────────────────────────────────────────────────────
function Step1Sub({ s, onChange }: { s: EventSettings; onChange: (s: EventSettings) => void }) {
  return (
    <div>
      <SubRow label="발송 채널">
        <RadioGroup
          value={s.invitationChannel}
          options={[
            { value: 'email' as const, label: '📧 이메일' },
            { value: 'link' as const, label: '🔗 링크' },
            { value: 'sms' as const, label: '💬 SMS', disabled: true },
          ]}
          onChange={v => onChange({ ...s, invitationChannel: v })}
        />
      </SubRow>
      <SubRow label="발송 시점">
        <RadioGroup
          value={s.invitationTiming}
          options={[
            { value: 'immediate' as const, label: '즉시 발송' },
            { value: 'scheduled' as const, label: '예약 발송' },
          ]}
          onChange={v => onChange({ ...s, invitationTiming: v })}
        />
        {s.invitationTiming === 'scheduled' && (
          <div style={{ marginTop: 8 }}>
            <DateInput
              value={s.invitationScheduledAt}
              onChange={v => onChange({ ...s, invitationScheduledAt: v })}
              placeholder="발송 예약 시각"
            />
          </div>
        )}
      </SubRow>
    </div>
  )
}

function Step2Sub({ s, onChange }: { s: EventSettings; onChange: (s: EventSettings) => void }) {
  return (
    <div>
      <SubRow label="RSVP 마감일">
        <DateInput
          value={s.rsvpDeadline}
          onChange={v => onChange({ ...s, rsvpDeadline: v })}
          placeholder="마감 일시 선택"
        />
      </SubRow>
      <SubRow label="미응답자 리마인드">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SmallToggle on={s.rsvpReminder} onChange={v => onChange({ ...s, rsvpReminder: v })} />
          <span style={{ fontSize: 12, color: s.rsvpReminder ? '#D94F35' : '#8B6A5A' }}>
            {s.rsvpReminder ? 'ON — 마감 48시간 전 자동 리마인드' : 'OFF'}
          </span>
        </div>
      </SubRow>
      <div style={{ fontSize: 11, color: '#8B6A5A', marginTop: 2 }}>
        💡 RSVP 추가 질문은 시트2 → RSVP 설정에서 구성할 수 있습니다.
      </div>
    </div>
  )
}

function Step3Sub({ s, onChange }: { s: EventSettings; onChange: (s: EventSettings) => void }) {
  return (
    <div>
      <SubRow label="발송 방식">
        <RadioGroup
          value={s.confirmedInviteMethod}
          options={[
            { value: 'auto_qr' as const, label: 'QR 자동 발송' },
            { value: 'scheduled' as const, label: '지정 일정 발송' },
          ]}
          onChange={v => onChange({ ...s, confirmedInviteMethod: v })}
        />
      </SubRow>
      {s.confirmedInviteMethod === 'scheduled' && (
        <SubRow label="발송 시점">
          <DateInput
            value={s.confirmedInviteScheduledAt}
            onChange={v => onChange({ ...s, confirmedInviteScheduledAt: v })}
            placeholder="발송 예약 시각"
          />
        </SubRow>
      )}
      <div style={{ fontSize: 11, color: '#8B6A5A', marginTop: 2 }}>
        💡 QR 코드는 시트2 초대장 에디터에서 {'{ QR }'} 토큰으로 삽입할 수 있습니다.
      </div>
    </div>
  )
}

function Step4Sub({ s, onChange }: { s: EventSettings; onChange: (s: EventSettings) => void }) {
  return (
    <div>
      <SubRow label="체크인 담당자">
        <input
          type="text"
          value={s.qrCheckinManager}
          onChange={e => onChange({ ...s, qrCheckinManager: e.target.value })}
          placeholder="담당자 이름 또는 연락처"
          style={{
            fontSize: 12, padding: '5px 10px', borderRadius: 8,
            border: '1px solid rgba(61,26,46,0.2)',
            backgroundColor: '#faf8f4', color: '#3D1A2E',
            outline: 'none', width: '100%', maxWidth: 260,
          }}
        />
      </SubRow>
      <div style={{ fontSize: 11, color: '#8B6A5A' }}>
        💡 체크인 화면은 <code style={{ backgroundColor: 'rgba(61,26,46,0.06)', padding: '0 4px', borderRadius: 4 }}>/checkin/[이벤트ID]</code> 에서 접근할 수 있습니다.
      </div>
    </div>
  )
}

function Step5Sub({ s, onChange }: { s: EventSettings; onChange: (s: EventSettings) => void }) {
  return (
    <div>
      <SubRow label="발송 내용">
        <textarea
          value={s.postEventContent}
          onChange={e => onChange({ ...s, postEventContent: e.target.value })}
          placeholder="참석자에게 보낼 감사 메시지 또는 후기 설문 링크를 입력하세요."
          rows={3}
          style={{
            fontSize: 12, padding: '6px 10px', borderRadius: 8,
            border: '1px solid rgba(61,26,46,0.2)',
            backgroundColor: '#faf8f4', color: '#3D1A2E',
            outline: 'none', width: '100%', resize: 'vertical', lineHeight: 1.5,
          }}
        />
      </SubRow>
      <SubRow label="발송 시점">
        <DateInput
          value={s.postEventScheduledAt}
          onChange={v => onChange({ ...s, postEventScheduledAt: v })}
          placeholder="발송 예약 시각"
        />
      </SubRow>
    </div>
  )
}

const SUB_SETTINGS: Record<string, (props: { s: EventSettings; onChange: (s: EventSettings) => void }) => React.ReactNode> = {
  invitationEnabled: ({ s, onChange }) => <Step1Sub s={s} onChange={onChange} />,
  rsvpEnabled: ({ s, onChange }) => <Step2Sub s={s} onChange={onChange} />,
  confirmedInviteEnabled: ({ s, onChange }) => <Step3Sub s={s} onChange={onChange} />,
  qrCheckinEnabled: ({ s, onChange }) => <Step4Sub s={s} onChange={onChange} />,
  postEventEnabled: ({ s, onChange }) => <Step5Sub s={s} onChange={onChange} />,
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function SettingsFlow({ settings, onChange }: Props) {
  const isAvailable = (step: Step): boolean => {
    if (!step.dependsOn) return true
    return Boolean(settings[step.dependsOn])
  }

  const toggle = (key: keyof EventSettings) => {
    const next = { ...settings, [key]: !settings[key] }
    // 부모가 꺼지면 자식도 강제로 끔
    if (!next[key]) {
      STEPS.forEach(s => {
        if (s.dependsOn === key) next[s.enabledKey] = false as never
      })
    }
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {STEPS.map((step, i) => {
        const active = Boolean(settings[step.enabledKey])
        const available = isAvailable(step)
        const SubContent = SUB_SETTINGS[step.enabledKey]

        return (
          <div
            key={step.enabledKey}
            style={{
              borderRadius: 12,
              border: `1px solid ${
                active
                  ? 'rgba(217,79,53,0.3)'
                  : available
                  ? 'rgba(61,26,46,0.12)'
                  : 'rgba(61,26,46,0.06)'
              }`,
              backgroundColor: active ? 'rgba(217,79,53,0.02)' : available ? '#fff' : '#faf8f4',
              opacity: available ? 1 : 0.55,
              overflow: 'hidden',
              transition: 'all 0.15s',
            }}
          >
            {/* 헤더 행 */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 14 }}>
              {/* 아이콘 */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                backgroundColor: active ? 'rgba(217,79,53,0.12)' : 'rgba(61,26,46,0.06)',
              }}>
                {step.icon}
              </div>

              {/* 텍스트 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#8B6A5A', letterSpacing: 0.5 }}>
                    STEP {i + 1}
                  </span>
                  {!available && (
                    <span style={{
                      fontSize: 10, color: '#8B6A5A', padding: '1px 6px',
                      borderRadius: 9999, backgroundColor: 'rgba(61,26,46,0.07)',
                    }}>
                      이전 단계 필요
                    </span>
                  )}
                </div>
                <p style={{
                  fontSize: 14, fontWeight: 700, margin: '0 0 2px',
                  color: active ? '#D94F35' : available ? '#3D1A2E' : '#8B6A5A',
                }}>
                  {step.title}
                </p>
                <p style={{ fontSize: 12, color: '#8B6A5A', margin: 0, lineHeight: 1.5 }}>
                  {step.description}
                </p>
              </div>

              {/* 토글 */}
              <Toggle
                on={active}
                disabled={!available}
                onClick={() => available && toggle(step.enabledKey)}
              />
            </div>

            {/* 아코디언 서브 설정 */}
            {active && SubContent && (
              <div style={{
                padding: '10px 18px 16px 72px',
                borderTop: '1px solid rgba(61,26,46,0.07)',
                backgroundColor: 'rgba(217,79,53,0.015)',
                animation: 'fadeIn 0.15s ease',
              }}>
                <SubContent s={settings} onChange={onChange} />
              </div>
            )}
          </div>
        )
      })}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
