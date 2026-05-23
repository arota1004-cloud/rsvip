'use client'

import { useState, useCallback } from 'react'
import TopDock from './TopDock'
import BottomTabBar from './BottomTabBar'
import Sheet1 from './sheet1/Sheet1'
import Sheet2 from './sheet2/InvitationSheet'
import Sheet3 from './sheet3/Sheet3'
import type { EventSettings } from './sheet3/types'
import { DEFAULT_SETTINGS } from './sheet3/types'
import type { UserRole } from './page'

type Tab = 1 | 2 | 3

type Alert = {
  id: string
  message: string
  type: 'warn' | 'error' | 'info'
}

type SheetSave = {
  status: 'saved' | 'saving' | 'error'
  savedAt?: string
}

type Event = {
  id: string
  name: string
  memo: string | null
  host_type: 'business' | 'community'
  event_type: 'ticket' | 'free'
  dates: string[]
  venue: string | null
  settings: Record<string, unknown>
  owner_id: string
}

type Props = {
  event: Event
  userId: string
  userRole: UserRole
}

export default function EventMasterClient({ event, userRole }: Props) {
  const isOwner   = userRole === 'owner'
  const canEdit   = userRole === 'owner' || userRole === 'editor'

  const [activeTab, setActiveTab]   = useState<Tab>(1)
  const [alerts, setAlerts]         = useState<Alert[]>([])
  const [sheetSave, setSheetSave]   = useState<SheetSave>({ status: 'saved' })

  // Sheet3 설정 상태 — Sheet2(초대장)에 실시간 전달
  const [settings, setSettings] = useState<EventSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...(event.settings as Partial<EventSettings>),
  }))

  // Sheet2에서 발송 완료 시 Sheet1을 강제 리마운트(데이터 재로드)
  const [sheet1RefreshKey, setSheet1RefreshKey] = useState(0)

  // ── 알림 관리 ──────────────────────────────────────────────────────────────
  const addAlert = useCallback((message: string, type: Alert['type'] = 'warn') => {
    const id = crypto.randomUUID()
    setAlerts(prev => [...prev, { id, message, type }])
    // info/warn 알림은 5초 후 자동 dismiss
    if (type === 'info') {
      setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 5000)
    }
  }, [])

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  // ── 저장 상태 ──────────────────────────────────────────────────────────────
  const handleSheetSave = useCallback((status: 'saved' | 'saving' | 'error', savedAt?: string) => {
    setSheetSave({ status, savedAt })
  }, [])

  // ── Sheet3 설정 변경 → Sheet2로 전달 ──────────────────────────────────────
  const handleSettingsChange = useCallback((next: EventSettings) => {
    setSettings(next)
  }, [])

  // ── Sheet2 발송 완료 → Sheet1 새로고침 ────────────────────────────────────
  const handleSendComplete = useCallback(() => {
    setSheet1RefreshKey(k => k + 1)
  }, [])

  // ── 탭 목록 (스태프는 기본 설정 숨김) ─────────────────────────────────────
  const tabs = [
    { id: 1 as Tab, label: '게스트 목록' },
    { id: 2 as Tab, label: '초대장' },
    ...(isOwner ? [{ id: 3 as Tab, label: '기본 설정' }] : []),
  ]

  // 스태프가 기본 설정 탭에 있다가 숨겨지면 탭1로 이동
  const safeTab: Tab = !isOwner && activeTab === 3 ? 1 : activeTab

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', backgroundColor: '#F5F0E8' }}
    >
      <TopDock
        eventId={event.id}
        initialName={event.name}
        initialMemo={event.memo}
        alerts={alerts}
        onDismissAlert={dismissAlert}
        sheetSave={sheetSave}
      />

      <div className="flex-1 overflow-hidden min-h-0">
        {safeTab === 1 && (
          <Sheet1
            key={sheet1RefreshKey}
            eventId={event.id}
            readOnly={!canEdit}
            onSaveStatusChange={handleSheetSave}
            onAlert={addAlert}
          />
        )}
        {safeTab === 2 && (
          <Sheet2
            eventId={event.id}
            onSaveStatusChange={handleSheetSave}
            onAlert={addAlert}
            confirmedInviteEnabled={settings.confirmedInviteEnabled}
            rsvpEnabled={settings.rsvpEnabled}
            invitationEnabled={settings.invitationEnabled}
            onSendComplete={handleSendComplete}
          />
        )}
        {safeTab === 3 && isOwner && (
          <Sheet3
            eventId={event.id}
            onAlert={addAlert}
            onSettingsChange={handleSettingsChange}
          />
        )}
      </div>

      <BottomTabBar activeTab={safeTab} onChange={setActiveTab} tabs={tabs} />
    </div>
  )
}
