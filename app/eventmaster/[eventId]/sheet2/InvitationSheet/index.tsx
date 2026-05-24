'use client'

import { useState, useEffect, useCallback, useTransition, useMemo, useRef, type DragEvent } from 'react'
import type { Invitation, SendRecord, CustomQuestion, FilterRule } from '../actions'
import type { Column, GuestRow } from '../../sheet1/actions'
import {
  loadSheet2, saveInvitation, duplicateInvitation, deleteInvitation,
  saveRsvpSettings, recordSend, generateGuestTokens, markGuestsAsSent,
} from '../actions'
import { loadSheet } from '../../sheet1/actions'
import { generateRsvpLink } from '@/lib/rsvp'
import GuestQR from '@/components/QRCode/GuestQR'
import VariationList from '../VariationList'
import FilterBuilder from '../FilterBuilder'
import SendHistoryPanel from '../SendHistoryPanel'
import TipTapEditor from './TipTapEditor'

type SaveStatus = 'saved' | 'saving' | 'error'
type Channel = 'email' | 'link'

type Props = {
  eventId: string
  onSaveStatusChange: (s: SaveStatus) => void
  onAlert: (msg: string, type?: 'warn' | 'error' | 'info') => void
  confirmedInviteEnabled?: boolean  // QR 토큰 활성화 여부 (Sheet3 설정 연동)
  rsvpEnabled?: boolean             // RSVP 탭 표시 여부
  invitationEnabled?: boolean       // 초대장 발송 활성화 여부 (미래 확장)
  onSendComplete?: () => void       // 발송 완료 후 Sheet1 새로고침 트리거
}

// ─── 필터 평가 ────────────────────────────────────────────────────────────────
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
    let r = evalRule(rules[0], row)
    for (let i = 1; i < rules.length; i++) {
      const c = evalRule(rules[i], row)
      r = rules[i].logic === 'AND' ? r && c : r || c
    }
    return r
  })
}

// ─── 토큰 치환 ────────────────────────────────────────────────────────────────
// {QR}는 React 컴포넌트로 렌더링하기 위해 플레이스홀더로 변환
const QR_PLACEHOLDER = '___RSVIP_QR___'

function applyTokens(html: string, sampleRow: Record<string, string>): string {
  let result = html.replace(
    /<span[^>]*data-token="([^"]*)"[^>]*>[^<]*<\/span>/g,
    (_, name) => {
      if (name === 'QR') return QR_PLACEHOLDER
      return sampleRow[name] ?? `{${name}}`
    }
  )
  Object.entries(sampleRow).forEach(([name, value]) => {
    result = result.replaceAll(`{${name}}`, value)
  })
  // 플레인 텍스트 {QR}도 플레이스홀더로
  result = result.replaceAll('{QR}', QR_PLACEHOLDER)
  return result
}

// ─── 시각 포맷 ────────────────────────────────────────────────────────────────
function nowStr() {
  const d = new Date()
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ─── 썸네일 업로드 영역 ────────────────────────────────────────────────────────
function ThumbnailZone({ src, onChange }: { src: string; onChange: (src: string) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => onChange(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  if (src) return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
      <img src={src} alt="thumbnail"
        style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block', borderRadius: '10px 10px 0 0' }} />
      <button onClick={() => onChange('')}
        style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 9999, color: '#fff', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
        ✕ 제거</button>
      <button onClick={() => inputRef.current?.click()}
        style={{ position: 'absolute', top: 8, right: 64, backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 9999, color: '#fff', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
        변경</button>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }} />
    </div>
  )

  return (
    <div
      onDragOver={(e: DragEvent) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e: DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f) }}
      onClick={() => inputRef.current?.click()}
      style={{
        flexShrink: 0, width: '100%', padding: '14px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        border: `2px dashed ${dragging ? '#FF5C1A' : 'rgba(61,26,46,0.18)'}`,
        borderRadius: '10px 10px 0 0', cursor: 'pointer',
        backgroundColor: dragging ? 'rgba(255,92,26,0.04)' : '#fafaf8', transition: 'all 0.15s',
      }}>
      <span style={{ fontSize: 22 }}>🖼</span>
      <span style={{ fontSize: 12, color: '#8B6A5A' }}>썸네일 이미지 드래그 또는 클릭</span>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }} />
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

