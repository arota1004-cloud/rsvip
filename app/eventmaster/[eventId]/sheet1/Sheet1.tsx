'use client'

import { useEffect, useState } from 'react'
import GuestSheet from './GuestSheet'
import { loadSheet } from './actions'
import type { Column, GuestRow } from './actions'

type Props = {
  eventId: string
  readOnly?: boolean
  onSaveStatusChange?: (status: 'saved' | 'saving' | 'error', savedAt?: string) => void
  onAlert?: (msg: string, type?: 'warn' | 'error' | 'info') => void
}

export default function Sheet1({ eventId, readOnly = false, onSaveStatusChange, onAlert }: Props) {
  const [data, setData] = useState<{ columns: Column[]; rows: GuestRow[] } | null>(null)

  useEffect(() => {
    loadSheet(eventId).then(setData)
  }, [eventId])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: '#8B6A5A' }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <GuestSheet
      eventId={eventId}
      initialColumns={data.columns}
      initialRows={data.rows}
      readOnly={readOnly}
      onSaveStatusChange={onSaveStatusChange ?? (() => {})}
      onAlert={onAlert ?? (() => {})}
    />
  )
}
