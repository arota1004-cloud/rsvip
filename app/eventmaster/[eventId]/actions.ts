'use server'

import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'

async function getInsForge() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) throw new Error('인증이 필요합니다.')
  return createInsForgeServerClient(accessToken)
}

export async function updateEventMeta(
  eventId: string,
  patch: { name?: string; memo?: string }
) {
  const insforge = await getInsForge()
  const { error } = await insforge.database
    .from('events')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) throw new Error('저장에 실패했습니다.')
}
