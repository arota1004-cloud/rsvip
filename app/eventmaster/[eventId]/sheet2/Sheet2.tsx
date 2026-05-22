'use client'

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react'
import type { Invitation, SendRecord, CustomQuestion, FilterRule } from './actions'
import type { Column, GuestRow } from '../sheet1/actions'
import {
  loadSheet2,
  saveInvitation,
  duplicateInvitation,
  deleteInvitation,
  saveRsvpSettings,
  recordSend,
  generateGuestTokens,
} from './actions'
import { loadSheet } from '../sheet1/actions'
import VariationList from './VariationList'
import InvitationEditor from './InvitationEditor'
import FilterBuilder from './FilterBuilder'
import SendHistoryPanel from './SendHistoryPanel'

type SaveStatus = 'saved' | 'saving' | 'error'

type Props = {
  eventId: string
  onSaveStatusChange: (s: SaveStatus) => void
  onAlert: (msg: string, type?: 'warn' | 'error' | 'info') => void
}

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

function evalRule(rule: FilterRule, row: GuestRow): boolean {
  const val = (row.data[rule.columnId] ?? '').toLowerCase()
  const rv  = rule.value.toLowerCase()
  switch (rule.condition) {
    case 'eq':           return val === rv
    case 'neq':          return val !== rv
    case 'contains':     return val.includes(rv)
    case 'not_contains': return !val.includes(rv)
    case 'is_empty':     return val === ''
    case 'is_not_empty': return val !== ''
  }
}

function applyFilters(rules: FilterRule[], rows: GuestRow[]): GuestRow[] {
  if (rules.length === 0) return rows
  return rows.filter(row => {
    let result = evalRule(rules[0], row)
    for (let i = 1; i < rules.length; i++) {
      const cur = evalRule(rules[i], row)
      result = rules[i].logic === 'AND' ? result && cur : result || cur
    }
    return result
  })
}

