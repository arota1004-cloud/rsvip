'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import DateCalendar from './DateCalendar'
import { createEvent } from './actions'

type HostType = 'business' | 'community'
type EventType = 'ticket' | 'free'

export default function EventGenerateClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  const [eventName, setEventName] = useState('')
  const [hostType, setHostType] = useState<HostType | null>(null)
  const [eventType, setEventType] = useState<EventType | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [venue, setVenue] = useState('')

  const nameInputRef = useRef<HTMLInputElement>(null)
  const q2Ref = useRef<HTMLDivElement>(null)
  const q3Ref = useRef<HTMLDivElement>(null)
  const q4Ref = useRef<HTMLDivElement>(null)

  useEffect(() => { nameInputRef.current?.focus() }, [])

  useEffect(() => {
    if (step === 2) setTimeout(() => q2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    if (step === 3) setTimeout(() => q3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    if (step === 4) setTimeout(() => q4Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  }, [step])

  const confirmName = () => {
    if (eventName.trim()) setStep(2)
  }

  const selectHostType = (t: HostType) => {
    setHostType(t)
    setStep(s => Math.max(s, 3))
  }

  const selectEventType = (t: EventType) => {
    setEventType(t)
    setStep(s => Math.max(s, 4))
  }

  const isQ4Complete = dates.length > 0 && venue.trim()

  const handleSubmit = () => {
    startTransition(async () => {
      await createEvent({
        name: eventName,
        hostType: hostType!,
        eventType: eventType!,
        dates,
        venue,
      })
    })
  }

  const revealed = (n: number) => step >= n

  return (
    <main className="min-h-screen pb-32" style={{ backgroundColor: '#F5F0E8', color: '#3D1A2E' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight" style={{ color: '#D94F35' }}>
          RSViP
        </Link>
        <Link
          href="/auth"
          className="text-sm font-medium px-5 py-2 rounded-full transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#D94F35', color: '#F5F0E8' }}
        >
          로그인
        </Link>
      </nav>

      <div className="max-w-xl mx-auto px-6 pt-12 flex flex-col gap-10">

        {/* 헤더 */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#8B6A5A' }}>
            새 이벤트 만들기
          </p>
          <h1 className="text-2xl font-bold">몇 가지만 알려주세요</h1>
        </div>

        {/* Q1 */}
        <Reveal visible={true}>
          <Question index={1} label="행사 이름을 설정해주세요." sub="추후 수정 가능">
            <div className="flex gap-3">
              <input
                ref={nameInputRef}
                type="text"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmName()}
                placeholder="예) 2026 브랜드 런칭 파티"
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: '#fff',
                  border: '1.5px solid rgba(61,26,46,0.15)',
                  color: '#3D1A2E',
                }}
              />
              {step === 1 && (
                <button
                  onClick={confirmName}
                  disabled={!eventName.trim()}
                  className="px-5 py-3 rounded-xl text-sm font-semibold transition-opacity"
                  style={{
                    backgroundColor: eventName.trim() ? '#D94F35' : 'rgba(61,26,46,0.1)',
                    color: eventName.trim() ? '#F5F0E8' : '#8B6A5A',
                  }}
                >
                  다음
                </button>
              )}
            </div>
            {step > 1 && (
              <p className="mt-2 text-sm font-medium" style={{ color: '#D94F35' }}>
                {eventName}
              </p>
            )}
          </Question>
        </Reveal>

        {/* Q2 */}
        <Reveal visible={revealed(2)}>
          <div ref={q2Ref}>
            <Question index={2} label="행사 주최">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'business', label: '비즈니스 행사' },
                  { value: 'community', label: '커뮤니티 모임' },
                ] as { value: HostType; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => selectHostType(opt.value)}
                    className="py-4 px-5 rounded-xl text-sm font-medium text-left transition-all"
                    style={{
                      backgroundColor: hostType === opt.value ? '#3D1A2E' : '#fff',
                      color: hostType === opt.value ? '#F5F0E8' : '#3D1A2E',
                      border: `1.5px solid ${hostType === opt.value ? '#3D1A2E' : 'rgba(61,26,46,0.15)'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Question>
          </div>
        </Reveal>

        {/* Q3 */}
        <Reveal visible={revealed(3)}>
          <div ref={q3Ref}>
            <Question index={3} label="이벤트 형태">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'ticket', label: '티켓 구매형' },
                  { value: 'free', label: '무료 초청형' },
                ] as { value: EventType; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => selectEventType(opt.value)}
                    className="py-4 px-5 rounded-xl text-sm font-medium text-left transition-all"
                    style={{
                      backgroundColor: eventType === opt.value ? '#3D1A2E' : '#fff',
                      color: eventType === opt.value ? '#F5F0E8' : '#3D1A2E',
                      border: `1.5px solid ${eventType === opt.value ? '#3D1A2E' : 'rgba(61,26,46,0.15)'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Question>
          </div>
        </Reveal>

        {/* Q4 */}
        <Reveal visible={revealed(4)}>
          <div ref={q4Ref}>
            <Question index={4} label="행사 날짜 및 장소">
              <p className="text-xs mb-3" style={{ color: '#8B6A5A' }}>
                날짜를 클릭하거나 드래그해 선택 · Shift+클릭으로 범위 선택 · Ctrl+클릭으로 개별 추가
              </p>
              <DateCalendar onChange={setDates} />

              {/* 장소 */}
              <label className="block text-sm font-medium mt-5 mb-2" style={{ color: '#8B6A5A' }}>
                장소
              </label>
              <input
                type="text"
                value={venue}
                onChange={e => setVenue(e.target.value)}
                placeholder="예) 서울 성수동 OO 갤러리"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: '#fff',
                  border: '1.5px solid rgba(61,26,46,0.15)',
                  color: '#3D1A2E',
                }}
              />
            </Question>
          </div>
        </Reveal>

        {/* 완료 버튼 */}
        <Reveal visible={revealed(4) && !!isQ4Complete}>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full py-4 rounded-2xl font-semibold text-base transition-opacity hover:opacity-85 disabled:opacity-60"
              style={{ backgroundColor: '#D94F35', color: '#F5F0E8' }}
            >
              {isPending
                ? (isLoggedIn ? '생성 중...' : '로그인 페이지로 이동 중...')
                : '이벤트 만들기 →'}
            </button>
            {!isLoggedIn && (
              <p className="text-xs text-center" style={{ color: '#8B6A5A' }}>
                로그인되어 있지 않습니다. 제출 시 Google 로그인 후 이벤트가 자동 생성됩니다.
              </p>
            )}
          </div>
        </Reveal>

      </div>
    </main>
  )
}

/* ─── 서브 컴포넌트 ─── */

function Question({
  index,
  label,
  sub,
  children,
}: {
  index: number
  label: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-xs font-bold tabular-nums" style={{ color: '#D94F35' }}>
          {String(index).padStart(2, '0')}
        </span>
        <div>
          <p className="font-semibold text-base">{label}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: '#8B6A5A' }}>{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Reveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        transition: 'opacity 0.4s ease, transform 0.4s ease, max-height 0.5s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        maxHeight: visible ? '1200px' : 0,
        overflow: 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  )
}
