'use client'

import { useState, useCallback } from 'react'
import TopDock from './TopDock'
import BottomTabBar from './BottomTabBar'
import Sheet1 from './sheet1/Sheet1'
import Sheet2 from './sheet2/Sheet2'
import Sheet3 from './sheet3/Sheet3'

type Tab = 1 | 2 | 3

type Alert = {
  id: string
  message: string
  type: 'warn' | 'error' | 'info'
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
}

type Props = {
  event: Event
}

export default function EventMasterClient({ event }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(1)
  const [alerts, setAlerts] = useState<Alert[]>([])

  const addAlert = useCallback((message: string, type: Alert['type'] = 'warn') => {
    const id = crypto.randomUUID()
    setAlerts(prev => [...prev, { id, message, type }])
  }, [])

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

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
      />

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 1 && (
          <Sheet1
            eventId={event.id}
            onSaveStatusChange={status => {
              // Sheet1 저장 상태를 TopDock에 반영하려면 추가 상태 연결 필요 (현재는 TopDock 자체 관리)
            }}
            onAlert={addAlert}
          />
        )}
        {activeTab === 2 && (
          <Sheet2
            eventId={event.id}
            onSaveStatusChange={() => {}}
            onAlert={addAlert}
          />
        )}
        {activeTab === 3 && <Sheet3 eventId={event.id} onAlert={addAlert} />}
      </div>

      <BottomTabBar activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}
