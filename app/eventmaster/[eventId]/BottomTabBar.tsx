'use client'

type Tab = 1 | 2 | 3

type TabDef = { id: Tab; label: string }

type Props = {
  activeTab: Tab
  onChange: (tab: Tab) => void
  tabs?: TabDef[]
}

const DEFAULT_TABS: TabDef[] = [
  { id: 1, label: '게스트 목록' },
  { id: 2, label: '초대장' },
  { id: 3, label: '기본 설정' },
]

export default function BottomTabBar({ activeTab, onChange, tabs = DEFAULT_TABS }: Props) {
  return (
    <div
      className="flex items-end shrink-0 select-none"
      style={{
        backgroundColor: '#F0EBE1',
        borderTop: '1px solid rgba(61,26,46,0.12)',
        height: 36,
        overflowX: 'auto',        // 모바일 가로 스크롤
        overflowY: 'hidden',
        paddingLeft: 8,
        /* 스크롤바 숨김 */
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map(tab => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative text-xs font-medium transition-colors rounded-t-md shrink-0"
            style={{
              height: 32,
              padding: '0 20px',
              whiteSpace: 'nowrap',
              backgroundColor: active ? '#FFFFFF' : 'transparent',
              color: active ? '#3D1A2E' : '#8B6A5A',
              border: active ? '1px solid rgba(61,26,46,0.12)' : '1px solid transparent',
              borderBottom: active ? '2px solid #D94F35' : '1px solid transparent',
              marginBottom: -1,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        )
      })}

      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
