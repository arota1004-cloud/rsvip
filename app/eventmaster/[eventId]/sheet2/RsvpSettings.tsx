'use client'

import { useState } from 'react'
import type { CustomQuestion } from './actions'

type Props = {
  enabled: boolean
  questions: CustomQuestion[]
  onToggleEnabled: () => void
  onChange: (questions: CustomQuestion[]) => void
}

const TYPE_LABELS: Record<CustomQuestion['type'], string> = {
  text:   '단답형',
  select: '선택형',
  number: '숫자',
}

const TYPE_ICONS: Record<CustomQuestion['type'], string> = {
  text:   'T',
  select: '☰',
  number: '#',
}

export default function RsvpSettings({ enabled, questions, onToggleEnabled, onChange }: Props) {
  // 추가 폼 상태
  const [showForm, setShowForm]           = useState(false)
  const [addType, setAddType]             = useState<CustomQuestion['type']>('text')
  const [addText, setAddText]             = useState('')
  const [addRequired, setAddRequired]     = useState(false)
  const [addOptions, setAddOptions]       = useState('')

  // DnD 상태
  const [dragIdx, setDragIdx]             = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx]     = useState<number | null>(null)

  const addQuestion = () => {
    if (!addText.trim()) return
    const q: CustomQuestion = {
      id: crypto.randomUUID(),
      text: addText.trim(),
      type: addType,
      required: addRequired,
      options: addType === 'select'
        ? addOptions.split('\n').map(s => s.trim()).filter(Boolean)
        : undefined,
    }
    onChange([...questions, q])
    setAddText(''); setAddOptions(''); setAddRequired(false); setShowForm(false)
  }

  const toggleRequired = (id: string) =>
    onChange(questions.map(q => q.id === id ? { ...q, required: !q.required } : q))

  const deleteQuestion = (id: string) =>
    onChange(questions.filter(q => q.id !== id))

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOverIdx(null); return }
    const next = [...questions]
    const [item] = next.splice(dragIdx, 1)
    next.splice(toIdx, 0, item)
    onChange(next)
    setDragIdx(null); setDragOverIdx(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* RSVP 활성화 토글 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(61,26,46,0.12)', backgroundColor: '#fff',
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#3D1A2E', margin: 0 }}>RSVP 응답 수집</p>
          <p style={{ fontSize: 11, color: '#8B6A5A', margin: '2px 0 0' }}>
            게스트가 개인화 링크로 참석 여부를 응답합니다.
          </p>
        </div>
        <ToggleSwitch checked={enabled} onChange={onToggleEnabled} />
      </div>

      {enabled && (
        <div className="flex flex-col gap-4">

          {/* 기본 문항 (고정) */}
          <div>
            <SectionLabel>기본 문항 (고정)</SectionLabel>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              borderRadius: 8, border: '1px solid rgba(61,26,46,0.1)', backgroundColor: '#f9f7f4',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(61,26,46,0.3)', flexShrink: 0 }}>⠿</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3D1A2E', flex: 1 }}>참석 여부</span>
              <Chip color="gray">선택형</Chip>
              <Chip color="coral">필수</Chip>
              <span style={{ fontSize: 11, color: 'rgba(61,26,46,0.35)' }}>참석 / 불참</span>
            </div>
          </div>

          {/* 추가 문항 */}
          <div>
            <SectionLabel>추가 문항</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {questions.length === 0 && !showForm && (
                <p style={{ fontSize: 12, color: 'rgba(61,26,46,0.35)', textAlign: 'center', padding: '12px 0' }}>
                  추가 문항이 없습니다.
                </p>
              )}

              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 14px', borderRadius: 8,
                    border: `1px solid ${dragOverIdx === idx ? '#D94F35' : 'rgba(61,26,46,0.1)'}`,
                    backgroundColor: dragIdx === idx ? 'rgba(217,79,53,0.04)' : '#fff',
                    cursor: 'grab', transition: 'border-color 0.1s, background 0.1s',
                  }}>
                  <span style={{ fontSize: 12, color: 'rgba(61,26,46,0.25)', paddingTop: 1, flexShrink: 0, userSelect: 'none' }}>⠿</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {/* 타입 아이콘 */}
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#8B6A5A', width: 16, textAlign: 'center', flexShrink: 0 }}>
                        {TYPE_ICONS[q.type]}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#3D1A2E' }}>{q.text}</span>
                      <Chip color="gray">{TYPE_LABELS[q.type]}</Chip>
                      {q.required && <Chip color="coral">필수</Chip>}
                    </div>
                    {q.type === 'select' && q.options?.length ? (
                      <p style={{ margin: '3px 0 0 22px', fontSize: 11, color: 'rgba(61,26,46,0.4)' }}>
                        선택지: {q.options.join(' / ')}
                      </p>
                    ) : null}
                  </div>

                  {/* 필수 토글 */}
                  <button
                    title={q.required ? '필수 해제' : '필수로 설정'}
                    onClick={() => toggleRequired(q.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '1px 3px', flexShrink: 0, color: q.required ? '#D94F35' : 'rgba(61,26,46,0.22)', lineHeight: 1 }}>
                    {q.required ? '★' : '☆'}
                  </button>

                  {/* 삭제 */}
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '1px 3px', flexShrink: 0, color: 'rgba(61,26,46,0.25)', lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#D94F35')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(61,26,46,0.25)')}>✕</button>
                </div>
              ))}

              {/* 문항 추가 폼 */}
              {showForm ? (
                <div style={{
                  border: '1.5px solid #D94F35', borderRadius: 8, padding: '12px 14px',
                  backgroundColor: 'rgba(217,79,53,0.03)', display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {/* 타입 선택 */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['text', 'select', 'number'] as CustomQuestion['type'][]).map(t => (
                      <button key={t} onClick={() => setAddType(t)}
                        style={{
                          padding: '4px 10px', fontSize: 11, borderRadius: 6,
                          border: `1px solid ${addType === t ? '#D94F35' : 'rgba(61,26,46,0.2)'}`,
                          backgroundColor: addType === t ? 'rgba(217,79,53,0.08)' : '#fff',
                          color: addType === t ? '#D94F35' : '#8B6A5A', cursor: 'pointer', fontWeight: addType === t ? 600 : 400,
                        }}>
                        {TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>

                  {/* 문항 텍스트 */}
                  <input
                    autoFocus
                    value={addText}
                    onChange={e => setAddText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addQuestion()}
                    placeholder={addType === 'text' ? '예: 동반자 성함' : addType === 'number' ? '예: 동반자 수' : '예: 식이 제한'}
                    style={{
                      width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6,
                      border: '1px solid rgba(61,26,46,0.2)', outline: 'none', color: '#3D1A2E',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#D94F35')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.2)')}
                  />

                  {/* 선택지 (선택형만) */}
                  {addType === 'select' && (
                    <div>
                      <p style={{ fontSize: 11, color: '#8B6A5A', margin: '0 0 4px' }}>선택지 (한 줄에 하나)</p>
                      <textarea
                        value={addOptions}
                        onChange={e => setAddOptions(e.target.value)}
                        placeholder={'없음\n채식\n할랄'}
                        rows={3}
                        style={{
                          width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                          border: '1px solid rgba(61,26,46,0.2)', outline: 'none', color: '#3D1A2E',
                          resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
                        }}
                        onFocus={e => (e.target.style.borderColor = '#D94F35')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.2)')}
                      />
                    </div>
                  )}

                  {/* 필수 여부 + 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#3D1A2E', cursor: 'pointer' }}>
                      <input type="checkbox" checked={addRequired} onChange={e => setAddRequired(e.target.checked)}
                        style={{ accentColor: '#D94F35', width: 14, height: 14 }} />
                      필수 문항
                    </label>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => { setShowForm(false); setAddText(''); setAddOptions('') }}
                      style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid rgba(61,26,46,0.2)', background: 'none', color: '#8B6A5A', cursor: 'pointer' }}>
                      취소
                    </button>
                    <button
                      onClick={addQuestion}
                      disabled={!addText.trim()}
                      style={{
                        padding: '5px 14px', fontSize: 12, borderRadius: 6, border: 'none',
                        backgroundColor: addText.trim() ? '#D94F35' : 'rgba(61,26,46,0.12)',
                        color: addText.trim() ? '#fff' : '#8B6A5A',
                        cursor: addText.trim() ? 'pointer' : 'not-allowed', fontWeight: 600,
                      }}>
                      추가
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    padding: '8px 0', fontSize: 12, color: '#8B6A5A', background: 'none',
                    border: '1px dashed rgba(61,26,46,0.2)', borderRadius: 8, cursor: 'pointer', width: '100%',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#D94F35'; e.currentTarget.style.color = '#D94F35' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,26,46,0.2)'; e.currentTarget.style.color = '#8B6A5A' }}>
                  + 문항 추가
                </button>
              )}
            </div>
          </div>

          {/* RSVP 링크 안내 */}
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)',
          }}>
            <p style={{ margin: 0, fontSize: 11, color: '#2563EB', lineHeight: 1.6 }}>
              💡 발송 시 게스트마다 고유한 RSVP 링크가 자동 생성됩니다.
              <br />
              <span style={{ opacity: 0.7 }}>형식: /rsvp/&#123;eventId&#125;/&#123;guestId&#125;</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', margin: '0 0 6px', letterSpacing: 0.4, textTransform: 'uppercase' }}>
      {children}
    </p>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color: 'gray' | 'coral' }) {
  const styles = {
    gray:  { bg: 'rgba(61,26,46,0.07)',  fc: '#8B6A5A' },
    coral: { bg: 'rgba(217,79,53,0.08)', fc: '#D94F35' },
  }
  const s = styles[color]
  return (
    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, backgroundColor: s.bg, color: s.fc, flexShrink: 0 }}>
      {children}
    </span>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={onChange}
      style={{ position: 'relative', width: 40, height: 22, borderRadius: 11, backgroundColor: checked ? '#D94F35' : 'rgba(61,26,46,0.2)', border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}
