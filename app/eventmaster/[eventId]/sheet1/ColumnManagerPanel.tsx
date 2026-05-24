'use client'

import { useState, useEffect } from 'react'
import type { Column } from './actions'

type Props = {
  open: boolean
  col: Column | null
  colIndex: number
  totalCols: number
  onUpdate: (patch: Partial<Column>) => void
  onDelete: () => void
  onClose: () => void
  /** dropdown 타입일 때 "선택지 적용" 버튼 클릭 → FortuneSheet 재마운트 트리거 */
  onSaveOptions?: () => void
}

const TYPES: { value: Column['type']; label: string; desc: string; icon: string }[] = [
  { value: 'text',     icon: '🔤', label: '자유형',  desc: '어떤 텍스트든 자유 입력' },
  { value: 'dropdown', icon: '▾',  label: '드롭다운', desc: '지정한 선택지에서만 입력' },
  { value: 'survey',   icon: '✓',  label: '회신',    desc: '참석(Y) / 불참(N) / 미정(U)' },
]

export default function ColumnManagerPanel({
  open, col, colIndex, totalCols, onUpdate, onDelete, onClose, onSaveOptions,
}: Props) {
  const [name, setName]       = useState(col?.name ?? '')
  const [type, setType]       = useState<Column['type']>(col?.type ?? 'text')
  const [options, setOptions] = useState<string[]>(col?.options ?? [])
  const [optInput, setOptInput] = useState('')

  // 선택 컬럼이 바뀌면 폼 동기화
  useEffect(() => {
    if (!col) return
    setName(col.name)
    setType(col.type)
    setOptions(col.options ?? [])
    setOptInput('')
  }, [col?.id])

  const updateName = (v: string) => {
    setName(v)
    if (v.trim()) onUpdate({ name: v.trim() })
  }

  const updateType = (t: Column['type']) => {
    setType(t)
    onUpdate({ type: t, options: t === 'dropdown' ? options : undefined })
  }

  const addOption = () => {
    const v = optInput.trim()
    if (!v || options.includes(v)) return
    const next = [...options, v]
    setOptions(next)
    setOptInput('')
    onUpdate({ options: next })
  }

  const removeOption = (opt: string) => {
    const next = options.filter(o => o !== opt)
    setOptions(next)
    onUpdate({ options: next })
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0,
        width: 288,
        backgroundColor: '#fff',
        borderLeft: '1px solid rgba(61,26,46,0.12)',
        boxShadow: '-6px 0 24px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        // 슬라이드 애니메이션
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        // 닫혀있을 때 클릭 이벤트 차단
        pointerEvents: open ? 'auto' : 'none',
        zIndex: 20,
      }}
    >
      {/* ── 헤더 ─────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 10px',
        borderBottom: '1px solid rgba(61,26,46,0.08)',
        flexShrink: 0,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#8B6A5A', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            컬럼 설정
          </p>
          {col && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(61,26,46,0.4)' }}>
              열 {colIndex + 1} / {totalCols}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          title="닫기"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            width: 28, height: 28, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#8B6A5A', fontSize: 18, lineHeight: 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >×</button>
      </div>

      {/* ── 내용 없음 (컬럼 미선택) ──────────────────────────────────────────── */}
      {!col && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 12, color: 'rgba(61,26,46,0.3)', textAlign: 'center', lineHeight: 1.6 }}>
            스프레드시트에서<br />컬럼을 선택하세요
          </p>
        </div>
      )}

      {/* ── 편집 영역 ─────────────────────────────────────────────────────────── */}
      {col && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>

            {/* 컬럼 이름 */}
            <Section label="컬럼 이름">
              <input
                value={name}
                onChange={e => updateName(e.target.value)}
                placeholder="컬럼 이름"
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  border: '1.5px solid rgba(61,26,46,0.15)', outline: 'none', color: '#3D1A2E',
                  boxSizing: 'border-box', backgroundColor: '#faf8f4',
                }}
                onFocus={e => (e.target.style.borderColor = '#D94F35')}
                onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.15)')}
              />
            </Section>

            {/* 입력 형식 */}
            <Section label="입력 형식">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => updateType(t.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                      borderRadius: 8, textAlign: 'left', width: '100%',
                      border: `1.5px solid ${type === t.value ? '#D94F35' : 'rgba(61,26,46,0.1)'}`,
                      backgroundColor: type === t.value ? 'rgba(217,79,53,0.04)' : '#faf8f4',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (type !== t.value) e.currentTarget.style.borderColor = 'rgba(61,26,46,0.22)' }}
                    onMouseLeave={e => { if (type !== t.value) e.currentTarget.style.borderColor = 'rgba(61,26,46,0.1)' }}
                  >
                    {/* 라디오 원형 */}
                    <div style={{
                      width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${type === t.value ? '#D94F35' : 'rgba(61,26,46,0.22)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {type === t.value && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#D94F35' }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: type === t.value ? '#D94F35' : '#3D1A2E' }}>
                        {t.icon} {t.label}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: '#8B6A5A', marginTop: 1 }}>{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            {/* 드롭다운 옵션 편집 */}
            {type === 'dropdown' && (
              <Section label="선택지 옵션">
                <div style={{ border: '1px solid rgba(61,26,46,0.12)', borderRadius: 8, overflow: 'hidden' }}>
                  {options.length === 0 ? (
                    <p style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(61,26,46,0.3)', margin: 0, textAlign: 'center' }}>
                      아래에서 선택지를 추가하세요
                    </p>
                  ) : (
                    options.map((opt, idx) => (
                      <div
                        key={opt}
                        style={{
                          display: 'flex', alignItems: 'center',
                          padding: '8px 10px',
                          borderBottom: idx < options.length - 1 ? '1px solid rgba(61,26,46,0.07)' : 'none',
                          backgroundColor: idx % 2 === 0 ? '#fff' : '#faf8f4',
                        }}
                      >
                        <span style={{ flex: 1, fontSize: 12, color: '#3D1A2E' }}>{opt}</span>
                        <button
                          onClick={() => removeOption(opt)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'rgba(61,26,46,0.28)', padding: '0 3px', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#D94F35')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(61,26,46,0.28)')}
                        >✕</button>
                      </div>
                    ))
                  )}

                  {/* 새 옵션 입력 */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    borderTop: options.length > 0 ? '1px dashed rgba(61,26,46,0.12)' : 'none',
                  }}>
                    <input
                      value={optInput}
                      onChange={e => setOptInput(e.target.value)}
                      onKeyDown={e => {
                        // isComposing: 한글 등 IME 조합 중에는 Enter 무시 (중복 추가 방지)
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) addOption()
                      }}
                      placeholder="새 선택지 입력..."
                      style={{
                        flex: 1, padding: '8px 10px', fontSize: 12,
                        border: 'none', outline: 'none', backgroundColor: 'transparent', color: '#3D1A2E',
                      }}
                    />
                    <button
                      onClick={addOption}
                      disabled={!optInput.trim() || options.includes(optInput.trim())}
                      style={{
                        padding: '5px 10px', fontSize: 11, fontWeight: 600, border: 'none',
                        cursor: optInput.trim() && !options.includes(optInput.trim()) ? 'pointer' : 'default',
                        backgroundColor: 'transparent',
                        color: optInput.trim() && !options.includes(optInput.trim())
                          ? '#D94F35' : 'rgba(61,26,46,0.22)',
                        flexShrink: 0,
                      }}
                    >+ 추가</button>
                  </div>
                </div>

                {/* 선택지 적용 버튼 — 클릭 시 셀 드롭다운 즉시 갱신 + DB 저장 */}
                {onSaveOptions && (
                  <button
                    onClick={onSaveOptions}
                    style={{
                      marginTop: 8, width: '100%', padding: '8px', borderRadius: 7,
                      fontSize: 12, fontWeight: 700, border: 'none',
                      backgroundColor: '#D94F35', color: '#fff',
                      cursor: 'pointer', transition: 'background 0.12s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#C04030')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#D94F35')}
                  >
                    ✓ 선택지 적용
                  </button>
                )}
              </Section>
            )}

            {/* 회신 안내 */}
            {type === 'survey' && (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                backgroundColor: 'rgba(61,26,46,0.04)', border: '1px solid rgba(61,26,46,0.08)',
              }}>
                <p style={{ fontSize: 11, color: '#8B6A5A', margin: 0, lineHeight: 1.6 }}>
                  Y(참석) / N(불참) / U(미정) 세 가지 값으로<br />
                  게스트의 참석 회신을 수집합니다.
                </p>
              </div>
            )}
          </div>

          {/* ── 하단: 컬럼 삭제 버튼 ─────────────────────────────────────────── */}
          <div style={{ padding: '10px 16px 14px', borderTop: '1px solid rgba(61,26,46,0.08)', flexShrink: 0 }}>
            <button
              onClick={() => {
                if (confirm(`"${col.name || '이 컬럼'}"을 삭제할까요?`)) onDelete()
              }}
              style={{
                width: '100%', padding: '8px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: '1px solid rgba(217,79,53,0.25)', background: 'none',
                cursor: 'pointer', color: '#D94F35', transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(217,79,53,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              이 컬럼 삭제
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── 섹션 헬퍼 ─────────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 700, color: '#8B6A5A',
        marginBottom: 7, letterSpacing: 0.5, textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}
