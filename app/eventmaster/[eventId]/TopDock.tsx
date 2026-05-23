'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { updateEventMeta } from './actions'

type SaveStatus = 'saved' | 'saving' | 'error'

type Alert = {
  id: string
  message: string
  type: 'warn' | 'error' | 'info'
}

type SheetSave = { status: 'saved' | 'saving' | 'error'; savedAt?: string }

type Props = {
  eventId: string
  initialName: string
  initialMemo: string | null
  alerts: Alert[]
  onDismissAlert: (id: string) => void
  sheetSave?: SheetSave
}

export default function TopDock({ eventId, initialName, initialMemo, alerts, onDismissAlert, sheetSave }: Props) {
  const [name, setName] = useState(initialName)
  const [memo, setMemo] = useState(initialMemo ?? '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scheduleSave = useCallback((patch: { name?: string; memo?: string }) => {
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await updateEventMeta(eventId, patch)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 800)
  }, [eventId])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // 메모 textarea 높이 초기화
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 72) + 'px'
    }
  }, [memo])

  const handleNameChange = (v: string) => {
    setName(v)
    if (v.trim()) scheduleSave({ name: v.trim() })
  }

  const handleMemoChange = (v: string) => {
    setMemo(v)
    scheduleSave({ memo: v })
  }

  return (
    <div className="flex flex-col shrink-0" style={{ backgroundColor: '#fff', borderBottom: '2px solid rgba(61,26,46,0.1)' }}>

      {/* 1줄: 로고 + 저장 상태 */}
      <div
        className="flex items-center justify-between px-5"
        style={{ height: 38, borderBottom: '1px solid rgba(61,26,46,0.06)' }}
      >
        <Link
          href="/"
          className="text-sm font-bold tracking-tight"
          style={{ color: '#D94F35' }}
        >
          RSViP
        </Link>
        <span className="text-xs tabular-nums" style={{ color: sheetSave ? sheetSaveColor(sheetSave.status) : saveStatusColor(saveStatus) }}>
          {sheetSave ? sheetSaveLabel(sheetSave) : saveStatusLabel(saveStatus)}
        </span>
      </div>

      {/* 2줄: 이벤트 타이틀 */}
      <div className="px-5" style={{ paddingTop: 10, paddingBottom: 4 }}>
        <input
          type="text"
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="이벤트 이름"
          className="w-full bg-transparent outline-none font-bold"
          style={{ fontSize: 17, color: '#3D1A2E', lineHeight: 1.3 }}
        />
      </div>

      {/* 3줄: 메모 자동저장 textarea */}
      <div className="px-5" style={{ paddingBottom: 10 }}>
        <textarea
          ref={textareaRef}
          value={memo}
          onChange={e => handleMemoChange(e.target.value)}
          placeholder="메모를 입력하세요..."
          rows={1}
          className="w-full bg-transparent outline-none resize-none"
          style={{
            fontSize: 12, color: '#8B6A5A', lineHeight: 1.6,
            overflowY: 'hidden', display: 'block',
          }}
        />
      </div>

      {/* 4줄: 알림 배너 (있을 때만) */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-0.5 px-5 pb-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ backgroundColor: alertBg(alert.type), color: alertColor(alert.type) }}
            >
              <span>{alert.message}</span>
              <button
                onClick={() => onDismissAlert(alert.id)}
                className="opacity-60 hover:opacity-100 transition-opacity shrink-0 text-base leading-none"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function saveStatusLabel(s: SaveStatus) {
  if (s === 'saving') return '저장 중...'
  if (s === 'error') return '저장 실패'
  return '저장됨'
}
function saveStatusColor(s: SaveStatus) {
  if (s === 'saving') return '#8B6A5A'
  if (s === 'error') return '#D94F35'
  return 'rgba(61,26,46,0.3)'
}
function sheetSaveLabel({ status, savedAt }: { status: SaveStatus; savedAt?: string }) {
  if (status === 'saving') return '저장 중...'
  if (status === 'error') return '저장 실패'
  return savedAt ? `저장됨 ${savedAt}` : '저장됨'
}
function sheetSaveColor(s: SaveStatus) {
  if (s === 'saving') return '#8B6A5A'
  if (s === 'error') return '#D94F35'
  return 'rgba(61,26,46,0.3)'
}
function alertBg(type: Alert['type']) {
  if (type === 'error') return 'rgba(217,79,53,0.08)'
  if (type === 'warn') return 'rgba(217,150,53,0.1)'
  return 'rgba(61,26,46,0.05)'
}
function alertColor(type: Alert['type']) {
  if (type === 'error') return '#D94F35'
  if (type === 'warn') return '#A05E10'
  return '#3D1A2E'
}
