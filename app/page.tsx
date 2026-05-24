import { cookies } from 'next/headers'
import { createInsForgeServerClient } from '@/lib/insforge-server'
import LandingNav from './components/LandingNav'

export default async function Home() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value

  let navProps: React.ComponentProps<typeof LandingNav>

  if (accessToken) {
    try {
      const insforge = createInsForgeServerClient(accessToken)
      const { data: authData } = await insforge.auth.getCurrentUser()
      const authUser = authData?.user as {
        id: string; email: string
        raw_user_meta_data?: { full_name?: string; name?: string; avatar_url?: string }
      } | undefined

      if (authUser) {
        const { data: usersData } = await insforge.database
          .from('users').select('id').eq('auth_id', authUser.id).limit(1)
        const ownerId = usersData?.[0] ? (usersData[0] as { id: string }).id : null

        const events = ownerId ? await insforge.database
          .from('events')
          .select('id, name, dates, created_at')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })
          .then(r => (r.data ?? []) as { id: string; name: string; dates: string[]; created_at: string }[])
          : []

        navProps = {
          isLoggedIn: true,
          user: {
            name: authUser.raw_user_meta_data?.full_name ?? authUser.raw_user_meta_data?.name ?? authUser.email.split('@')[0],
            email: authUser.email,
            avatarUrl: authUser.raw_user_meta_data?.avatar_url,
          },
          events,
        }
      } else {
        navProps = { isLoggedIn: false }
      }
    } catch {
      navProps = { isLoggedIn: false }
    }
  } else {
    navProps = { isLoggedIn: false }
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#F5F0E8', color: '#3D1A2E' }}>
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fu1 { animation: fade-in-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
        .fu2 { animation: fade-in-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
        .fu3 { animation: fade-in-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.25s both; }
        .fu4 { animation: fade-in-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s both; }
        .fu5 { animation: fade-in-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.48s both; }
        .mock-anim {
          animation: fade-in-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both,
                     mock-float 5s ease-in-out 1s infinite;
        }
        @keyframes mock-float {
          0%,100% { transform: translateY(0px) rotate(-1.5deg); }
          50%      { transform: translateY(-10px) rotate(-1.5deg); }
        }
        .cta-primary:hover { opacity: 0.87; }
        .cta-ghost:hover   { opacity: 0.65; }
        .feature-card:hover { background: rgba(61,26,46,0.07) !important; }
      `}</style>

      <LandingNav {...navProps} />

      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pt-14 pb-28 lg:pt-20 lg:pb-36">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-16">

          {/* ── 왼쪽: 텍스트 ── */}
          <div className="flex-1 max-w-lg w-full">

            {/* 뱃지 */}
            <div className="fu1 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold mb-8"
                 style={{ backgroundColor: 'rgba(255,92,26,0.1)', color: '#FF5C1A', border: '1px solid rgba(255,92,26,0.22)' }}>
              <span style={{ fontSize: 9 }}>✦</span>
              카드 등록 없이 무료 시작
            </div>

            {/* 헤드라인 */}
            <h1 className="fu2 font-bold tracking-tight"
                style={{ fontSize: 'clamp(2.6rem, 5vw, 3.75rem)', lineHeight: 1.12, marginBottom: '1.5rem' }}>
              초대장부터<br />
              QR 입장까지,<br />
              <span style={{ color: '#FF5C1A', position: 'relative', display: 'inline-block' }}>
                한 번에.
                {/* 데코 언더라인 */}
                <svg viewBox="0 0 120 10" fill="none" xmlns="http://www.w3.org/2000/svg"
                     aria-hidden="true"
                     style={{ position: 'absolute', left: 0, top: '100%', width: '100%', marginTop: -2, pointerEvents: 'none' }}>
                  <path d="M2 7 C30 2, 80 1, 118 5" stroke="#FF5C1A" strokeWidth="3.5"
                        strokeLinecap="round" fill="none" opacity="0.45" />
                </svg>
              </span>
            </h1>

            {/* 서브카피 */}
            <p className="fu3 leading-relaxed mb-10"
               style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.1rem)', color: '#8B6A5A' }}>
              게스트 리스트업, 초대장 발송, RSVP 회신 수집,<br className="hidden sm:block" />
              현장 QR 체크인을 하나의 플로우에서 완결합니다.
            </p>

            {/* CTA */}
            <div className="fu4 flex items-center gap-3 flex-wrap mb-11">
              <a href="/eventgenerate"
                 className="cta-primary inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm"
                 style={{ backgroundColor: '#FF5C1A', color: '#fff', transition: 'opacity 0.15s' }}>
                무료로 시작하기
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="#features"
                 className="cta-ghost inline-flex items-center px-7 py-3.5 rounded-full font-semibold text-sm"
                 style={{ border: '1.5px solid rgba(61,26,46,0.22)', color: '#3D1A2E', transition: 'opacity 0.15s' }}>
                기능 살펴보기
              </a>
            </div>

            {/* 트러스트 스트립 */}
            <div className="fu5 flex items-center gap-5 flex-wrap">
              {[
                { emoji: '⚡', label: '3분 안에 시작' },
                { emoji: '🆓', label: '별도 견적 없음' },
                { emoji: '📱', label: 'QR 체크인 포함' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13 }}>{item.emoji}</span>
                  <span className="text-xs font-medium" style={{ color: '#8B6A5A' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 오른쪽: 제품 목업 ── */}
          <div className="flex-1 max-w-xl w-full mock-anim" style={{ transform: 'rotate(-1.5deg)' }}>
            <ProductMockup />
          </div>

        </div>
      </section>

      {/* ─── Divider ────────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-8">
        <hr style={{ borderColor: '#8B6A5A', opacity: 0.2 }} />
      </div>

      {/* ─── Features ──────────────────────────────────────────────────────────── */}
      <section id="features" className="max-w-4xl mx-auto px-8 py-24">
        <p className="text-xs font-semibold tracking-widest uppercase mb-4 text-center" style={{ color: '#FF5C1A' }}>
          WHY RSViP
        </p>
        <h2 className="text-2xl font-bold mb-14 text-center" style={{ color: '#3D1A2E' }}>
          RSViP이 다른 이유
        </h2>

        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="feature-card flex gap-5 items-start p-6 rounded-2xl"
              style={{ backgroundColor: 'rgba(61,26,46,0.04)', transition: 'background 0.15s' }}
            >
              <span className="text-2xl shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <h3 className="font-semibold text-sm mb-1.5" style={{ color: '#3D1A2E' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#8B6A5A' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Divider ────────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-8">
        <hr style={{ borderColor: '#8B6A5A', opacity: 0.2 }} />
      </div>

      {/* ─── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-8 py-28 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold mb-7"
             style={{ backgroundColor: 'rgba(255,92,26,0.1)', color: '#FF5C1A', border: '1px solid rgba(255,92,26,0.22)' }}>
          지금 바로 시작하세요
        </div>
        <h2 className="text-4xl font-bold mb-5" style={{ lineHeight: 1.2 }}>
          첫 이벤트를<br />3분 안에 만들어보세요
        </h2>
        <p className="text-base mb-10" style={{ color: '#8B6A5A' }}>
          리스트업부터 사후 관리까지, 한 번에 해결합니다.
        </p>
        <a
          href="/eventgenerate"
          className="cta-primary inline-flex items-center gap-2 px-10 py-4 rounded-full font-semibold text-base"
          style={{ backgroundColor: '#FF5C1A', color: '#fff', transition: 'opacity 0.15s' }}
        >
          무료로 시작하기
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t px-8 py-8 text-center" style={{ borderColor: 'rgba(61,26,46,0.12)' }}>
        <p className="text-xs" style={{ color: 'rgba(61,26,46,0.35)' }}>© 2026 RSViP. All rights reserved.</p>
      </footer>
    </main>
  )
}

// ─── 제품 목업 (순수 HTML/CSS, JS 없음) ─────────────────────────────────────────
const MOCK_GUESTS = [
  { name: '김민준', org: '테크스타트업', phone: '010-1234-5678', rsvp: 'Y' },
  { name: '이서연', org: '디자인에이전시', phone: '010-2345-6789', rsvp: 'N' },
  { name: '박지호', org: '콘텐츠스튜디오', phone: '010-3456-7890', rsvp: 'Y' },
  { name: '최유진', org: '마케팅팀',       phone: '010-4567-8901', rsvp: 'U' },
]

const RSVP_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  Y: { bg: 'rgba(34,197,94,0.12)',   text: '#15803d', label: 'Y — 참석' },
  N: { bg: 'rgba(239,68,68,0.1)',    text: '#dc2626', label: 'N — 불참' },
  U: { bg: 'rgba(107,114,128,0.1)',  text: '#6b7280', label: 'U — 미정' },
}

function ProductMockup() {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: 16,
      boxShadow: '0 32px 80px rgba(61,26,46,0.18), 0 4px 16px rgba(61,26,46,0.08)',
      border: '1px solid rgba(61,26,46,0.09)',
      overflow: 'hidden',
    }}>
      {/* ── 윈도우 크롬 ── */}
      <div style={{
        backgroundColor: '#F0EBE1',
        borderBottom: '1px solid rgba(61,26,46,0.1)',
        padding: '10px 14px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {/* 트래픽 라이트 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['#FF6058', '#FEBC2E', '#28C840'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />
          ))}
        </div>

        {/* 탭 바 */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { label: '시트1: 게스트 목록', active: true },
            { label: '시트2: 초대장', active: false },
            { label: '시트3: 설정', active: false },
          ].map(tab => (
            <div key={tab.label} style={{
              padding: '5px 12px',
              borderRadius: '6px 6px 0 0',
              fontSize: 10,
              fontWeight: 600,
              backgroundColor: tab.active ? '#fff' : 'transparent',
              color: tab.active ? '#3D1A2E' : '#8B6A5A',
              borderBottom: tab.active ? '2px solid #FF5C1A' : 'none',
              whiteSpace: 'nowrap',
            }}>
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── 툴바 ── */}
      <div style={{
        padding: '7px 12px',
        borderBottom: '1px solid rgba(61,26,46,0.08)',
        display: 'flex', alignItems: 'center', gap: 6,
        backgroundColor: '#fff',
      }}>
        {['📂 파일 가져오기', '+ 행 추가'].map(label => (
          <div key={label} style={{
            padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 500,
            border: '1px solid rgba(61,26,46,0.15)', color: '#3D1A2E',
          }}>
            {label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{
          padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
          backgroundColor: '#FF5C1A', color: '#fff',
        }}>
          💾 저장
        </div>
      </div>

      {/* ── 스프레드시트 헤더 ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 88px 100px 96px 82px',
        backgroundColor: '#F0EBE1',
        borderBottom: '2px solid rgba(61,26,46,0.15)',
      }}>
        <div style={{ padding: '6px 6px', fontSize: 9, color: '#8B6A5A', textAlign: 'center',
          borderRight: '2px solid rgba(61,26,46,0.15)' }}>
          #
        </div>
        {['이름', '소속', '연락처', '참석여부'].map(col => (
          <div key={col} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, color: '#3D1A2E' }}>
            {col}
          </div>
        ))}
      </div>

      {/* ── 데이터 행 ── */}
      {MOCK_GUESTS.map((g, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '28px 88px 100px 96px 82px',
          borderBottom: '1px solid rgba(61,26,46,0.06)',
          backgroundColor: i === 0 ? 'rgba(255,92,26,0.04)' : 'transparent',
        }}>
          {/* 행 번호 */}
          <div style={{
            padding: '7px 6px', fontSize: 10, color: '#8B6A5A', textAlign: 'center',
            borderRight: '2px solid rgba(61,26,46,0.15)',
            backgroundColor: i === 0 ? 'rgba(255,92,26,0.04)' : '#F0EBE1',
          }}>
            {i + 1}
          </div>
          <div style={{ padding: '7px 8px', fontSize: 11, color: '#3D1A2E', fontWeight: 500 }}>{g.name}</div>
          <div style={{ padding: '7px 8px', fontSize: 10, color: '#8B6A5A' }}>{g.org}</div>
          <div style={{ padding: '7px 8px', fontSize: 10, color: '#8B6A5A' }}>{g.phone}</div>
          <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center' }}>
            <span style={{
              padding: '2px 7px', borderRadius: 9999,
              fontSize: 9, fontWeight: 700,
              backgroundColor: RSVP_STYLE[g.rsvp].bg,
              color: RSVP_STYLE[g.rsvp].text,
            }}>
              {RSVP_STYLE[g.rsvp].label}
            </span>
          </div>
        </div>
      ))}

      {/* ── 하단 상태바 ── */}
      <div style={{
        display: 'flex', gap: 14, padding: '7px 12px',
        backgroundColor: '#faf8f4',
        borderTop: '1px solid rgba(61,26,46,0.07)',
      }}>
        <span style={{ fontSize: 10, color: '#8B6A5A' }}>4행</span>
        <span style={{ fontSize: 10, color: '#15803d', fontWeight: 600 }}>참석 2</span>
        <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>불참 1</span>
        <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>미정 1</span>
      </div>
    </div>
  )
}

// ─── Features 데이터 ────────────────────────────────────────────────────────────
const features = [
  {
    icon: '📊',
    title: '익숙한 엑셀 스타일 게스트 관리',
    desc: '기존에 쓰던 스프레드시트 방식 그대로 게스트를 관리합니다. CSV / 엑셀 파일 그대로 업로드.',
  },
  {
    icon: '🔐',
    title: '단계별 시트 권한 분리',
    desc: '팀원·파트너·현장 스태프 각각 필요한 권한만 부여합니다. 보안과 유연한 공유를 동시에.',
  },
  {
    icon: '✉️',
    title: '초대장 발송 · RSVP 회신 수집',
    desc: '이메일 발송부터 참석 여부 수집까지 한 플로우에서 완결. 필터별 타겟 발송도 가능합니다.',
  },
  {
    icon: '📱',
    title: 'QR 코드 현장 입장',
    desc: 'QR 스캔 한 번으로 입장 시간 기록 · CS 최소화. 긴 줄 없이 빠르고 정확하게 체크인.',
  },
  {
    icon: '📈',
    title: '행사 이후 사후 관리',
    desc: '포토 업로드 확인, 다음 모임 생성까지 — 행사가 끝난 뒤에도 RSViP 하나로 완결.',
  },
  {
    icon: '🆓',
    title: '완전 무료, 별도 견적 없음',
    desc: '복잡한 플랜 없이 모든 기능을 즉시 사용할 수 있습니다. 지금 바로 첫 이벤트를 만들어보세요.',
  },
]
