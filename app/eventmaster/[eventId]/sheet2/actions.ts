'use server'

import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'

async function getInsForge() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) throw new Error('인증이 필요합니다.')
  return createInsForgeServerClient(accessToken)
}

export type FilterRule = {
  id: string
  columnId: string
  condition: 'eq' | 'neq' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty'
  value: string
  logic: 'AND' | 'OR'
}

export type CustomQuestion = {
  id: string
  text: string
  type: 'text' | 'select' | 'number'
  options?: string[]
  required: boolean
}

export type Invitation = {
  id: string
  event_id: string
  name: string
  html_content: string
  filter_rules: FilterRule[]
  sort_order: number
  created_at: string
}

export type SendRecord = {
  id: string
  invitation_id: string
  event_id: string
  sender_user_id: string
  channel: 'email' | 'link' | 'sms'
  sent_to_count: number
  guest_ids: string[]
  sent_at: string
  invitation_name?: string
  sender_email?: string
}

// ── 초대장 CRUD ───────────────────────────────────────────────
export async function loadSheet2(eventId: string) {
  const insforge = await getInsForge()

  const { data: invData } = await insforge.database
    .from('invitations')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })

  const { data: histData } = await insforge.database
    .from('send_history')
    .select('*')
    .eq('event_id', eventId)
    .order('sent_at', { ascending: false })

  const { data: rsvpData } = await insforge.database
    .from('rsvp_settings')
    .select('*')
    .eq('event_id', eventId)
    .limit(1)

  const { data: colData } = await insforge.database
    .from('guest_sheets')
    .select('columns')
    .eq('event_id', eventId)
    .limit(1)

  const invitations = (invData ?? []) as Invitation[]
  // 초대장 없으면 기본 1개 생성
  if (invitations.length === 0) {
    const id = crypto.randomUUID()
    await insforge.database.from('invitations').insert([{
      id, event_id: eventId, name: '최초 발송', html_content: '', filter_rules: [], sort_order: 0,
    }])
    invitations.push({ id, event_id: eventId, name: '최초 발송', html_content: '', filter_rules: [], sort_order: 0, created_at: new Date().toISOString() })
  }

  return {
    invitations,
    history: (histData ?? []) as SendRecord[],
    rsvpEnabled: rsvpData && rsvpData.length > 0 ? (rsvpData[0] as { enabled: boolean }).enabled : true,
    customQuestions: rsvpData && rsvpData.length > 0 ? (rsvpData[0] as { custom_questions: CustomQuestion[] }).custom_questions : [],
    columns: colData && colData.length > 0 ? (colData[0] as { columns: { id: string; name: string }[] }).columns : [],
  }
}

export async function saveInvitation(invitation: Pick<Invitation, 'id' | 'event_id' | 'name' | 'html_content' | 'filter_rules'>) {
  const insforge = await getInsForge()
  await insforge.database.from('invitations').upsert([{
    ...invitation,
    updated_at: new Date().toISOString(),
  }], { onConflict: 'id' })
}

export async function duplicateInvitation(invitationId: string): Promise<Invitation> {
  const insforge = await getInsForge()
  const { data } = await insforge.database
    .from('invitations')
    .select('*')
    .eq('id', invitationId)
    .limit(1)

  if (!data || data.length === 0) throw new Error('초대장을 찾을 수 없습니다.')
  const src = data[0] as Invitation

  const newId = crypto.randomUUID()
  const newInv: Invitation = {
    ...src,
    id: newId,
    name: `${src.name} (복사)`,
    sort_order: src.sort_order + 1,
    created_at: new Date().toISOString(),
  }
  await insforge.database.from('invitations').insert([newInv])
  return newInv
}

export async function deleteInvitation(invitationId: string) {
  const insforge = await getInsForge()
  await insforge.database.from('invitations').delete().eq('id', invitationId)
}

// ── RSVP 설정 ─────────────────────────────────────────────────
export async function saveRsvpSettings(eventId: string, enabled: boolean, customQuestions: CustomQuestion[]) {
  const insforge = await getInsForge()
  await insforge.database.from('rsvp_settings').upsert([{
    event_id: eventId, enabled, custom_questions: customQuestions,
    updated_at: new Date().toISOString(),
  }], { onConflict: 'event_id' })
}

// ── 발송 ──────────────────────────────────────────────────────
export async function recordSend(
  eventId: string,
  invitationId: string,
  channel: 'email' | 'link' | 'sms',
  guestIds: string[]
) {
  const insforge = await getInsForge()
  const { data: userData } = await insforge.auth.getCurrentUser()
  const authId = (userData?.user as { id: string } | undefined)?.id
  const { data: usersData } = await insforge.database
    .from('users').select('id').eq('auth_id', authId ?? '').limit(1)
  const senderId = usersData?.[0] ? (usersData[0] as { id: string }).id : ''

  await insforge.database.from('send_history').insert([{
    event_id: eventId,
    invitation_id: invitationId,
    sender_user_id: senderId,
    channel,
    sent_to_count: guestIds.length,
    guest_ids: guestIds,
  }])
}

// ── 인비테이션 발송 후 게스트 시트 업데이트 ───────────────────
export async function markGuestsAsSent(eventId: string, guestIds: string[], invLabel: string) {
  if (!guestIds.length) return
  const insforge = await getInsForge()

  // __inv__ 컬럼이 없으면 guest_sheets에 추가
  const { data: sheetData } = await insforge.database
    .from('guest_sheets').select('columns').eq('event_id', eventId).limit(1)

  if (sheetData?.[0]) {
    type ColItem = { id: string; name: string; width: number; type: string }
    const cols = (sheetData[0] as { columns: ColItem[] }).columns
    if (!cols.find(c => c.id === '__inv__')) {
      await insforge.database.from('guest_sheets')
        .update({ columns: [...cols, { id: '__inv__', name: '인비테이션 발송', width: 200, type: 'text' }] })
        .eq('event_id', eventId)
    }
  }

  // 현재 게스트 데이터 조회
  const { data: guests } = await insforge.database
    .from('guests').select('id, row_index, data').in('id', guestIds)

  if (!guests?.length) return

  // __inv__ 필드 병합 후 일괄 upsert
  type GuestRecord = { id: string; row_index: number; data: Record<string, string> }
  const records = (guests as GuestRecord[]).map(g => ({
    id: g.id,
    event_id: eventId,
    row_index: g.row_index,
    data: { ...g.data, '__inv__': invLabel },
    updated_at: new Date().toISOString(),
  }))

  await insforge.database.from('guests').upsert(records, { onConflict: 'id' })
}

// ── 게스트 토큰 생성 (RSVP / QR) ─────────────────────────────
export async function generateGuestTokens(eventId: string, guestIds: string[], type: 'rsvp' | 'qr_checkin') {
  const insforge = await getInsForge()
  const records = guestIds.map(guestId => ({
    guest_id: guestId,
    event_id: eventId,
    type,
  }))
  const { data } = await insforge.database
    .from('guest_tokens')
    .upsert(records, { onConflict: 'guest_id,type' } as never)
    .select('guest_id, token')

  return (data ?? []) as { guest_id: string; token: string }[]
}
