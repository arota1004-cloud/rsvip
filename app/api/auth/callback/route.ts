import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import { setAuthCookies } from '@/lib/auth-cookies'

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

  // users 테이블에 upsert (최초 로그인 시 레코드 생성)
  try {
    const serverClient = createInsForgeServerClient(data.accessToken)
    const { data: userData } = await serverClient.auth.getCurrentUser()

    if (userData?.user) {
      const { id, email, raw_user_meta_data } = userData.user as {
        id: string
        email: string
        raw_user_meta_data?: { full_name?: string; name?: string; avatar_url?: string }
      }
      await serverClient.database.from('users').insert([
        {
          auth_id: id,
          email,
          name: raw_user_meta_data?.full_name ?? raw_user_meta_data?.name ?? email.split('@')[0],
          avatar_url: raw_user_meta_data?.avatar_url ?? null,
        },
      ])
    }
  } catch {
    // 이미 존재하는 경우 무시 (unique constraint)
  }

  return NextResponse.redirect(new URL('/dashboard', appUrl))
}
