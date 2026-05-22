'use client'

import { useEffect, useRef, useCallback } from 'react'
import { upsertGuests, saveColumns } from './actions'
import type { Column, GuestRow } from './actions'

type SaveStatus = 'saved' | 'saving' | 'error'

export function useAutoSave(
  eventId: string,
  columns: Column[],
  flushDirty: () => GuestRow[],
  onStatusChange: (s: SaveStatus) => void
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevColumnsRef = useRef<string>(JSON.stringify(columns))

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    onStatusChange('saving')
    timer.current = setTimeout(async () => {
      try {
        const dirtyRows = flushDirty()
        const columnsJson = JSON.stringify(columns)
        const columnsChanged = columnsJson !== prevColumnsRef.current

        await Promise.all([
          dirtyRows.length > 0 ? upsertGuests(eventId, dirtyRows) : Promise.resolve(),
          columnsChanged ? saveColumns(eventId, columns) : Promise.resolve(),
        ])

        if (columnsChanged) prevColumnsRef.current = columnsJson
        onStatusChange('saved')
      } catch {
        onStatusChange('error')
      }
    }, 600)
  }, [eventId, columns, flushDirty, onStatusChange])

  // columns 변경 시 자동 트리거
  useEffect(() => {
    if (JSON.stringify(columns) !== prevColumnsRef.current) schedule()
  }, [columns, schedule])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { schedule }
}
