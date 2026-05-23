import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import { notFound } from 'next/navigation'
import RsvpClient from '../RsvpClient'

async function getDb() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  return createInsForgeServerClient(accessToken ?? '')
}

type Props = { params: Promise<{ token: string; guestId: string }> }

/**
 * /rsvp/{eventId}/{guestToken} — 새 형식의 게스트 개인화 RSVP 링크
 * URL 구조상 params.token = eventId 값,  params.guestId = guest_tokens.token 값
 */
export default async function RsvpByGuestPage({ params }: Props) {
  const { token: eventId, guestId: guestToken } = await params
  const db = await getDb()

  // event_id + token 이중 검증
  const { data: tokenData } = await db.database
    .from('guest_tokens')
    .select('guest_id, event_id, type, used_at')
    .eq('token', guestToken)
    .eq('event_id', eventId)
    .eq('type', 'rsvp')
    .limit(1)

  if (!tokenData?.length) return notFound()

  const { guest_id, event_id } = tokenData[0] as { guest_id: string; event_id: string; used_at: string | null }

  const [eventRes, guestRes, rsvpRes, responseRes] = await Promise.all([
    db.database.from('events').select('name, venue, dates').eq('id', event_id).limit(1),
    db.database.from('guests').select('data').eq('id', guest_id).limit(1),
    db.database.from('rsvp_settings').select('enabled, custom_questions').eq('event_id', event_id).limit(1),
    db.database.from('rsvp_responses').select('status, answers').eq('guest_id', guest_id).eq('event_id', event_id).limit(1),
  ])

  type Event    = { name: string; venue: string | null; dates: string[] }
  type GuestRaw = { data: Record<string, string> }
  type Rsvp     = { enabled: boolean; custom_questions: { id: string; text: string; type: 'text' | 'select' | 'number'; options?: string[]; required: boolean }[] }
  type Resp     = { status: 'Y' | 'N' | 'U'; answers: Record<string, string> }

  const event    = eventRes.data?.[0]    as Event    | undefined
  const guest    = guestRes.data?.[0]    as GuestRaw | undefined
  const rsvp     = rsvpRes.data?.[0]     as Rsvp     | undefined
  const existing = responseRes.data?.[0] as Resp     | undefined

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
      token={guestToken}
      guestId={guest_id}
      eventId={event_id}
      eventName={event?.name ?? '이벤트'}
      venue={event?.venue ?? undefined}
      dates={event?.dates ?? []}
      guestData={guest?.data ?? {}}
      customQuestions={rsvp?.custom_questions ?? []}
      existingStatus={existing?.status ?? 'U'}
      existingAnswers={existing?.answers ?? {}}
    />
  )
}
