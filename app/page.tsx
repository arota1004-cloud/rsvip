export default function Home() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#F5F0E8", color: "#3D1A2E" }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <span className="text-xl font-bold tracking-tight" style={{ color: "#D94F35" }}>
          RSViP
        </span>
        <a
          href="#"
          className="text-sm font-medium px-5 py-2 rounded-full transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#D94F35", color: "#F5F0E8" }}
        >
          시작하기
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-8 pt-20 pb-24 text-center">
        <p className="text-sm font-medium tracking-widest uppercase mb-6" style={{ color: "#8B6A5A" }}>
          Event Management · RSVP · QR Check-in
        </p>
        <h1 className="text-5xl font-bold leading-tight mb-6" style={{ lineHeight: "1.15" }}>
          소규모 커뮤니티 모임부터<br />
          브랜드 비즈니스 행사까지
        </h1>
        <p className="text-lg mb-10" style={{ color: "#8B6A5A" }}>
          별도 견적 없이, 간편하게 이벤트 개설
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="#"
            className="px-8 py-3 rounded-full font-semibold text-base transition-opacity hover:opacity-85"
            style={{ backgroundColor: "#D94F35", color: "#F5F0E8" }}
          >
            무료로 시작하기
          </a>
          <a
            href="#features"
            className="px-8 py-3 rounded-full font-semibold text-base border transition-opacity hover:opacity-70"
            style={{ borderColor: "#3D1A2E", color: "#3D1A2E" }}
          >
            기능 살펴보기
          </a>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-8">
        <hr style={{ borderColor: "#8B6A5A", opacity: 0.25 }} />
      </div>

      {/* Features */}
      <section id="features" className="max-w-3xl mx-auto px-8 py-24">
        <h2 className="text-xs font-semibold tracking-widest uppercase mb-14 text-center" style={{ color: "#8B6A5A" }}>
          RSViP이 다른 이유
        </h2>
        <div className="grid gap-8">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex gap-6 items-start p-7 rounded-2xl"
              style={{ backgroundColor: "rgba(61,26,46,0.04)" }}
            >
              <span
                className="text-2xl font-bold tabular-nums shrink-0 mt-0.5"
                style={{ color: "#D94F35" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-semibold text-base mb-1">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#8B6A5A" }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-8">
        <hr style={{ borderColor: "#8B6A5A", opacity: 0.25 }} />
      </div>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-8 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">
          지금 바로 행사를 만들어보세요
        </h2>
        <p className="text-base mb-10" style={{ color: "#8B6A5A" }}>
          리스트업부터 사후 관리까지, 한 번에 해결합니다.
        </p>
        <a
          href="#"
          className="inline-block px-10 py-4 rounded-full font-semibold text-base transition-opacity hover:opacity-85"
          style={{ backgroundColor: "#7A2A35", color: "#F5F0E8" }}
        >
          무료로 시작하기
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t px-8 py-8 text-center text-xs" style={{ borderColor: "#8B6A5A", opacity: 0.6, color: "#8B6A5A" }}>
        © 2026 RSViP. All rights reserved.
      </footer>
    </main>
  );
}

const features = [
  {
    title: "익숙한 엑셀 디자인, 쉬운 연동",
    desc: "기존에 쓰던 스프레드시트 방식 그대로 게스트 리스트를 관리할 수 있습니다.",
  },
  {
    title: "단계별 시트 권한 분리",
    desc: "보안과 유연한 공유를 동시에. 팀원·파트너·현장 스태프 각각 필요한 권한만 부여합니다.",
  },
  {
    title: "리스트업 · 인비테이션 발송 · RSVP 관리",
    desc: "초대장 발송부터 참석 여부 수집까지 한 플로우에서 완결됩니다.",
  },
  {
    title: "QR 코드 현장 입장",
    desc: "QR 스캔 한 번으로 입장 시간 기록 · CS 최소화. 긴 줄 없이 빠르고 정확하게.",
  },
  {
    title: "행사 이후 사후 관리",
    desc: "포토 업로드 확인, 다음 모임 생성까지 — 행사가 끝난 뒤에도 RSViP 하나로.",
  },
];
