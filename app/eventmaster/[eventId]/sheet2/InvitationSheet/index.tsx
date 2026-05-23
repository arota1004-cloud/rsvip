'use client'

import { useState, useEffect, useCallback, useTransition, useMemo, useRef, type DragEvent } from 'react'
import type { Invitation, SendRecord, CustomQuestion, FilterRule } from '../actions'
import type { Column, GuestRow } from '../../sheet1/actions'
import {
  loadSheet2, saveInvitation, duplicateInvitation, deleteInvitation,
  saveRsvpSettings, recordSend, generateGuestTokens, markGuestsAsSent,
} from '../actions'
import { loadSheet } from '../../sheet1/actions'
import VariationList from '../VariationList'
import FilterBuilder from '../FilterBuilder'
import SendHistoryPanel from '../SendHistoryPanel'
import RsvpSettings from '../RsvpSettings'
import TipTapEditor from './TipTapEditor'

type SaveStatus = 'saved' | 'saving' | 'error'
type Channel = 'email' | 'link'

type Props = {
  eventId: string
  onSaveStatusChange: (s: SaveStatus) => void
  onAlert: (msg: string, type?: 'warn' | 'error' | 'info') => void
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
function applyTokens(html: string, sampleRow: Record<string, string>): string {
  let result = html.replace(
    /<span[^>]*data-token="([^"]*)"[^>]*>[^<]*<\/span>/g,
    (_, name) => sampleRow[name] ?? `{${name}}`
  )
  Object.entries(sampleRow).forEach(([name, value]) => {
    result = result.replaceAll(`{${name}}`, value)
  })
  return result
}

