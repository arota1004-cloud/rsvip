'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge-server'

export type PendingEventData = {
  name: string
  hostType: 'business' | 'community'
  eventType: 'ticket' | 'free'
  dates: string[]
  venue: string
}

export async function createEvent(formData: PendingEventData) {
  const store = await cookies()
  const accessToken = store.get('insforge_access_token')?.value

  if (!accessToken) {
    // 폼 데이터를 쿠키에 보존하고 로그인 페이지로 이동
    store.set('insforge_pending_event', JSON.stringify(formData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10분
    })
    redirect('/auth')
  }

  await createEventWithToken(accessToken, formData)
}

export async function createEventWithToken(accessToken: string, formData: PendingEventData) {
  const insforge = createInsForgeServerClient(accessToken)
  const { data: authData, error: authError } = await insforge.auth.getCurrentUser()
  if (authError || !authData?.user) redirect('/auth')

  const { data: usersData, error: usersError } = await insforge.database
    .from('users')
    .select('id')
    .eq('auth_id', (authData.user as { id: string }).id)
    .limit(1)

  if (usersError || !usersData || usersData.length === 0) redirect('/auth')

  const ownerId = (usersData[0] as { id: string }).id
  const eventId = crypto.randomUUID()

  const { error: insertError } = await insforge.database.from('events').insert([{
    id: eventId,
    owner_id: ownerId,
    name: formData.name,
    host_type: formData.hostType,
    event_type: formData.eventType,
    dates: formData.dates,
    venue: formData.venue,
  }])

  if (insertError) throw new Error('이벤트 생성에 실패했습니다.')

  redirect(`/eventmaster/${eventId}`)
}
