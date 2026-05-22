'use server'

import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'

async function getInsForge() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value ?? ''
  return createInsForgeServerClient(accessToken)
}

export async function submitRsvp({
  token,
  guestId,
  eventId,
  status,
  answers,
}: {
  token: string
  guestId: string
  eventId: string
  status: 'Y' | 'N'
  answers: Record<string, string>
}) {
  const insforge = await getInsForge()

  await insforge.database.from('rsvp_responses').upsert([{
    guest_id: guestId,
    event_id: eventId,
    status,
    answers,
    responded_at: new Date().toISOString(),
  }], { onConflict: 'event_id,guest_id' })

  // 참석여부 컬럼 업데이트
  const { data: guestData } = await insforge.database
    .from('guests')
    .select('data')
    .eq('id', guestId)
    .limit(1)

  if (guestData && guestData.length > 0) {
    const { data: colData } = await insforge.database
      .from('guest_sheets')
      .select('columns')
      .eq('event_id', eventId)
      .limit(1)

    if (colData && colData.length > 0) {
      const cols = (colData[0] as { columns: { id: string; name: string; type: string }[] }).columns
      const rsvpCol = cols.find(c => c.type === 'rsvp')
      if (rsvpCol) {
        const currentData = (guestData[0] as { data: Record<string, string> }).data
        await insforge.database.from('guests').update({
          data: { ...currentData, [rsvpCol.id]: status },
        }).eq('id', guestId)
      }
    }
  }

  // 토큰 used_at 마킹
  await insforge.database.from('guest_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
}
