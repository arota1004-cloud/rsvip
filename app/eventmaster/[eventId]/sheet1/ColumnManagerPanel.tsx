'use client'

import { useState, useEffect } from 'react'
import type { Column } from './actions'

type Props = {
  col: Column
  colIndex: number
  totalCols: number
  onUpdate: (patch: Partial<Column>) => void
  onDelete: () => void
  onClose: () => void
}

const TYPES: { value: Column['type']; label: string; desc: string }[] = [
  { value: 'text',     label: '자유형',  desc: '어떤 텍스트든 자유 입력' },
  { value: 'dropdown', label: '드롭다운', desc: '지정한 선택지에서만 입력' },
  { value: 'survey',   label: '회신',    desc: '참석(Y) / 불참(N) / 미정(U)' },
]

export default function ColumnManagerPanel({ col, colIndex, totalCols, onUpdate, onDelete, onClose }: Props) {
  const [name, setName] = useState(col.name)
  const [type, setType] = useState<Column['type']>(col.type)
  const [options, setOptions] = useState<string[]>(col.options ?? [])
  const [optInput, setOptInput] = useState('')

  // 외부 col 변경 시 동기화 (다른 컬럼으로 전환)
  useEffect(() => {
    setName(col.name)
    setType(col.type)
    setOptions(col.options ?? [])
    setOptInput('')
  }, [col.id])

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
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={onClose} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 300, zIndex: 50,
        backgroundColor: '#fff', borderLeft: '1px solid rgba(61,26,46,0.12)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid rgba(61,26,46,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#8B6A5A', letterSpacing: 0.5, textTransform: 'uppercase' }}>컬럼 편집</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(61,26,46,0.35)' }}>열 {colIndex + 1} / {totalCols}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8B6A5A', lineHeight: 1 }}>×</button>
        </div>

        {/* 편집 영역 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px' }}>

          {/* 컬럼 이름 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8B6A5A', marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              컬럼 이름
            </label>
            <input
              value={name}
              onChange={e => updateName(e.target.value)}
              placeholder="컬럼 이름 입력"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                border: '1.5px solid rgba(61,26,46,0.15)', outline: 'none', color: '#3D1A2E',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = '#D94F35')}
              onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.15)')}
            />
          </div>

          {/* 타입 선택 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8B6A5A', marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              입력 형식
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => updateType(t.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 9, textAlign: 'left',
                    border: `1.5px solid ${type === t.value ? '#D94F35' : 'rgba(61,26,46,0.12)'}`,
                    backgroundColor: type === t.value ? 'rgba(217,79,53,0.04)' : '#faf8f4',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${type === t.value ? '#D94F35' : 'rgba(61,26,46,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {type === t.value && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#D94F35' }} />}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: type === t.value ? '#D94F35' : '#3D1A2E' }}>{t.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#8B6A5A' }}>{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 드롭다운 옵션 편집 */}
          {type === 'dropdown' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8B6A5A', marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                선택지 옵션
              </label>

              {/* 옵션 행 목록 */}
              <div style={{ border: '1px solid rgba(61,26,46,0.12)', borderRadius: 9, overflow: 'hidden', marginBottom: 8 }}>
                {options.length === 0 ? (
                  <p style={{ padding: '12px', fontSize: 12, color: 'rgba(61,26,46,0.35)', margin: 0, textAlign: 'center' }}>
                    아래에서 선택지를 추가하세요
                  </p>
                ) : (
                  options.map((opt, idx) => (
                    <div
                      key={opt}
                      style={{
                        display: 'flex', alignItems: 'center',
                        padding: '9px 12px',
                        borderBottom: idx < options.length - 1 ? '1px solid rgba(61,26,46,0.07)' : 'none',
                        backgroundColor: idx % 2 === 0 ? '#fff' : '#faf8f4',
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 13, color: '#3D1A2E' }}>{opt}</span>
                      <button
                        onClick={() => removeOption(opt)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(61,26,46,0.3)', padding: '0 4px', lineHeight: 1 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#D94F35')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(61,26,46,0.3)')}
                      >✕</button>
                    </div>
                  ))
                )}

                {/* 새 옵션 입력 행 */}
                <div style={{ display: 'flex', alignItems: 'center', borderTop: options.length > 0 ? '1px dashed rgba(61,26,46,0.12)' : 'none' }}>
                  <input
                    value={optInput}
                    onChange={e => setOptInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addOption()}
                    placeholder="새 선택지 입력..."
                    style={{ flex: 1, padding: '9px 12px', fontSize: 13, border: 'none', outline: 'none', backgroundColor: 'transparent', color: '#3D1A2E' }}
                  />
                  <button
                    onClick={addOption}
                    disabled={!optInput.trim() || options.includes(optInput.trim())}
                    style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none',
                      cursor: optInput.trim() ? 'pointer' : 'default',
                      backgroundColor: 'transparent',
                      color: optInput.trim() && !options.includes(optInput.trim()) ? '#D94F35' : 'rgba(61,26,46,0.25)',
                      flexShrink: 0,
                    }}
                  >
                    + 추가
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 회신(서베이) 안내 */}
          {type === 'survey' && (
            <div style={{ padding: '12px 14px', borderRadius: 9, backgroundColor: 'rgba(61,26,46,0.04)', border: '1px solid rgba(61,26,46,0.08)' }}>
              <p style={{ fontSize: 12, color: '#8B6A5A', margin: 0, lineHeight: 1.6 }}>
                Y(참석) / N(불참) / U(미정) 세 가지 값으로 게스트의 참석 회신을 수집합니다.
                RSVP 링크 발송과 연동됩니다.
              </p>
            </div>
          )}
        </div>

        {/* 하단: 컬럼 삭제 */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(61,26,46,0.08)', flexShrink: 0 }}>
          <button
            onClick={() => {
              if (confirm(`"${col.name || '이 컬럼'}"을 삭제할까요?`)) {
                onDelete()
                onClose()
              }
            }}
            style={{
              width: '100%', padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: '1px solid rgba(217,79,53,0.3)', background: 'none',
              cursor: 'pointer', color: '#D94F35', transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(217,79,53,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            이 컬럼 삭제
          </button>
        </div>
      </div>
    </>
  )
}
