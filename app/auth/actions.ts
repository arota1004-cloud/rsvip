'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import { setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies'

export async function initiateGoogleOAuth() {
  const insforge = createInsForgeServerClient()

  const { data, error } = await insforge.auth.signInWithOAuth({
    provider: 'google',
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    skipBrowserRedirect: true,
  })

  if (error || !data?.url) {
    throw new Error(error?.message ?? 'OAuth 시작에 실패했습니다.')
  }

  const store = await cookies()
  store.set('insforge_code_verifier', data.codeVerifier!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  redirect(data.url)
}

export async function signOut() {
  await clearAuthCookies()
  redirect('/')
}
