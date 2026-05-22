'use client'

type Tab = 1 | 2 | 3

const TABS: { id: Tab; label: string }[] = [
  { id: 1, label: '게스트 목록' },
  { id: 2, label: '초대장' },
  { id: 3, label: '기본 설정' },
]

type Props = {
  activeTab: Tab
  onChange: (tab: Tab) => void
}

export default function BottomTabBar({ activeTab, onChange }: Props) {
  return (
    <div
      className="flex items-end shrink-0 px-2 select-none"
      style={{
        backgroundColor: '#F0EBE1',
        borderTop: '1px solid rgba(61,26,46,0.12)',
        height: '36px',
      }}
    >
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="relative px-5 text-xs font-medium transition-colors rounded-t-md"
          style={{
            height: '32px',
            backgroundColor: activeTab === tab.id ? '#FFFFFF' : 'transparent',
            color: activeTab === tab.id ? '#3D1A2E' : '#8B6A5A',
            border: activeTab === tab.id ? '1px solid rgba(61,26,46,0.12)' : '1px solid transparent',
            borderBottom: activeTab === tab.id ? '2px solid #D94F35' : '1px solid transparent',
            marginBottom: '-1px',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
