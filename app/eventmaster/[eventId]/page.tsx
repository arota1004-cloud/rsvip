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

export default async function EventMasterPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) redirect('/auth')

  const insforge = createInsForgeServerClient(accessToken)
  const { data: authData, error: authError } = await insforge.auth.getCurrentUser()
  if (authError || !authData?.user) redirect('/auth')

  const { data: eventsData, error: eventsError } = await insforge.database
    .from('events')
    .select('id, name, host_type, event_type, dates, venue, memo, settings, owner_id')
    .eq('id', eventId)
    .limit(1)

  if (eventsError || !eventsData || eventsData.length === 0) {
    redirect('/dashboard')
  }

  const event = eventsData[0] as Event

  return <EventMasterClient event={event} />
}
