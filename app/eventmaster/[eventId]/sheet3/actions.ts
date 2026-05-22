'use server'

import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'

async function getInsForge() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) throw new Error('인증이 필요합니다.')
  return createInsForgeServerClient(accessToken)
}

export type EventSettings = {
  invitationEnabled: boolean
  rsvpEnabled: boolean
  confirmedInviteEnabled: boolean
  qrCheckinEnabled: boolean
  postEventEnabled: boolean
}

export type StaffMember = {
  id: string
  event_id: string
  user_id: string | null
  email: string
  role: 'editor' | 'viewer'
  invited_at: string
  accepted_at: string | null
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

  const defaultSettings: EventSettings = {
    invitationEnabled: false,
    rsvpEnabled: false,
    confirmedInviteEnabled: false,
    qrCheckinEnabled: false,
    postEventEnabled: false,
  }

  const settings = eventData && eventData.length > 0
    ? { ...defaultSettings, ...(eventData[0] as { settings: Partial<EventSettings> }).settings }
    : defaultSettings

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

export async function inviteStaff(eventId: string, email: string, role: 'editor' | 'viewer'): Promise<StaffMember> {
  const insforge = await getInsForge()
  const id = crypto.randomUUID()
  const record: StaffMember = {
    id,
    event_id: eventId,
    user_id: null,
    email,
    role,
    invited_at: new Date().toISOString(),
    accepted_at: null,
  }
  await insforge.database.from('event_staff').insert([record])
  return record
}

export async function updateStaffRole(staffId: string, role: 'editor' | 'viewer') {
  const insforge = await getInsForge()
  await insforge.database.from('event_staff').update({ role }).eq('id', staffId)
}

export async function removeStaff(staffId: string) {
  const insforge = await getInsForge()
  await insforge.database.from('event_staff').delete().eq('id', staffId)
}
