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
  { id: 'col_name',    name: '이름',     width: 120, type: 'text' },
  { id: 'col_org',     name: '소속',     width: 140, type: 'text' },
  { id: 'col_phone',   name: '연락처',   width: 130, type: 'text' },
  { id: 'col_email',   name: '이메일',   width: 180, type: 'text' },
  { id: 'col_arrival', name: '도착시간', width: 110, type: 'text' },
  { id: 'col_rsvp',    name: '참석여부', width: 100, type: 'survey' },
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