export default function Sheet2({ eventId, onSaveStatusChange, onAlert }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [history, setHistory] = useState<SendRecord[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [rows, setRows] = useState<GuestRow[]>([])
  const [rsvpEnabled, setRsvpEnabled] = useState(true)
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'editor' | 'settings' | 'history'>('editor')
  const [newQText, setNewQText] = useState('')
  const [isSending, startSend] = useTransition()
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)

  useEffect(() => {
    Promise.all([loadSheet2(eventId), loadSheet(eventId)]).then(([s2, s1]) => {
      setInvitations(s2.invitations)
      setHistory(s2.history)
      setRsvpEnabled(s2.rsvpEnabled)
      setCustomQuestions(s2.customQuestions)
      setColumns(s2.columns as Column[])
      setActiveId(s2.invitations[0]?.id ?? '')
      setRows(s1.rows)
      setLoading(false)
    })
  }, [eventId])

  const activeInv = invitations.find(i => i.id === activeId)

  const filteredRows = useMemo(
    () => activeInv ? applyFilters(activeInv.filter_rules, rows) : rows,
    [activeInv, rows]
  )

  const tokenNames = columns.map(c => c.name)

  // 자동저장 (1초 디바운스)
  const saveTimerRef = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout> | null = null
      return (inv: Invitation) => {
        if (timer) clearTimeout(timer)
        onSaveStatusChange('saving')
        timer = setTimeout(async () => {
          try {
            await saveInvitation({ id: inv.id, event_id: inv.event_id, name: inv.name, html_content: inv.html_content, filter_rules: inv.filter_rules })
            onSaveStatusChange('saved')
          } catch { onSaveStatusChange('error') }
        }, 1000)
      }
    })(),
    [onSaveStatusChange]
  )

  const patchActive = useCallback((patch: Partial<Invitation>) => {
    setInvitations(prev => prev.map(inv => {
      if (inv.id !== activeId) return inv
      const updated = { ...inv, ...patch }
      saveTimerRef(updated)
      return updated
    }))
  }, [activeId, saveTimerRef])

  const handleRename = async (id: string, name: string) => {
    setInvitations(prev => prev.map(i => i.id === id ? { ...i, name } : i))
    const inv = invitations.find(i => i.id === id)
    if (inv) await saveInvitation({ id, event_id: inv.event_id, name, html_content: inv.html_content, filter_rules: inv.filter_rules })
  }

  const handleDuplicate = async (id: string) => {
    const newInv = await duplicateInvitation(id)
    setInvitations(prev => [...prev, newInv])
    setActiveId(newInv.id)
  }

  const handleDelete = async (id: string) => {
    await deleteInvitation(id)
    setInvitations(prev => {
      const next = prev.filter(i => i.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? '')
      return next
    })
  }

  const handleSaveRsvp = useCallback(async (enabled: boolean, questions: CustomQuestion[]) => {
    await saveRsvpSettings(eventId, enabled, questions)
  }, [eventId])

  const handleSend = (channel: 'email' | 'link') => {
    if (!activeInv) return
    startSend(async () => {
      try {
        const tokens = await generateGuestTokens(eventId, filteredRows.map(r => r.id), 'rsvp')
        await recordSend(eventId, activeInv.id, channel, filteredRows.map(r => r.id))

        if (channel === 'link' && tokens.length > 0) {
          const links = tokens.map(t => `${APP_URL}/rsvp/${t.token}`).join('\n')
          await navigator.clipboard.writeText(links)
          onAlert(`${tokens.length}개 링크가 클립보드에 복사되었습니다.`, 'info')
        } else if (channel === 'email') {
          onAlert(`${filteredRows.length}명에게 이메일 발송을 시작했습니다.`, 'info')
        }

        setHistory(prev => [{
          id: crypto.randomUUID(),
          invitation_id: activeInv.id,
          event_id: eventId,
          sender_user_id: '',
          channel,
          sent_to_count: filteredRows.length,
          guest_ids: filteredRows.map(r => r.id),
          sent_at: new Date().toISOString(),
          invitation_name: activeInv.name,
        }, ...prev])
      } catch {
        onAlert('발송 중 오류가 발생했습니다.', 'error')
      }
    })
  }

  const handleQr = async () => {
    if (!activeInv || filteredRows.length === 0) return
    const tokens = await generateGuestTokens(eventId, filteredRows.map(r => r.id), 'qr_checkin')
    if (tokens.length === 0) return
    const QRCode = (await import('qrcode')).default
    const url = `${APP_URL}/checkin/${tokens[0].token}`
    const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 2 })
    setQrDataUrl(dataUrl)
    setShowQrModal(true)
  }

  const addQuestion = () => {
    if (!newQText.trim()) return
    const q: CustomQuestion = {
      id: crypto.randomUUID(),
      text: newQText.trim(),
      type: 'text',
      required: false,
    }
    const updated = [...customQuestions, q]
    setCustomQuestions(updated)
    setNewQText('')
    handleSaveRsvp(rsvpEnabled, updated)
  }

  const removeQuestion = (id: string) => {
    const updated = customQuestions.filter(q => q.id !== id)
    setCustomQuestions(updated)
    handleSaveRsvp(rsvpEnabled, updated)
  }

  const toggleRsvp = () => {
    const next = !rsvpEnabled
    setRsvpEnabled(next)
    handleSaveRsvp(next, customQuestions)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: '#8B6A5A' }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: '#F5F0E8' }}>
      {/* A열: 배리에이션 목록 */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid rgba(61,26,46,0.1)',
        backgroundColor: '#faf8f4',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid rgba(61,26,46,0.08)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', margin: 0, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            초대장 버전
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          <VariationList
            invitations={invitations}
            activeId={activeId}
            onSelect={setActiveId}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* B열: 에디터 + 설정 + 이력 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 탭 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'stretch', height: 38,
          borderBottom: '1px solid rgba(61,26,46,0.1)',
          backgroundColor: '#fff', flexShrink: 0, paddingLeft: 4,
        }}>
          {([
            { key: 'editor',   label: '📝 에디터' },
            { key: 'settings', label: '⚙ RSVP 설정' },
            { key: 'history',  label: '📋 발송 이력' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0 16px', fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 400,
                background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === tab.key ? '#D94F35' : '#8B6A5A',
                borderBottom: activeTab === tab.key ? '2px solid #D94F35' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* 에디터 탭 */}
          {activeTab === 'editor' && activeInv && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* 에디터 영역 */}
              <div style={{ flex: 1, padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <InvitationEditor
                  html={activeInv.html_content}
                  onChange={html => patchActive({ html_content: html })}
                  availableTokens={tokenNames}
                />
              </div>

              {/* 필터 + 발송 패널 */}
              <div style={{
                flexShrink: 0, borderTop: '1px solid rgba(61,26,46,0.1)',
                backgroundColor: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
                maxHeight: 320, overflowY: 'auto',
              }}>
                {/* 필터 */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', margin: '0 0 8px', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    수신자 필터
                  </p>
                  <FilterBuilder
                    rules={activeInv.filter_rules}
                    columns={columns}
                    rows={rows}
                    onChange={rules => patchActive({ filter_rules: rules })}
                  />
                </div>

                {/* 발송 채널 */}
                <div style={{ borderTop: '1px solid rgba(61,26,46,0.08)', paddingTop: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', margin: '0 0 10px', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    발송
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <SendBtn
                      label="✉ 이메일 발송"
                      disabled={isSending || filteredRows.length === 0}
                      onClick={() => handleSend('email')}
                      primary
                    />
                    <SendBtn
                      label="🔗 링크 복사"
                      disabled={isSending || filteredRows.length === 0}
                      onClick={() => handleSend('link')}
                    />
                    <SendBtn
                      label="📱 QR 생성"
                      disabled={isSending || filteredRows.length === 0}
                      onClick={handleQr}
                    />
                    <SendBtn
                      label="💬 SMS"
                      disabled
                      title="준비 중"
                    />
                    {isSending && (
                      <span style={{ fontSize: 12, color: '#8B6A5A' }}>발송 중...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RSVP 설정 탭 */}
          {activeTab === 'settings' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {/* RSVP 토글 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(61,26,46,0.12)',
                backgroundColor: '#fff', marginBottom: 16,
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#3D1A2E', margin: 0 }}>RSVP 응답 수집</p>
                  <p style={{ fontSize: 11, color: '#8B6A5A', margin: '2px 0 0' }}>
                    게스트가 링크를 통해 참석 여부를 응답할 수 있습니다.
                  </p>
                </div>
                <ToggleSwitch checked={rsvpEnabled} onChange={toggleRsvp} />
              </div>

              {/* 추가 질문 */}
              {rsvpEnabled && (
                <div style={{ border: '1px solid rgba(61,26,46,0.12)', borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(61,26,46,0.08)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#3D1A2E', margin: 0 }}>추가 질문</p>
                    <p style={{ fontSize: 11, color: '#8B6A5A', margin: '2px 0 0' }}>RSVP 응답 시 추가 정보를 수집합니다.</p>
                  </div>

                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {customQuestions.map(q => (
                      <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, backgroundColor: '#faf8f4' }}>
                        <span style={{ flex: 1, fontSize: 12, color: '#3D1A2E' }}>{q.text}</span>
                        <span style={{ fontSize: 10, color: '#8B6A5A', padding: '1px 6px', borderRadius: 9999, backgroundColor: 'rgba(61,26,46,0.07)' }}>
                          {q.type === 'text' ? '텍스트' : '선택'}
                        </span>
                        <button
                          onClick={() => removeQuestion(q.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(61,26,46,0.35)', padding: '2px 4px' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#D94F35')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(61,26,46,0.35)')}
                        >✕</button>
                      </div>
                    ))}

                    {/* 질문 추가 */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input
                        value={newQText}
                        onChange={e => setNewQText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addQuestion()}
                        placeholder="질문 입력 후 추가"
                        style={{
                          flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 8,
                          border: '1px solid rgba(61,26,46,0.15)', outline: 'none', color: '#3D1A2E',
                        }}
                        onFocus={e => (e.target.style.borderColor = '#D94F35')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.15)')}
                      />
                      <button
                        onClick={addQuestion}
                        disabled={!newQText.trim()}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: 'none', cursor: newQText.trim() ? 'pointer' : 'default',
                          backgroundColor: newQText.trim() ? '#D94F35' : 'rgba(61,26,46,0.1)',
                          color: newQText.trim() ? '#fff' : '#8B6A5A',
                        }}
                      >추가</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 발송 이력 탭 */}
          {activeTab === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
              <SendHistoryPanel history={history} />
            </div>
          )}
        </div>
      </div>

      {/* QR 모달 */}
      {showQrModal && qrDataUrl && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 60 }}
            onClick={() => setShowQrModal(false)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 61, backgroundColor: '#fff', borderRadius: 16, padding: 32,
            boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#3D1A2E' }}>QR 체크인 코드</p>
            <img src={qrDataUrl} alt="QR Code" style={{ width: 240, height: 240 }} />
            <p style={{ margin: 0, fontSize: 11, color: '#8B6A5A', textAlign: 'center' }}>
              게스트가 이 QR을 스캔하면 체크인 페이지로 이동합니다.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = qrDataUrl
                  a.download = 'qr-checkin.png'
                  a.click()
                }}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', backgroundColor: '#D94F35', color: '#fff', cursor: 'pointer' }}
              >
                PNG 저장
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(61,26,46,0.15)', background: 'none', color: '#3D1A2E', cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SendBtn({ label, onClick, disabled, primary, title }: {
  label: string; onClick?: () => void; disabled?: boolean; primary?: boolean; title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
        border: primary ? 'none' : '1px solid rgba(61,26,46,0.2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: disabled ? 'rgba(61,26,46,0.07)' : primary ? '#D94F35' : '#fff',
        color: disabled ? '#8B6A5A' : primary ? '#fff' : '#3D1A2E',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        position: 'relative', width: 40, height: 22, borderRadius: 11,
        backgroundColor: checked ? '#D94F35' : 'rgba(61,26,46,0.2)',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        backgroundColor: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}
