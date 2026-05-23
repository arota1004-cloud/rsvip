import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import EventMasterClient from './EventMasterClient'

type Event = {
  id: string
  name: string
  host_type: 'business' | 'community'
  event_type: 'ticket' | 'free'
  dates: string[]
  venue: string | null
  memo: string | null
  settings: Record<string, unknown>
  owner_id: string
}

export type UserRole = 'owner' | 'editor' | 'viewer'

export default async function EventMasterPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) redirect('/auth')

  const insforge = createInsForgeServerClient(accessToken)

  // ── 1. 로그인된 auth 유저 확인 ────────────────────────────────────────────────
  const { data: authData, error: authError } = await insforge.auth.getCurrentUser()
  if (authError || !authData?.user) redirect('/auth')

  const authId = (authData.user as { id: string }).id

  // ── 2. public.users.id 조회 (owner_id는 auth_id가 아닌 public.users.id로 저장)
  const { data: usersData } = await insforge.database
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .limit(1)

  if (!usersData || usersData.length === 0) redirect('/auth')

  const userId = (usersData[0] as { id: string }).id

  // ── 3. 이벤트 조회 ────────────────────────────────────────────────────────────
  const { data: eventsData, error: eventsError } = await insforge.database
    .from('events')
    .select('id, name, host_type, event_type, dates, venue, memo, settings, owner_id')
    .eq('id', eventId)
    .limit(1)

  if (eventsError || !eventsData || eventsData.length === 0) {
    redirect('/dashboard')
  }

  const event = eventsData[0] as Event

  // ── 4. 역할 결정 (public.users.id ↔ owner_id 비교) ───────────────────────────
  let userRole: UserRole = 'owner'

  if (event.owner_id !== userId) {
    const { data: staffData } = await insforge.database
      .from('event_staff')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .limit(1)

    if (!staffData || staffData.length === 0) {
      // 이벤트 오너도 스태프도 아님 → 권한 없음
      redirect('/dashboard')
    }
    userRole = (staffData[0] as { role: 'editor' | 'viewer' }).role
  }

  return <EventMasterClient event={event} userId={userId} userRole={userRole} />
}
