'use server'

import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'

async function getInsForge() {
  // RSVP는 공개 액션 — 로그인 세션이 있으면 사용, 없으면 anon key
  const accessToken = (await cookies()).get('insforge_access_token')?.value ?? ''
  return createInsForgeServerClient(accessToken)
}

export async function submitRsvp({
  token,
  status,
  answers,
}: {
  token: string
  // ✅ guestId / eventId 를 클라이언트에서 받지 않음
  //    → token으로 서버에서 직접 guest_id / event_id 도출
  status: 'Y' | 'N'
  answers: Record<string, string>
}) {
  const insforge = await getInsForge()

  // ── 1. token → guest_id / event_id 서버 검증 ──────────────────────────────
  const { data: tokenData, error: tokenError } = await insforge.database
    .from('guest_tokens')
    .select('guest_id, event_id, type')
    .eq('token', token)
    .eq('type', 'rsvp')     // rsvp 토큰만 수락
    .limit(1)

  if (tokenError || !tokenData || tokenData.length === 0) {
    throw new Error('유효하지 않은 RSVP 토큰입니다.')
  }

  const { guest_id: guestId, event_id: eventId } = tokenData[0] as {
    guest_id: string
    event_id: string
    type: string
  }

  // ── 2. RSVP 응답 저장 ──────────────────────────────────────────────────────
  const { error: upsertError } = await insforge.database
    .from('rsvp_responses')
    .upsert([{
      guest_id: guestId,
      event_id: eventId,
      status,
      answers,
      responded_at: new Date().toISOString(),
    }], { onConflict: 'event_id,guest_id' })

  if (upsertError) throw new Error('응답 저장에 실패했습니다.')

  // ── 3. guests.data 의 survey(참석여부) 컬럼 업데이트 ──────────────────────
  const [{ data: guestData }, { data: colData }] = await Promise.all([
    insforge.database.from('guests').select('data').eq('id', guestId).limit(1),
    insforge.database.from('guest_sheets').select('columns').eq('event_id', eventId).limit(1),
  ])

  if (guestData?.length && colData?.length) {
    const cols = (colData[0] as { columns: { id: string; name: string; type: string }[] }).columns
    // 컬럼 type은 'survey' (구 'rsvp' 아님)
    const surveyCol = cols.find(c => c.type === 'survey')
    if (surveyCol) {
      const currentData = (guestData[0] as { data: Record<string, string> }).data
      await insforge.database
        .from('guests')
        .update({ data: { ...currentData, [surveyCol.id]: status } })
        .eq('id', guestId)
    }
  }

  // ── 4. 토큰 used_at 마킹 ───────────────────────────────────────────────────
  await insforge.database
    .from('guest_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .eq('type', 'rsvp')
}