// QR 이미지 포함 토큰 치환 (미리보기용)
function applyTokensWithQr(html: string, sampleRow: Record<string, string>, qrUrl: string): string {
  const qrImg = qrUrl
    ? `<img src="${qrUrl}" width="100" height="100" style="display:block;margin:8px auto;border-radius:4px;" alt="QR" />`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:80px;height:80px;border:2px dashed rgba(61,26,46,0.3);border-radius:4px;font-size:9px;color:rgba(61,26,46,0.4);">QR</span>`
  let result = applyTokens(html, sampleRow)
  result = result.replace(/<span[^>]*data-token="QR"[^>]*>[^<]*<\/span>/g, qrImg)
  result = result.replace(/\{QR\}/g, qrImg)
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
        border: `2px dashed ${dragging ? '#D94F35' : 'rgba(61,26,46,0.18)'}`,
        borderRadius: '10px 10px 0 0', cursor: 'pointer',
        backgroundColor: dragging ? 'rgba(217,79,53,0.04)' : '#fafaf8', transition: 'all 0.15s',
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

export default function InvitationSheet({ eventId, onSaveStatusChange, onAlert }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [history, setHistory]         = useState<SendRecord[]>([])
  const [columns, setColumns]         = useState<Column[]>([])
  const [rows, setRows]               = useState<GuestRow[]>([])
  const [rsvpEnabled, setRsvpEnabled] = useState(true)
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [activeId, setActiveId]       = useState('')
  const [loading, setLoading]         = useState(true)
  const [rightTab, setRightTab]       = useState<'editor' | 'rsvp' | 'history'>('editor')
  const [isSending, startSend]        = useTransition()
  const [qrDataUrl, setQrDataUrl]     = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [thumbnail, setThumbnail]     = useState<Record<string, string>>({})
  const [sampleQrUrl, setSampleQrUrl] = useState('')   // 미리보기용 QR

  // 발송 설정 상태
  const [channel, setChannel]         = useState<Channel>('email')
  const [senderName, setSenderName]   = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [sendPanelOpen, setSendPanelOpen]       = useState(true)

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

  const sampleRow = useMemo<Record<string, string>>(() => {
    const r = rows[0]; if (!r) return {}
    const map: Record<string, string> = {}
    columns.forEach(col => { map[col.name] = r.data[col.id] ?? `(${col.name})` })
    return map
  }, [rows, columns])

  const tokenNames = [...columns.map(c => c.name), 'QR']

  // ─ 미리보기용 QR 생성 ─────────────────────────────────────────────────────
  useEffect(() => {
    const guestId   = rows[0]?.id ?? 'preview'
    const guestName = sampleRow['이름'] ?? ''
    const payload   = JSON.stringify({ guestId, name: guestName, eventId })
    import('qrcode').then(mod => {
      mod.default.toDataURL(payload, { width: 100, margin: 1, color: { dark: '#3D1A2E', light: '#fff' } }).then(setSampleQrUrl)
    })
  }, [rows, eventId, sampleRow])

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
          const tokens = await generateGuestTokens(eventId, guestIds, 'rsvp')
          const links = tokens.map(t => `${APP_URL}/rsvp/${eventId}/${t.token}`).join('\n')
          await navigator.clipboard.writeText(links)
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
    // QR 내용: { guestId, name, eventId } JSON
    const firstGuest = filteredRows[0]
    const guestName  = firstGuest
      ? (Object.values(firstGuest.data)[0] ?? '')
      : ''
    const payload = JSON.stringify({ guestId: tokens[0].guest_id, name: guestName, eventId })
    const QRCode = (await import('qrcode')).default
    setQrDataUrl(await QRCode.toDataURL(payload, { width: 240, margin: 2, color: { dark: '#3D1A2E', light: '#fff' } }))
    setShowQrModal(true)
  }

  const handleSaveRsvp = useCallback(async (enabled: boolean, qs: CustomQuestion[]) => {
    await saveRsvpSettings(eventId, enabled, qs)
  }, [eventId])

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
            { key: 'editor',  label: '✏️ 에디터' },
            { key: 'rsvp',    label: '⚙ RSVP 설정' },
            { key: 'history', label: '📋 발송 이력' },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setRightTab(tab.key)}
              style={{
                padding: '0 14px', fontSize: 12, fontWeight: rightTab === tab.key ? 700 : 400,
                background: 'none', border: 'none', cursor: 'pointer',
                color: rightTab === tab.key ? '#D94F35' : '#8B6A5A',
                borderBottom: rightTab === tab.key ? '2px solid #D94F35' : '2px solid transparent',
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
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, backgroundColor: 'rgba(217,79,53,0.1)', color: '#D94F35' }}>
                        필터 {activeInv.filter_rules.length}
                      </span>
                    )}
                    {/* 대상수 */}
                    <span style={{ fontSize: 12, color: filteredRows.length > 0 ? '#D94F35' : '#8B6A5A', fontWeight: 600 }}>
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
                                border: `1px solid ${isActive ? '#D94F35' : ch.disabled ? 'rgba(61,26,46,0.1)' : 'rgba(61,26,46,0.2)'}`,
                                cursor: ch.disabled ? 'not-allowed' : 'pointer',
                                backgroundColor: isActive ? 'rgba(217,79,53,0.08)' : ch.disabled ? 'rgba(0,0,0,0.02)' : '#fff',
                                color: isActive ? '#D94F35' : ch.disabled ? 'rgba(61,26,46,0.3)' : '#3D1A2E',
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

                    {/* 발송자명 (이메일 채널만 표시) */}
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
                          onFocus={e => (e.target.style.borderColor = '#D94F35')}
                          onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.2)')}
                        />
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
                          backgroundColor: filteredRows.length === 0 || isSending ? 'rgba(61,26,46,0.12)' : '#D94F35',
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
              <RsvpSettings
                enabled={rsvpEnabled}
                questions={customQuestions}
                onToggleEnabled={() => {
                  const next = !rsvpEnabled; setRsvpEnabled(next); handleSaveRsvp(next, customQuestions)
                }}
                onChange={next => { setCustomQuestions(next); handleSaveRsvp(rsvpEnabled, next) }}
              />
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
              <div style={{ fontSize: 14, lineHeight: 1.7, color: '#3D1A2E' }}
                dangerouslySetInnerHTML={{ __html: applyTokensWithQr(activeInv.html_content, sampleRow, sampleQrUrl) }} />
              {!activeInv.html_content && (
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
              padding: '12px 14px', borderRadius: 8, backgroundColor: 'rgba(217,79,53,0.06)',
              border: '1px solid rgba(217,79,53,0.15)', marginBottom: 20,
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
                style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', backgroundColor: '#D94F35', color: '#fff', cursor: 'pointer' }}>
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
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', backgroundColor: '#D94F35', color: '#fff', cursor: 'pointer' }}>
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

// ─── 헬퍼 컴포넌트 ────────────────────────────────────────────────────────────
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <span style={{ width: 80, fontSize: 12, color: '#8B6A5A', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: highlight ? 700 : 500, color: highlight ? '#D94F35' : '#3D1A2E' }}>
        {value}
      </span>
    </div>
  )
}

