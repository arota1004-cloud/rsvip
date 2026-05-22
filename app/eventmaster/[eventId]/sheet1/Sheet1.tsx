'use client'

import { useEffect, useState, useCallback } from 'react'
import SpreadsheetGrid from './SpreadsheetGrid'
import { loadSheet } from './actions'
import type { Column, GuestRow } from './actions'

type SaveStatus = 'saved' | 'saving' | 'error'

type Props = {
  eventId: string
  onSaveStatusChange?: (s: SaveStatus) => void
  onAlert?: (msg: string, type?: 'warn' | 'error' | 'info') => void
}

export default function Sheet1({ eventId, onSaveStatusChange, onAlert }: Props) {
  const [columns, setColumns] = useState<Column[] | null>(null)
  const [rows, setRows] = useState<GuestRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSheet(eventId).then(({ columns, rows }) => {
      setColumns(columns)
      setRows(rows)
      setLoading(false)
    })
  }, [eventId])

  const handleSaveStatus = useCallback((s: SaveStatus) => {
    onSaveStatusChange?.(s)
  }, [onSaveStatusChange])

  const handleAlert = useCallback((msg: string, type?: 'warn' | 'error' | 'info') => {
    onAlert?.(msg, type)
  }, [onAlert])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8B6A5A', fontSize: 13 }}>
        불러오는 중...
      </div>
    )
  }

  if (!columns || !rows) return null

  return (
    <SpreadsheetGrid
      eventId={eventId}
      initialColumns={columns}
      initialRows={rows}
      onSaveStatusChange={handleSaveStatus}
      onAlert={handleAlert}
    />
  )
}
