import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import { acceptStaffInvite } from '@/app/eventmaster/[eventId]/sheet3/actions'

/**
 * 스태프 초대 수락 페이지
 *
 * 흐름:
 *   1. 로그인 안 됨   → /auth?next=/staff-invite/[staffId] 로 리디렉션
 *   2. 로그인 됨      → acceptStaffInvite(staffId) 실행
 *      a. 성공        → /eventmaster/[eventId] 로 리디렉션
 *      b. 이메일 불일치 → 에러 메시지 표시
 *      c. 유효하지 않은 링크 → 에러 메시지 표시
 */
export default async function StaffInvitePage({
  params,
}: {
  params: Promise<{ staffId: string }>
}) {
  const { staffId } = await params
  const accessToken = (await cookies()).get('insforge_access_token')?.value

  // ── 1. 미로그인 → 인증 페이지로 ─────────────────────────────────────────────
  if (!accessToken) {
    redirect(`/auth?next=/staff-invite/${staffId}`)
  }

  // ── 2. 초대 수락 시도 ─────────────────────────────────────────────────────────
  let errorMessage: string | null = null
  let targetEventId: string | null = null

  try {
    const result = await acceptStaffInvite(staffId)
    targetEventId = result.eventId
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : '초대 수락에 실패했습니다.'
  }

  // ── 3. 성공 → 이벤트 마스터 페이지로 ─────────────────────────────────────────
  if (targetEventId) {
    redirect(`/eventmaster/${targetEventId}`)
  }

  // ── 4. 실패 → 안내 페이지 ─────────────────────────────────────────────────────
  // 이메일 불일치, 링크 만료, 기타 에러
  const insforge = createInsForgeServerClient(accessToken)
  const { data: authData } = await insforge.auth.getCurrentUser()
  const userEmail = (authData?.user as { email?: string } | undefined)?.email ?? ''

  return (
    <div className="min-h-dvh flex items-center justify-center p-6" style={{ backgroundColor: '#F5F0E8' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ backgroundColor: '#fff', boxShadow: '0 4px 24px rgba(61,26,46,0.1)' }}
      >
        <div className="text-5xl mb-4">⚠️</div>

        <h1 className="text-lg font-bold mb-2" style={{ color: '#3D1A2E' }}>
          초대 수락 실패
        </h1>

        <p className="text-sm mb-4" style={{ color: '#8B6A5A', lineHeight: 1.6 }}>
          {errorMessage}
        </p>

        {userEmail && (
          <p className="text-xs mb-6 px-4 py-3 rounded-lg" style={{ backgroundColor: 'rgba(61,26,46,0.05)', color: '#8B6A5A' }}>
            현재 로그인 계정: <strong style={{ color: '#3D1A2E' }}>{userEmail}</strong>
            <br />
            초대 이메일과 일치하는 계정으로 로그인 후 다시 시도해 주세요.
          </p>
        )}

        <a
          href="/dashboard"
          className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: '#D94F35' }}
        >
          대시보드로 이동
        </a>
      </div>
    </div>
  )
}
