import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge-server'

type Event = {
  id: string
  name: string
  host_type: 'business' | 'community'
  event_type: 'ticket' | 'free'
  dates: string[]
  venue: string | null
  memo: string | null
  created_at: string
}

export default async function EventMasterIndexPage() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) redirect('/auth')

  const insforge = createInsForgeServerClient(accessToken)

  const { data: authData, error: authError } = await insforge.auth.getCurrentUser()
  if (authError || !authData?.user) redirect('/auth')

  const authUser = authData.user as {
    id: string
    email: string
    raw_user_meta_data?: { full_name?: string; name?: string; avatar_url?: string }
  }
  const displayName =
    authUser.raw_user_meta_data?.full_name ??
    authUser.raw_user_meta_data?.name ??
    authUser.email.split('@')[0]

  const { data: usersData } = await insforge.database
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .limit(1)
  const ownerId = usersData?.[0] ? (usersData[0] as { id: string }).id : null

  const events: Event[] = ownerId
    ? ((
        await insforge.database
          .from('events')
          .select('id, name, host_type, event_type, dates, venue, memo, created_at')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })
      ).data ?? []) as Event[]
    : []

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F0E8', color: '#3D1A2E' }}>

      {/* 상단 헤더 */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6"
        style={{ height: 52, backgroundColor: '#fff', borderBottom: '1px solid rgba(61,26,46,0.1)' }}
      >
        <Link
          href="/"
          className="text-sm font-bold tracking-tight"
          style={{ color: '#FF5C1A' }}
        >
          RSViP
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#8B6A5A' }}>{displayName}</span>
          <Link
            href="/eventgenerate"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-85"
            style={{ backgroundColor: '#FF5C1A', color: '#fff' }}
          >
            + 새 이벤트
          </Link>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* 페이지 타이틀 */}
        <div className="mb-8">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-1"
            style={{ color: '#8B6A5A' }}
          >
            Event Master
          </p>
          <h1 className="text-2xl font-bold">내 이벤트</h1>
        </div>

        {events.length === 0 ? (
          /* 빈 상태 */
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{ border: '1.5px dashed rgba(61,26,46,0.18)', backgroundColor: 'rgba(61,26,46,0.02)' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: 'rgba(255,92,26,0.08)' }}
            >
              <span className="text-2xl">🎪</span>
            </div>
            <p className="font-semibold text-base mb-1">아직 이벤트가 없습니다</p>
            <p className="text-sm mb-7" style={{ color: '#8B6A5A' }}>
              첫 이벤트를 만들고 게스트를 초대해보세요
            </p>
            <Link
              href="/eventgenerate"
              className="px-7 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#FF5C1A', color: '#fff' }}
            >
              이벤트 만들기
            </Link>
          </div>
        ) : (
          /* 이벤트 목록 */
          <div className="flex flex-col gap-3">
            {events.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const dateStr = event.dates.length > 0
    ? event.dates.slice(0, 3).join(' · ') + (event.dates.length > 3 ? ` 외 ${event.dates.length - 3}일` : '')
    : '날짜 미정'

  const hostLabel = event.host_type === 'business' ? '비즈니스' : '커뮤니티'
  const typeLabel = event.event_type === 'ticket' ? '티켓' : '무료'

  const createdAt = new Date(event.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <Link
      href={`/eventmaster/${event.id}`}
      className="group flex items-center gap-5 px-6 py-4 rounded-2xl transition-all hover:shadow-sm"
      style={{
        backgroundColor: '#fff',
        border: '1px solid rgba(61,26,46,0.09)',
      }}
    >
      {/* 아이콘 */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(255,92,26,0.08)' }}
      >
        <span className="text-lg">🎪</span>
      </div>

      {/* 이벤트 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h2 className="font-semibold text-sm truncate">{event.name || '(이름 없음)'}</h2>
          <span
            className="shrink-0 text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(61,26,46,0.07)', color: '#8B6A5A' }}
          >
            {hostLabel} · {typeLabel}
          </span>
        </div>
        <p className="text-xs truncate" style={{ color: '#8B6A5A' }}>
          {dateStr}
          {event.venue ? ` · ${event.venue}` : ''}
        </p>
      </div>

      {/* 생성일 + 화살표 */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs hidden sm:block" style={{ color: 'rgba(61,26,46,0.3)' }}>
          {createdAt} 생성
        </span>
        <span
          className="text-base transition-transform group-hover:translate-x-0.5"
          style={{ color: '#FF5C1A' }}
        >
          →
        </span>
      </div>
    </Link>
  )
}
