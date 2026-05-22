import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import { signOut } from '@/app/auth/actions'

export default async function DashboardPage() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) redirect('/auth')

  const insforge = createInsForgeServerClient(accessToken)
  const { data, error } = await insforge.auth.getCurrentUser()
  if (error || !data?.user) redirect('/auth')

  const user = data.user as { email: string; raw_user_meta_data?: { full_name?: string; name?: string } }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#F5F0E8', color: '#3D1A2E' }}
    >
      <div className="text-center">
        <span className="text-2xl font-bold" style={{ color: '#D94F35' }}>
          RSViP
        </span>
        <p className="mt-4 text-lg font-medium">
          안녕하세요, {user.raw_user_meta_data?.full_name ?? user.raw_user_meta_data?.name ?? user.email}님
        </p>
        <p className="mt-1 text-sm" style={{ color: '#8B6A5A' }}>
          {user.email}
        </p>
        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="px-6 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-75"
            style={{ backgroundColor: '#3D1A2E', color: '#F5F0E8' }}
          >
            로그아웃
          </button>
        </form>
      </div>
    </main>
  )
}
