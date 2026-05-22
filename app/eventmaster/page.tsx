import Link from 'next/link'

export default function EventMasterPage({
  searchParams,
}: {
  searchParams: { name?: string; hostType?: string; eventType?: string; dates?: string; venue?: string }
}) {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#F5F0E8', color: '#3D1A2E' }}
    >
      <div className="max-w-md w-full text-center">
        <Link href="/" className="text-xl font-bold tracking-tight block mb-12" style={{ color: '#D94F35' }}>
          RSViP
        </Link>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#8B6A5A' }}>
          Coming soon
        </p>
        <h1 className="text-2xl font-bold mb-2">이벤트 마스터 페이지</h1>
        <p className="text-sm mb-8" style={{ color: '#8B6A5A' }}>
          &ldquo;{searchParams.name}&rdquo; 이벤트가 곧 열립니다.
        </p>
        <div
          className="rounded-2xl p-6 text-left text-sm mb-8"
          style={{ backgroundColor: 'rgba(61,26,46,0.04)', border: '1px solid rgba(139,106,90,0.2)' }}
        >
          <Row label="행사 주최" value={searchParams.hostType === 'business' ? '비즈니스 행사' : '커뮤니티 모임'} />
          <Row label="이벤트 형태" value={searchParams.eventType === 'ticket' ? '티켓 구매형' : '무료 초청형'} />
          <Row label="날짜" value={searchParams.dates?.split(',').join(' · ') ?? '-'} />
          <Row label="장소" value={searchParams.venue ?? '-'} last />
        </div>
        <Link
          href="/eventgenerate"
          className="text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: '#D94F35' }}
        >
          ← 다시 설정하기
        </Link>
      </div>
    </main>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className="flex justify-between gap-4 py-3"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(139,106,90,0.15)' }}
    >
      <span style={{ color: '#8B6A5A' }}>{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
