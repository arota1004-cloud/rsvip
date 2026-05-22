'use client'

import { initiateGoogleOAuth } from './actions'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  if (!error) return null
  return (
    <p className="text-sm text-center mb-4" style={{ color: '#7A2A35' }}>
      로그인 중 오류가 발생했습니다. 다시 시도해 주세요.
    </p>
  )
}

export default function AuthPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#F5F0E8', color: '#3D1A2E' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="text-3xl font-bold tracking-tight" style={{ color: '#D94F35' }}>
            RSViP
          </span>
          <p className="mt-2 text-sm" style={{ color: '#8B6A5A' }}>
            행사 초대부터 사후 관리까지 한 번에
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ backgroundColor: 'rgba(61,26,46,0.04)', border: '1px solid rgba(139,106,90,0.2)' }}
        >
          <h1 className="text-xl font-semibold mb-1 text-center">시작하기</h1>
          <p className="text-sm text-center mb-8" style={{ color: '#8B6A5A' }}>
            Google 계정으로 바로 로그인
          </p>

          <Suspense>
            <AuthError />
          </Suspense>

          <form action={initiateGoogleOAuth}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#ffffff', color: '#3D1A2E', border: '1px solid rgba(61,26,46,0.15)' }}
            >
              <GoogleIcon />
              Google로 계속하기
            </button>
          </form>
        </div>

        <p className="mt-6 text-xs text-center" style={{ color: '#8B6A5A' }}>
          계속하면 RSViP 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