export default function InvitationSheet({ eventId, onSaveStatusChange, onAlert, confirmedInviteEnabled = false, rsvpEnabled = true, onSendComplete }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [history, setHistory]         = useState<SendRecord[]>([])
  const [columns, setColumns]         = useState<Column[]>([])
  const [rows, setRows]               = useState<GuestRow[]>([])
  const [rsvpActive, setRsvpActive] = useState(true)   // DB에서 로드되는 RSVP 활성 설정값
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [activeId, setActiveId]       = useState('')
  const [loading, setLoading]         = useState(true)
  const [rightTab, setRightTab]       = useState<'editor' | 'rsvp' | 'history'>('editor')
  const [isSending, startSend]        = useTransition()
  const [qrDataUrl, setQrDataUrl]     = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [thumbnail, setThumbnail]     = useState<Record<string, string>>({})

  // 발송 설정 상태
  const [channel, setChannel]         = useState<Channel>('email')
  const [senderName, setSenderName]   = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [sendPanelOpen, setSendPanelOpen]       = useState(true)

  useEffect(() => {
    Promise.all([loadSheet2(eventId), loadSheet(eventId)]).then(([s2, s1]) => {
      setInvitations(s2.invitations)
      setHistory(s2.history)
      setRsvpActive(s2.rsvpEnabled)
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

  const sampleRow = useMemo<Record<string, string>>(() => {
    const r = rows[0]; if (!r) return {}
    const map: Record<string, string> = {}
    columns.forEach(col => { map[col.name] = r.data[col.id] ?? `(${col.name})` })
    return map
  }, [rows, columns])

  const tokenNames = columns.map(c => c.name)

  // 이름 컬럼 ID (링크 미리보기 이름 표시용)
  const nameColId = useMemo(
    () => columns.find(c => c.name === '이름')?.id ?? '',
    [columns]
  )

  // 전체 링크 클립보드 복사 (이름 | URL 형식)
  const copyAllLinks = useCallback(async () => {
    const text = filteredRows.map(row => {
      const name = nameColId ? (row.data[nameColId] ?? '게스트') : '게스트'
      return `${name} | ${APP_URL}${generateRsvpLink(eventId, row.id)}`
    }).join('\n')
    await navigator.clipboard.writeText(text)
    onAlert(`${filteredRows.length}개 링크가 클립보드에 복사됐습니다.`, 'info')
  }, [filteredRows, nameColId, eventId, onAlert])

  // ─ 자동저장 ──────────────────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSave = useCallback((inv: Invitation) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    onSaveStatusChange('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        await saveInvitation({ id: inv.id, event_id: inv.event_id, name: inv.name, html_content: inv.html_content, filter_rules: inv.filter_rules })
        onSaveStatusChange('saved')
      } catch { onSaveStatusChange('error') }
    }, 1000)
  }, [onSaveStatusChange])

  const patchActive = useCallback((patch: Partial<Invitation>) => {
    setInvitations(prev => prev.map(inv => {
      if (inv.id !== activeId) return inv
      const updated = { ...inv, ...patch }
      autoSave(updated)
      return updated
    }))
  }, [activeId, autoSave])

  // ─ 배리에이션 CRUD ──────────────────────────────────────────────────────────
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

  // ─ 썸네일 ───────────────────────────────────────────────────────────────────
  const handleThumbnailChange = (src: string) => {
    if (!activeId) return
    setThumbnail(prev => ({ ...prev, [activeId]: src }))
    const current = activeInv?.html_content ?? ''
    const withoutOldThumb = current.replace(/^<img[^>]*class="inv-thumbnail"[^>]*\/?>/, '').trimStart()
    const newHtml = src
      ? `<img src="${src}" class="inv-thumbnail" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-bottom:16px;" />${withoutOldThumb}`
      : withoutOldThumb
    patchActive({ html_content: newHtml })
  }

  // ─ 실제 발송 (모달 확인 후 호출) ─────────────────────────────────────────────
  const doSend = () => {
    if (!activeInv) return
    setShowConfirmModal(false)
    startSend(async () => {
      try {
        const sentAt = nowStr()
        const invLabel = `발송 완료 · ${sentAt}`
        const guestIds = filteredRows.map(r => r.id)

        if (channel === 'link') {
          // 이름 | URL 형식으로 전체 복사
          const text = filteredRows.map(row => {
            const name = nameColId ? (row.data[nameColId] ?? '게스트') : '게스트'
            return `${name} | ${APP_URL}${generateRsvpLink(eventId, row.id)}`
          }).join('\n')
          await navigator.clipboard.writeText(text)
        }

        await recordSend(eventId, activeInv.id, channel, guestIds)
        await markGuestsAsSent(eventId, guestIds, invLabel)

        const record: SendRecord = {
          id: crypto.randomUUID(),
          invitation_id: activeInv.id,
          event_id: eventId,
          sender_user_id: '',
          channel,
          sent_to_count: filteredRows.length,
          guest_ids: guestIds,
          sent_at: new Date().toISOString(),
          invitation_name: activeInv.name,
        }
        setHistory(prev => [record, ...prev])
        onAlert(`${filteredRows.length}명에게 발송 완료 — ${sentAt}`, 'info')
        onSendComplete?.()   // Sheet1 새로고침 트리거
      } catch {
        onAlert('발송 중 오류가 발생했습니다.', 'error')
      }
    })
  }

  // ─ QR ───────────────────────────────────────────────────────────────────────
  const handleQr = async () => {
    if (!activeInv || filteredRows.length === 0) return
    const tokens = await generateGuestTokens(eventId, filteredRows.map(r => r.id), 'qr_checkin')
    if (!tokens.length) return
    const QRCode = (await import('qrcode')).default
    setQrDataUrl(await QRCode.toDataURL(`${APP_URL}/checkin/${tokens[0].token}`, { width: 240, margin: 2 }))
    setShowQrModal(true)
  }

  const handleSaveRsvp = useCallback(async (enabled: boolean, questions: CustomQuestion[]) => {
    await saveRsvpSettings(eventId, enabled, questions)
  }, [eventId])

  // ─ RSVP 문항 관리 ────────────────────────────────────────────────────────────
  const moveQuestion = useCallback((idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= customQuestions.length) return
    const next = [...customQuestions]
    const temp = next[idx]; next[idx] = next[target]; next[target] = temp
    setCustomQuestions(next)
    handleSaveRsvp(rsvpActive, next)
  }, [customQuestions, rsvpActive, handleSaveRsvp])

  const updateQuestion = useCallback((id: string, patch: Partial<CustomQuestion>) => {
    const next = customQuestions.map(q => q.id === id ? { ...q, ...patch } : q)
    setCustomQuestions(next)
    handleSaveRsvp(rsvpActive, next)
  }, [customQuestions, rsvpActive, handleSaveRsvp])

  const removeQuestion = useCallback((id: string) => {
    const next = customQuestions.filter(q => q.id !== id)
    setCustomQuestions(next)
    handleSaveRsvp(rsvpActive, next)
  }, [customQuestions, rsvpActive, handleSaveRsvp])

  const addQuestion = useCallback(() => {
    const q: CustomQuestion = { id: crypto.randomUUID(), text: '', type: 'short', required: false }
    const next = [...customQuestions, q]
    setCustomQuestions(next)
    handleSaveRsvp(rsvpActive, next)
  }, [customQuestions, rsvpActive, handleSaveRsvp])

  if (loading) {
    return <div className="flex items-center justify-center h-full text-sm" style={{ color: '#8B6A5A' }}>불러오는 중...</div>
  }

  const thumbSrc = activeId ? (thumbnail[activeId] ?? '') : ''

  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: '#F5F0E8' }}>

      {/* ─ 좌측: 배리에이션 목록 ────────────────────────────────────────────── */}
      <div style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(61,26,46,0.1)', backgroundColor: '#faf8f4', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid rgba(61,26,46,0.08)', flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', margin: 0, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            초대장 버전
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          <VariationList
            invitations={invitations} activeId={activeId}
            onSelect={setActiveId} onRename={handleRename}
            onDuplicate={handleDuplicate} onDelete={handleDelete}
          />
        </div>
      </div>

      {/* ─ 가운데: 에디터 + 탭 ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid rgba(61,26,46,0.1)' }}>

        {/* 탭 헤더 — 에디터 / RSVP 설정 / 발송 이력 */}
        <div style={{
          display: 'flex', height: 38, alignItems: 'stretch', paddingLeft: 4,
          borderBottom: '1px solid rgba(61,26,46,0.1)', backgroundColor: '#fff', flexShrink: 0,
        }}>
          {([
            { key: 'editor',  label: '✏️ 에디터',    show: true },
            { key: 'rsvp',    label: '⚙ RSVP 설정', show: rsvpEnabled },
            { key: 'history', label: '📋 발송 이력', show: true },
          ] as const).filter(t => t.show).map(tab => (
            <button key={tab.key} onClick={() => setRightTab(tab.key)}
              style={{
                padding: '0 14px', fontSize: 12, fontWeight: rightTab === tab.key ? 700 : 400,
                background: 'none', border: 'none', cursor: 'pointer',
                color: rightTab === tab.key ? '#FF5C1A' : '#8B6A5A',
                borderBottom: rightTab === tab.key ? '2px solid #FF5C1A' : '2px solid transparent',
                marginBottom: -1,
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── 에디터 탭 ─────────────────────────────────────────────────────── */}
          {rightTab === 'editor' && activeInv && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* 에디터 영역 (스크롤 가능) */}
              <div style={{ flex: 1, minHeight: 180, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
                <ThumbnailZone src={thumbSrc} onChange={handleThumbnailChange} />
                <div style={{ flex: 1, minHeight: 120 }}>
                  <TipTapEditor
                    html={activeInv.html_content}
                    onChange={html => patchActive({ html_content: html })}
                    availableTokens={tokenNames}
                    sampleRow={sampleRow}
                    confirmedInviteEnabled={confirmedInviteEnabled}
                  />
                </div>
              </div>

              {/* 발송 설정 패널 (에디터 하단 고정) */}
              <div style={{ flexShrink: 0, borderTop: '1px solid rgba(61,26,46,0.12)', backgroundColor: '#fafaf8' }}>

                {/* 패널 헤더 */}
                <button
                  onClick={() => setSendPanelOpen(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: sendPanelOpen ? '1px solid rgba(61,26,46,0.08)' : 'none',
                  }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    발송 설정
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* 필터 뱃지 */}
                    {activeInv.filter_rules.length > 0 && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, backgroundColor: 'rgba(255,92,26,0.1)', color: '#FF5C1A' }}>
                        필터 {activeInv.filter_rules.length}
                      </span>
                    )}
                    {/* 대상수 */}
                    <span style={{ fontSize: 12, color: filteredRows.length > 0 ? '#FF5C1A' : '#8B6A5A', fontWeight: 600 }}>
                      {filteredRows.length}명
                    </span>
                    <span style={{ fontSize: 10, color: '#8B6A5A' }}>{sendPanelOpen ? '▴' : '▾'}</span>
                  </div>
                </button>

                {/* 패널 바디 */}
                {sendPanelOpen && (
                  <div style={{ maxHeight: 310, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* 수신자 필터 */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#8B6A5A', margin: '0 0 6px', letterSpacing: 0.3 }}>
                        발송 대상 필터
                      </p>
                      <FilterBuilder
                        rules={activeInv.filter_rules}
                        columns={columns}
                        rows={rows}
                        onChange={rules => patchActive({ filter_rules: rules })}
                        compact
                      />
                    </div>

                    <div style={{ height: 1, backgroundColor: 'rgba(61,26,46,0.08)' }} />

                    {/* 채널 선택 */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#8B6A5A', margin: '0 0 8px', letterSpacing: 0.3 }}>
                        발송 채널
                      </p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {([
                          { key: 'email' as const, label: '✉ 이메일', disabled: false },
                          { key: 'sms'   as const, label: '💬 SMS',   disabled: true },
                          { key: 'link'  as const, label: '🔗 링크 복사', disabled: false },
                        ]).map(ch => {
                          const isActive = !ch.disabled && (ch.key as string) === (channel as string)
                          return (
                            <button key={ch.key}
                              disabled={ch.disabled}
                              onClick={() => { if (!ch.disabled && ch.key !== 'sms') setChannel(ch.key) }}
                              style={{
                                padding: '5px 12px', fontSize: 12, fontWeight: isActive ? 700 : 400, borderRadius: 20,
                                border: `1px solid ${isActive ? '#FF5C1A' : ch.disabled ? 'rgba(61,26,46,0.1)' : 'rgba(61,26,46,0.2)'}`,
                                cursor: ch.disabled ? 'not-allowed' : 'pointer',
                                backgroundColor: isActive ? 'rgba(255,92,26,0.08)' : ch.disabled ? 'rgba(0,0,0,0.02)' : '#fff',
                                color: isActive ? '#FF5C1A' : ch.disabled ? 'rgba(61,26,46,0.3)' : '#3D1A2E',
                                position: 'relative',
                              }}>
                              {ch.label}
                              {ch.disabled && (
                                <span style={{ fontSize: 9, backgroundColor: 'rgba(61,26,46,0.15)', borderRadius: 4, padding: '1px 4px', marginLeft: 4, color: 'rgba(61,26,46,0.4)' }}>
                                  준비 중
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* 발송자명 (이메일 채널만) */}
                    {channel === 'email' && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#8B6A5A', margin: '0 0 6px', letterSpacing: 0.3 }}>
                          발송자명
                        </p>
                        <input
                          value={senderName}
                          onChange={e => setSenderName(e.target.value)}
                          placeholder="예: 홍길동 행사팀"
                          style={{
                            width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7,
                            border: '1px solid rgba(61,26,46,0.2)', outline: 'none', color: '#3D1A2E',
                            backgroundColor: '#fff', boxSizing: 'border-box',
                          }}
                          onFocus={e => (e.target.style.borderColor = '#FF5C1A')}
                          onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.2)')}
                        />
                      </div>
                    )}

                    {/* 링크 미리보기 (링크 복사 채널만) */}
                    {channel === 'link' && filteredRows.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: '#8B6A5A', margin: 0, letterSpacing: 0.3 }}>
                            링크 미리보기 ({filteredRows.length}개)
                          </p>
                          <button
                            onClick={copyAllLinks}
                            style={{
                              padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                              border: '1px solid rgba(61,26,46,0.2)', background: 'none', cursor: 'pointer', color: '#3D1A2E',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5C1A'; e.currentTarget.style.color = '#FF5C1A' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,26,46,0.2)'; e.currentTarget.style.color = '#3D1A2E' }}>
                            📋 전체 복사
                          </button>
                        </div>
                        <div style={{
                          maxHeight: 148, overflowY: 'auto',
                          border: '1px solid rgba(61,26,46,0.1)', borderRadius: 8, overflow: 'hidden',
                        }}>
                          {filteredRows.slice(0, 50).map((row, idx) => {
                            const name = nameColId ? (row.data[nameColId] ?? '게스트') : '게스트'
                            const link = generateRsvpLink(eventId, row.id)
                            const fullLink = `${APP_URL}${link}`
                            return (
                              <div key={row.id} style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                                backgroundColor: idx % 2 === 0 ? '#fff' : '#fafaf8',
                                borderBottom: '1px solid rgba(61,26,46,0.06)',
                              }}>
                                <span style={{ width: 18, fontSize: 10, color: '#8B6A5A', textAlign: 'right', flexShrink: 0 }}>
                                  {idx + 1}
                                </span>
                                <span style={{ width: 68, fontSize: 11, fontWeight: 500, color: '#3D1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {name}
                                </span>
                                <span style={{ flex: 1, fontSize: 10, color: '#8B6A5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {link}
                                </span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(fullLink)}
                                  title="이 링크 복사"
                                  style={{
                                    padding: '2px 7px', fontSize: 10, borderRadius: 4, flexShrink: 0,
                                    border: '1px solid rgba(61,26,46,0.15)', background: 'none',
                                    cursor: 'pointer', color: '#8B6A5A',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5C1A'; e.currentTarget.style.color = '#FF5C1A' }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,26,46,0.15)'; e.currentTarget.style.color = '#8B6A5A' }}>
                                  복사
                                </button>
                              </div>
                            )
                          })}
                          {filteredRows.length > 50 && (
                            <div style={{ padding: '5px 10px', fontSize: 10, color: '#8B6A5A', textAlign: 'center', backgroundColor: '#faf8f4' }}>
                              … 외 {filteredRows.length - 50}명
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 발송 버튼 */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        disabled={isSending || filteredRows.length === 0}
                        onClick={() => setShowConfirmModal(true)}
                        style={{
                          flex: 1, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                          border: 'none', cursor: filteredRows.length === 0 || isSending ? 'not-allowed' : 'pointer',
                          backgroundColor: filteredRows.length === 0 || isSending ? 'rgba(61,26,46,0.12)' : '#FF5C1A',
                          color: filteredRows.length === 0 || isSending ? '#8B6A5A' : '#fff',
                          opacity: filteredRows.length === 0 || isSending ? 0.7 : 1,
                          transition: 'all 0.15s',
                        }}>
                        {isSending ? '발송 중...' : `${filteredRows.length}명에게 발송하기 →`}
                      </button>
                      <button
                        disabled={isSending || filteredRows.length === 0}
                        onClick={handleQr}
                        title="QR 체크인 코드 생성"
                        style={{
                          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                          border: '1px solid rgba(61,26,46,0.2)', cursor: filteredRows.length === 0 ? 'not-allowed' : 'pointer',
                          backgroundColor: '#fff', color: '#3D1A2E', opacity: filteredRows.length === 0 ? 0.5 : 1,
                        }}>
                        📱 QR
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RSVP 설정 탭 ─────────────────────────────────────────────────── */}
          {rightTab === 'rsvp' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

              {/* RSVP 수집 ON/OFF */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(61,26,46,0.12)',
                backgroundColor: '#fff', marginBottom: 20,
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#3D1A2E', margin: 0 }}>RSVP 응답 수집</p>
                  <p style={{ fontSize: 11, color: '#8B6A5A', margin: '2px 0 0' }}>게스트가 링크로 참석 여부를 응답합니다.</p>
                </div>
                <ToggleSwitch checked={rsvpActive} onChange={() => {
                  const next = !rsvpActive; setRsvpActive(next); handleSaveRsvp(next, customQuestions)
                }} />
              </div>

              {rsvpActive && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* 기본 문항 (고정) */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', margin: '0 0 8px', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      기본 문항
                    </p>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      borderRadius: 10, border: '1px solid rgba(61,26,46,0.08)',
                      backgroundColor: 'rgba(61,26,46,0.025)',
                    }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(61,26,46,0.45)', margin: 0 }}>참석 여부</p>
                        <p style={{ fontSize: 11, color: 'rgba(61,26,46,0.35)', margin: '2px 0 0' }}>
                          참석 / 불참 응답 — 수정·삭제 불가
                        </p>
                      </div>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 9999,
                        backgroundColor: 'rgba(61,26,46,0.07)', color: 'rgba(61,26,46,0.35)', fontWeight: 600,
                      }}>필수</span>
                    </div>
                  </div>

                  {/* 추가 문항 */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#8B6A5A', margin: '0 0 8px', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      추가 문항 ({customQuestions.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {customQuestions.map((q, idx) => (
                        <div key={q.id} style={{
                          border: '1px solid rgba(61,26,46,0.12)', borderRadius: 10,
                          backgroundColor: '#fff', padding: '10px 12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}>
                          {/* 상단: 순서 버튼 + 텍스트 + 타입 + 삭제 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* 위/아래 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                              <ArrowBtn dir="up" disabled={idx === 0}
                                onClick={() => moveQuestion(idx, -1)} />
                              <ArrowBtn dir="down" disabled={idx === customQuestions.length - 1}
                                onClick={() => moveQuestion(idx, 1)} />
                            </div>

                            {/* 문항 텍스트 */}
                            <input
                              value={q.text}
                              onChange={e => updateQuestion(q.id, { text: e.target.value })}
                              placeholder="문항을 입력하세요"
                              style={{
                                flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 7,
                                border: '1px solid rgba(61,26,46,0.15)', outline: 'none',
                                color: '#3D1A2E', backgroundColor: '#fafaf8',
                              }}
                              onFocus={e => (e.target.style.borderColor = '#FF5C1A')}
                              onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.15)')}
                            />

                            {/* 타입 드롭다운 */}
                            <select
                              value={q.type === 'text' ? 'short' : q.type}
                              onChange={e => updateQuestion(q.id, { type: e.target.value as CustomQuestion['type'] })}
                              style={{
                                padding: '6px 8px', fontSize: 11, borderRadius: 7, flexShrink: 0,
                                border: '1px solid rgba(61,26,46,0.15)', outline: 'none',
                                backgroundColor: '#fafaf8', color: '#3D1A2E', cursor: 'pointer',
                              }}>
                              <option value="short">단답형</option>
                              <option value="select">선택형</option>
                              <option value="number">숫자</option>
                            </select>

                            {/* 삭제 */}
                            <button onClick={() => removeQuestion(q.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'rgba(61,26,46,0.3)', padding: '2px 4px', flexShrink: 0 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#FF5C1A')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(61,26,46,0.3)')}>✕</button>
                          </div>

                          {/* 하단: 필수 여부 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 28 }}>
                            <span style={{ fontSize: 11, color: '#8B6A5A' }}>필수 응답</span>
                            <ToggleSwitch
                              checked={q.required}
                              onChange={() => updateQuestion(q.id, { required: !q.required })}
                              small
                            />
                          </div>
                        </div>
                      ))}

                      {/* + 문항 추가 */}
                      <button onClick={addQuestion}
                        style={{
                          padding: '10px 0', fontSize: 12, color: '#8B6A5A',
                          background: 'none', border: '1px dashed rgba(61,26,46,0.2)',
                          borderRadius: 10, cursor: 'pointer', width: '100%', marginTop: 2,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5C1A'; e.currentTarget.style.color = '#FF5C1A' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,26,46,0.2)'; e.currentTarget.style.color = '#8B6A5A' }}>
                        + 문항 추가
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ── 발송 이력 탭 ─────────────────────────────────────────────────── */}
          {rightTab === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
              <SendHistoryPanel history={history} rows={rows} columns={columns} />
            </div>
          )}

        </div>
      </div>

      {/* ─ 우측: 실시간 미리보기 ─────────────────────────────────────────────── */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#F5F0E8', overflow: 'hidden' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid rgba(61,26,46,0.1)',
          backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#8B6A5A', letterSpacing: 0.5, textTransform: 'uppercase' }}>미리보기</p>
          {rows[0] && <span style={{ fontSize: 10, color: 'rgba(61,26,46,0.4)' }}>2행 샘플 적용</span>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {activeInv ? (
            <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', minHeight: 300 }}>
              {activeInv.html_content ? (
                <PreviewContent
                  html={applyTokens(activeInv.html_content, sampleRow)}
                  sampleRow={sampleRow}
                  eventId={eventId}
                  guestId={rows[0]?.id ?? ''}
                  confirmedInviteEnabled={confirmedInviteEnabled}
                />
              ) : (
                <p style={{ color: 'rgba(61,26,46,0.3)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                  에디터에서 초대장을 작성하면 여기에 미리보기가 표시됩니다
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'rgba(61,26,46,0.4)', textAlign: 'center', marginTop: 60 }}>배리에이션을 선택하세요</p>
          )}
        </div>
        <style>{`
          .inv-preview h1 { font-size: 22px; font-weight: 700; margin: 14px 0 8px; }
          .inv-preview h2 { font-size: 18px; font-weight: 700; margin: 12px 0 6px; }
          .inv-preview p  { margin: 0 0 8px; }
          .inv-preview img { max-width: 100%; height: auto; border-radius: 8px; }
          .inv-preview ul  { padding-left: 18px; }
          .inv-preview .inv-thumbnail { width: 100%; max-height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 14px; }
        `}</style>
      </div>

      {/* ─ 발송 확인 모달 ────────────────────────────────────────────────────── */}
      {showConfirmModal && activeInv && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 60 }}
            onClick={() => setShowConfirmModal(false)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61,
            backgroundColor: '#fff', borderRadius: 16, padding: '28px 28px 20px', width: 380,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#3D1A2E' }}>발송 확인</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <InfoRow label="인비테이션" value={activeInv.name} />
              <InfoRow label="발송 대상" value={`${filteredRows.length}명`} highlight />
              <InfoRow label="채널" value={channel === 'email' ? '✉ 이메일' : '🔗 링크 복사'} />
              {channel === 'email' && senderName && (
                <InfoRow label="발송자명" value={senderName} />
              )}
            </div>
            <div style={{
              padding: '12px 14px', borderRadius: 8, backgroundColor: 'rgba(255,92,26,0.06)',
              border: '1px solid rgba(255,92,26,0.15)', marginBottom: 20,
            }}>
              <p style={{ margin: 0, fontSize: 12, color: '#8B6A5A', lineHeight: 1.6 }}>
                발송 후 게스트 시트의 <strong style={{ color: '#3D1A2E' }}>인비테이션 발송</strong> 열이 자동 업데이트됩니다.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, border: '1px solid rgba(61,26,46,0.2)', background: 'none', color: '#3D1A2E', cursor: 'pointer' }}>
                취소
              </button>
              <button
                onClick={doSend}
                style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', backgroundColor: '#FF5C1A', color: '#fff', cursor: 'pointer' }}>
                발송 확인 →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─ QR 모달 ──────────────────────────────────────────────────────────── */}
      {showQrModal && qrDataUrl && (
        <>
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 60 }} onClick={() => setShowQrModal(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 61, backgroundColor: '#fff', borderRadius: 16, padding: 32,
            boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#3D1A2E' }}>QR 체크인 코드</p>
            <img src={qrDataUrl} alt="QR" style={{ width: 240, height: 240 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { const a = document.createElement('a'); a.href = qrDataUrl; a.download = 'qr.png'; a.click() }}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', backgroundColor: '#FF5C1A', color: '#fff', cursor: 'pointer' }}>
                PNG 저장
              </button>
              <button onClick={() => setShowQrModal(false)}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(61,26,46,0.15)', background: 'none', color: '#3D1A2E', cursor: 'pointer' }}>
                닫기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── 프리뷰 렌더러 (QR 플레이스홀더 분할 처리) ───────────────────────────────
function PreviewContent({
  html, sampleRow, eventId, guestId, confirmedInviteEnabled,
}: {
  html: string
  sampleRow: Record<string, string>
  eventId: string
  guestId: string
  confirmedInviteEnabled: boolean
}) {
  const parts = html.split(QR_PLACEHOLDER)

  if (parts.length === 1) {
    return (
      <div style={{ fontSize: 14, lineHeight: 1.7, color: '#3D1A2E' }}
        dangerouslySetInnerHTML={{ __html: html }} />
    )
  }

  const guestName = sampleRow['이름'] ?? '게스트'

  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: '#3D1A2E' }}>
      {parts.map((part, i) => (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: part }} />
          {i < parts.length - 1 && (
            confirmedInviteEnabled ? (
              <GuestQR guestName={guestName} guestId={guestId} eventId={eventId} />
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
                border: '1px dashed rgba(61,26,46,0.2)', borderRadius: 6,
                fontSize: 11, color: 'rgba(61,26,46,0.35)',
              }}>
                📷 QR 🔒 확정 인비테이션 비활성
              </span>
            )
          )}
        </span>
      ))}
    </div>
  )
}

// ─── 헬퍼 컴포넌트 ────────────────────────────────────────────────────────────
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <span style={{ width: 80, fontSize: 12, color: '#8B6A5A', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: highlight ? 700 : 500, color: highlight ? '#FF5C1A' : '#3D1A2E' }}>
        {value}
      </span>
    </div>
  )
}

function ToggleSwitch({ checked, onChange, small }: { checked: boolean; onChange: () => void; small?: boolean }) {
  const w = small ? 30 : 40, h = small ? 17 : 22, r = small ? 8 : 11
  const knob = small ? 11 : 16, gap = 3
  return (
    <button role="switch" aria-checked={checked} onClick={onChange}
      style={{
        position: 'relative', width: w, height: h, borderRadius: r, flexShrink: 0,
        backgroundColor: checked ? '#FF5C1A' : 'rgba(61,26,46,0.2)',
        border: 'none', cursor: 'pointer', transition: 'background 0.2s',
      }}>
      <span style={{
        position: 'absolute', top: gap, left: checked ? (w - knob - gap) : gap,
        width: knob, height: knob, borderRadius: '50%', backgroundColor: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function ArrowBtn({ dir, disabled, onClick }: { dir: 'up' | 'down'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 20, height: 17, fontSize: 8, borderRadius: 4, flexShrink: 0,
        border: '1px solid rgba(61,26,46,0.14)', background: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'rgba(61,26,46,0.18)' : '#8B6A5A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#FF5C1A' }}
      onMouseLeave={e => { e.currentTarget.style.color = disabled ? 'rgba(61,26,46,0.18)' : '#8B6A5A' }}
    >
      {dir === 'up' ? '▲' : '▼'}
    </button>
  )
}
