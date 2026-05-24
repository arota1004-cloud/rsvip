'use server'

import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'

async function getInsForge() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) throw new Error('인증이 필요합니다.')
  return createInsForgeServerClient(accessToken)
}

export type Column = {
  id: string
  name: string
  width: number
  type: 'text' | 'dropdown' | 'survey'
  options?: string[]  // dropdown 타입 선택지
}

export type GuestRow = {
  id: string
  row_index: number
  data: Record<string, string>
}

const DEFAULT_COLUMNS: Column[] = [
  { id: 'col_handle',   name: '활동명',          width: 130, type: 'text' },
  { id: 'col_gender',   name: '성별',            width:  90, type: 'dropdown', options: ['남', '여'] },
  { id: 'col_org',      name: '직업/소속',       width: 150, type: 'text' },
  { id: 'col_channel',  name: '주력 채널',       width: 110, type: 'dropdown', options: ['IG', 'YT', 'TW', 'FB', 'TK', '기타'] },
  { id: 'col_link',     name: '채널 링크',       width: 180, type: 'text' },
  { id: 'col_followers',name: '팔로워수',        width: 100, type: 'text' },
  { id: 'col_manager',  name: '담당자',          width: 100, type: 'text' },
  { id: 'col_photo',    name: '포토월 희망',     width: 110, type: 'dropdown', options: ['Y', 'N'] },
  { id: 'col_time',     name: '참석 시간',       width: 110, type: 'text' },
  { id: 'col_rsvp',     name: 'RSVP 참석 여부', width: 120, type: 'survey' },
]

export async function loadSheet(eventId: string): Promise<{ columns: Column[]; rows: GuestRow[] }> {
  const insforge = await getInsForge()

  const { data: sheetData } = await insforge.database
    .from('guest_sheets')
    .select('columns')
    .eq('event_id', eventId)
    .limit(1)

  let columns: Column[]
  if (!sheetData || sheetData.length === 0) {
    // 첫 접근 시 기본 컬럼으로 시트 생성
    await insforge.database.from('guest_sheets').insert([
      { event_id: eventId, columns: DEFAULT_COLUMNS },
    ])
    columns = DEFAULT_COLUMNS
  } else {
    columns = (sheetData[0] as { columns: Column[] }).columns
  }

  const { data: guestsData } = await insforge.database
    .from('guests')
    .select('id, row_index, data')
    .eq('event_id', eventId)
    .order('row_index', { ascending: true })

  const rows: GuestRow[] = (guestsData ?? []) as GuestRow[]
  return { columns, rows }
}

export async function saveColumns(eventId: string, columns: Column[]) {
  const insforge = await getInsForge()
  await insforge.database
    .from('guest_sheets')
    .update({ columns, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
}

export async function upsertGuests(eventId: string, rows: GuestRow[]) {
  if (rows.length === 0) return
  const insforge = await getInsForge()
  const records = rows.map(r => ({
    id: r.id,
    event_id: eventId,
    row_index: r.row_index,
    data: r.data,
    updated_at: new Date().toISOString(),
  }))
  await insforge.database.from('guests').upsert(records, { onConflict: 'id' })
}

export async function deleteGuests(guestIds: string[]) {
  if (guestIds.length === 0) return
  const insforge = await getInsForge()
  await insforge.database.from('guests').delete().in('id', guestIds)
}
