import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import RsvpClient from './RsvpClient'
import { notFound } from 'next/navigation'

async function getAnonymousInsForge() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (accessToken) return createInsForgeServerClient(accessToken)
  // 공개 페이지이므로 anon key 사용
  return createInsForgeServerClient('')
}

export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const insforge = await getAnonymousInsForge()

  // 토큰 조회
  const { data: tokenData } = await insforge.database
    .from('guest_tokens')
    .select('guest_id, event_id, type, used_at')
    .eq('token', token)
    .eq('type', 'rsvp')
    .limit(1)

  if (!tokenData || tokenData.length === 0) return notFound()

  const { guest_id, event_id } = tokenData[0] as { guest_id: string; event_id: string; used_at: string | null }

  // 이벤트 정보
  const { data: eventData } = await insforge.database
    .from('events')
    .select('name, venue, dates')
    .eq('id', event_id)
    .limit(1)

  // 게스트 정보
  const { data: guestData } = await insforge.database
    .from('guests')
    .select('data')
    .eq('id', guest_id)
    .limit(1)

  // RSVP 설정
  const { data: rsvpData } = await insforge.database
    .from('rsvp_settings')
    .select('enabled, custom_questions')
    .eq('event_id', event_id)
    .limit(1)

  // 기존 응답
  const { data: responseData } = await insforge.database
    .from('rsvp_responses')
    .select('status, answers')
    .eq('guest_id', guest_id)
    .eq('event_id', event_id)
    .limit(1)

  const event = eventData?.[0] as { name: string; venue: string | null; dates: string[] } | undefined
  const guestRaw = guestData?.[0] as { data: Record<string, string> } | undefined
  const rsvp = rsvpData?.[0] as { enabled: boolean; custom_questions: { id: string; text: string; type: 'text' | 'select'; options?: string[]; required: boolean }[] } | undefined
  const existing = responseData?.[0] as { status: 'Y' | 'N' | 'U'; answers: Record<string, string> } | undefined

  if (!rsvp?.enabled) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E8' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 16, color: '#3D1A2E', fontWeight: 600 }}>RSVP가 비활성화된 이벤트입니다.</p>
        </div>
      </div>
    )
  }

  return (
    <RsvpClient
      token={token}
      eventName={event?.name ?? '이벤트'}
      venue={event?.venue ?? undefined}
      dates={event?.dates ?? []}
      guestData={guestRaw?.data ?? {}}
      customQuestions={rsvp?.custom_questions ?? []}
      existingStatus={existing?.status ?? 'U'}
      existingAnswers={existing?.answers ?? {}}
    />
  )
}
