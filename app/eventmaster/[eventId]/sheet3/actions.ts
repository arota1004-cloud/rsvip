'use server'

import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import type { EventSettings, StaffMember } from './types'
import { DEFAULT_SETTINGS } from './types'

async function getInsForge() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) throw new Error('인증이 필요합니다.')
  return createInsForgeServerClient(accessToken)
}

export async function loadSheet3(eventId: string) {
  const insforge = await getInsForge()

  const { data: eventData } = await insforge.database
    .from('events')
    .select('settings')
    .eq('id', eventId)
    .limit(1)

  const { data: staffData } = await insforge.database
    .from('event_staff')
    .select('*')
    .eq('event_id', eventId)
    .order('invited_at', { ascending: true })

  const settings: EventSettings = eventData && eventData.length > 0
    ? { ...DEFAULT_SETTINGS, ...(eventData[0] as { settings: Partial<EventSettings> }).settings }
    : { ...DEFAULT_SETTINGS }

  return {
    settings,
    staff: (staffData ?? []) as StaffMember[],
  }
}

export async function updateSettings(eventId: string, settings: EventSettings) {
  const insforge = await getInsForge()
  await insforge.database.from('events').update({
    settings,
    updated_at: new Date().toISOString(),
  }).eq('id', eventId)
}

export async function inviteStaff(
  eventId: string,
  email: string,
  role: 'editor' | 'viewer',
): Promise<StaffMember> {
  const insforge = await getInsForge()

  // ── 이미 초대된 이메일 중복 체크 ──────────────────────────────────────────────
  const { data: existing } = await insforge.database
    .from('event_staff')
    .select('id')
    .eq('event_id', eventId)
    .eq('email', email)
    .limit(1)

  if (existing && existing.length > 0) {
    throw new Error('이미 초대된 이메일입니다.')
  }

  // ── 이메일로 기존 유저 조회 → user_id 즉시 채우기 ─────────────────────────────
  // public.users 테이블에 email 컬럼이 있을 경우 즉시 연결
  // (email 컬럼이 없는 환경이라면 { data: null } 반환 → null 처리)
  const { data: userData } = await insforge.database
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)

  const resolvedUserId =
    userData && userData.length > 0
      ? (userData[0] as { id: string }).id
      : null

  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const record: StaffMember = {
    id,
    event_id: eventId,
    user_id: resolvedUserId,            // 기존 유저 → 즉시 연결, 미가입 → null
    email,
    role,
    invited_at: now,
    accepted_at: resolvedUserId ? now : null, // 기존 유저는 즉시 수락 처리
  }

  const { error } = await insforge.database.from('event_staff').insert([record])
  if (error) throw new Error('스태프 초대에 실패했습니다.')

  return record
}

/**
 * 초대 수락 플로우 (미가입 유저가 가입 후 초대 링크 클릭)
 * - staffId(= event_staff.id)로 레코드 조회
 * - 로그인된 유저의 이메일이 초대 이메일과 일치하는지 검증
 * - user_id + accepted_at 업데이트
 */
export async function acceptStaffInvite(staffId: string): Promise<{
  eventId: string
  role: 'editor' | 'viewer'
}> {
  const insforge = await getInsForge()

  // ── 1. 로그인 유저 확인 ────────────────────────────────────────────────────────
  const { data: authData, error: authError } = await insforge.auth.getCurrentUser()
  if (authError || !authData?.user) throw new Error('로그인이 필요합니다.')

  const authUser = authData.user as { id: string; email?: string }
  const authEmail = authUser.email ?? ''

  // ── 2. public.users.id 조회 ───────────────────────────────────────────────────
  const { data: usersData } = await insforge.database
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .limit(1)

  if (!usersData || usersData.length === 0) throw new Error('유저 정보를 찾을 수 없습니다.')
  const userId = (usersData[0] as { id: string }).id

  // ── 3. 초대 레코드 조회 ───────────────────────────────────────────────────────
  const { data: staffData } = await insforge.database
    .from('event_staff')
    .select('id, event_id, email, role, accepted_at')
    .eq('id', staffId)
    .limit(1)

  if (!staffData || staffData.length === 0) throw new Error('유효하지 않은 초대 링크입니다.')

  const invite = staffData[0] as {
    id: string
    event_id: string
    email: string
    role: 'editor' | 'viewer'
    accepted_at: string | null
  }

  // ── 4. 이메일 일치 검증 ───────────────────────────────────────────────────────
  if (invite.email.toLowerCase() !== authEmail.toLowerCase()) {
    throw new Error(`이 초대는 ${invite.email} 계정으로만 수락할 수 있습니다.`)
  }

  // ── 5. 이미 수락된 경우 → 중복 처리 없이 통과 ──────────────────────────────
  if (invite.accepted_at) {
    return { eventId: invite.event_id, role: invite.role }
  }

  // ── 6. user_id + accepted_at 연결 ─────────────────────────────────────────────
  const { error } = await insforge.database
    .from('event_staff')
    .update({
      user_id: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', staffId)

  if (error) throw new Error('초대 수락에 실패했습니다.')

  return { eventId: invite.event_id, role: invite.role }
}

export async function updateStaffRole(staffId: string, role: 'editor' | 'viewer') {
  const insforge = await getInsForge()
  await insforge.database.from('event_staff').update({ role }).eq('id', staffId)
}

export async function removeStaff(staffId: string) {
  const insforge = await getInsForge()
  await insforge.database.from('event_staff').delete().eq('id', staffId)
}
