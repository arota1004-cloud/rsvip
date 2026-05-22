import { cookies } from 'next/headers'
import EventGenerateClient from './EventGenerateClient'

export default async function EventGeneratePage() {
  const isLoggedIn = !!(await cookies()).get('insforge_access_token')?.value
  return <EventGenerateClient isLoggedIn={isLoggedIn} />
}
