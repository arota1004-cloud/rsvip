import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import { setAuthCookies } from '@/lib/auth-cookies'
import type { PendingEventData } from '@/app/eventgenerate/actions'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('insforge_code')
  const oauthError = params.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (oauthError || !code) {
    return NextResponse.redirect(new URL(`/auth?error=${oauthError ?? 'oauth_failed'}`, appUrl))
  }

  const store = await cookies()
  const codeVerifier = store.get('insforge_code_verifier')?.value

  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/auth?error=missing_verifier', appUrl))
  }

  const insforge = createInsForgeServerClient()
  const { data, error } = await insforge.auth.exchangeOAuthCode(code, codeVerifier)

  if (error || !data?.accessToken) {
    return NextResponse.redirect(new URL(`/auth?error=${error?.message ?? 'exchange_failed'}`, appUrl))
  }

  await setAuthCookies(data.accessToken, data.refreshToken ?? '')
  store.delete('insforge_code_verifier')

  // users 테이블 upsert (최초 로그인 시 레코드 생성)
  const serverClient = createInsForgeServerClient(data.accessToken)
  try {
    const { data: userData } = await serverClient.auth.getCurrentUser()
    if (userData?.user) {
      const { id, email, raw_user_meta_data } = userData.user as {
        id: string
        email: string
        raw_user_meta_data?: { full_name?: string; name?: string; avatar_url?: string }
      }
      await serverClient.database.from('users').insert([{
        auth_id: id,
        email,
        name: raw_user_meta_data?.full_name ?? raw_user_meta_data?.name ?? email.split('@')[0],
        avatar_url: raw_user_meta_data?.avatar_url ?? null,
      }])
    }
  } catch {
    // 이미 존재하는 경우 무시
  }

  // 로그인 전 이벤트 생성 요청이 있었는지 확인
  const pendingRaw = store.get('insforge_pending_event')?.value
  if (pendingRaw) {
    store.delete('insforge_pending_event')
    try {
      const pending = JSON.parse(pendingRaw) as PendingEventData
      const { data: authData } = await serverClient.auth.getCurrentUser()
      const authId = (authData?.user as { id: string } | undefined)?.id

      if (authId) {
        const { data: usersData } = await serverClient.database
          .from('users')
          .select('id')
          .eq('auth_id', authId)
          .limit(1)

        const ownerId = usersData?.[0] ? (usersData[0] as { id: string }).id : null
        if (ownerId) {
          const eventId = crypto.randomUUID()
          const { error: insertError } = await serverClient.database.from('events').insert([{
            id: eventId,
            owner_id: ownerId,
            name: pending.name,
            host_type: pending.hostType,
            event_type: pending.eventType,
            dates: pending.dates,
            venue: pending.venue,
          }])

          if (!insertError) {
            return NextResponse.redirect(new URL(`/eventmaster/${eventId}`, appUrl))
          }
        }
      }
    } catch {
      // 이벤트 생성 실패 시 대시보드로 폴백
    }
  }

  return NextResponse.redirect(new URL('/', appUrl))
}
