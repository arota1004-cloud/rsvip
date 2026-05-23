'use client'

import { useState, useTransition } from 'react'
import { submitRsvp } from './actions'

type Question = {
  id: string
  text: string
  type: 'text' | 'select' | 'number'
  options?: string[]
  required: boolean
}

type Props = {
  token: string
  guestId: string
  eventId: string
  eventName: string
  venue?: string
  dates: string[]
  guestData: Record<string, string>
  customQuestions: Question[]
  existingStatus: 'Y' | 'N' | 'U'
  existingAnswers: Record<string, string>
}

const STATUS_OPTS = [
  { value: 'Y', label: '참석합니다', emoji: '✅', color: '#16A34A', bg: 'rgba(34,197,94,0.08)' },
  { value: 'N', label: '불참합니다', emoji: '❌', color: '#DC2626', bg: 'rgba(239,68,68,0.08)' },
] as const

export default function RsvpClient({
  token, guestId, eventId, eventName, venue, dates,
  guestData, customQuestions, existingStatus, existingAnswers,
}: Props) {
  const [status, setStatus] = useState<'Y' | 'N' | 'U'>(existingStatus)
  const [answers, setAnswers] = useState<Record<string, string>>(existingAnswers)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const guestName = Object.values(guestData)[0] ?? '게스트'

  const handleSubmit = () => {
    if (status === 'U') return
    startTransition(async () => {
      await submitRsvp({ token, guestId, eventId, status, answers })
      setDone(true)
    })
  }

  if (done) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E8', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{status === 'Y' ? '🎉' : '😢'}</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#3D1A2E', marginBottom: 8 }}>
            {status === 'Y' ? '참석 확인되었습니다!' : '응답해 주셔서 감사합니다.'}
          </h2>
          <p style={{ fontSize: 14, color: '#8B6A5A' }}>
            {guestName}님의 응답이 등록되었습니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#F5F0E8', padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* 이벤트 카드 */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 16, padding: '24px 24px 20px',
          boxShadow: '0 2px 16px rgba(61,26,46,0.08)', marginBottom: 20,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D94F35', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
            초대장
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#3D1A2E', margin: '0 0 12px' }}>
            {eventName}
          </h1>
          {dates.length > 0 && (
            <p style={{ fontSize: 13, color: '#8B6A5A', margin: '0 0 4px' }}>
              📅 {dates.join(' · ')}
            </p>
          )}
          {venue && (
            <p style={{ fontSize: 13, color: '#8B6A5A', margin: 0 }}>
              📍 {venue}
            </p>
          )}
        </div>

        {/* RSVP 카드 */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 16, padding: 24,
          boxShadow: '0 2px 16px rgba(61,26,46,0.08)',
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#3D1A2E', marginBottom: 16 }}>
            {guestName}님, 참석 여부를 알려주세요.
          </p>

          {/* 참석 여부 선택 */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {STATUS_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                style={{
                  flex: 1, padding: '14px 8px', borderRadius: 12,
                  border: status === opt.value ? `2px solid ${opt.color}` : '2px solid rgba(61,26,46,0.12)',
                  backgroundColor: status === opt.value ? opt.bg : '#faf8f4',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: status === opt.value ? opt.color : '#8B6A5A' }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          {/* 추가 질문 */}
          {customQuestions.length > 0 && status !== 'U' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              {customQuestions.map(q => (
                <div key={q.id}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3D1A2E', marginBottom: 6 }}>
                    {q.text}
                    {q.required && <span style={{ color: '#D94F35', marginLeft: 4 }}>*</span>}
                  </label>
                  {q.type === 'select' && q.options ? (
                    <select
                      value={answers[q.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8,
                        border: '1.5px solid rgba(61,26,46,0.15)', outline: 'none', color: '#3D1A2E',
                        backgroundColor: '#fff',
                      }}
                    >
                      <option value="">선택하세요</option>
                      {q.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={q.type === 'number' ? 'number' : 'text'}
                      value={answers[q.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8,
                        border: '1.5px solid rgba(61,26,46,0.15)', outline: 'none', color: '#3D1A2E',
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#D94F35')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.15)')}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={status === 'U' || isPending}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 700,
              border: 'none',
              cursor: status === 'U' || isPending ? 'not-allowed' : 'pointer',
              backgroundColor: status === 'U' ? 'rgba(61,26,46,0.1)' : '#D94F35',
              color: status === 'U' ? '#8B6A5A' : '#fff',
              transition: 'background 0.15s',
            }}
          >
            {isPending ? '제출 중...' : '응답 제출'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(61,26,46,0.3)', marginTop: 20 }}>
          Powered by RSViP
        </p>
      </div>
    </div>
  )
}
