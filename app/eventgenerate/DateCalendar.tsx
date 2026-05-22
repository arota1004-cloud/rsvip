'use client'

import { useState, useRef, useEffect } from 'react'

// ─── helpers ───────────────────────────────────────────────────────

const DAY = ['일', '월', '화', '수', '목', '금', '토']

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parse(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getRange(a: string, b: string): string[] {
  let da = parse(a), db = parse(b)
  if (da > db) [da, db] = [db, da]
  const out: string[] = []
  const c = new Date(da)
  while (c <= db) {
    out.push(fmt(c.getFullYear(), c.getMonth(), c.getDate()))
    c.setDate(c.getDate() + 1)
  }
  return out
}

function isConsecutive(sorted: string[]) {
  for (let i = 1; i < sorted.length; i++) {
    const p = parse(sorted[i - 1])
    p.setDate(p.getDate() + 1)
    if (fmt(p.getFullYear(), p.getMonth(), p.getDate()) !== sorted[i]) return false
  }
  return true
}

function krDate(key: string) {
  const d = parse(key)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}(${DAY[d.getDay()]})`
}

export function formatDisplay(keys: string[]): string {
  if (!keys.length) return ''
  const s = [...keys].sort()
  if (isConsecutive(s)) {
    if (s.length === 1) return krDate(s[0])
    return `${krDate(s[0])} ~ ${krDate(s[s.length - 1])}`
  }
  return s.map(krDate).join(', ')
}

// ─── component ─────────────────────────────────────────────────────

interface Props {
  onChange: (dates: string[]) => void
}

type CellPos = 'single' | 'first' | 'last' | 'middle' | null

export default function DateCalendar({ onChange }: Props) {
  const today = new Date()
  const todayKey = fmt(today.getFullYear(), today.getMonth(), today.getDate())

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)

  // refs for stable event-handler access
  const isDragRef = useRef(false)
  const dragStartRef = useRef<string | null>(null)
  const lastClickRef = useRef<string | null>(null)
  const selectedRef = useRef<Set<string>>(new Set())
  const previewRef = useRef<Set<string>>(new Set())
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  function commit(next: Set<string>) {
    const copy = new Set(next)
    setSelected(copy)
    selectedRef.current = copy
    onChangeRef.current([...copy].sort())
  }

  // ── navigation ──

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // ── grid ──

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => fmt(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // ── visual state ──

  const activeSet = isDragging ? preview : selected
  const sortedActive = [...activeSet].sort()
  const rangeMode = isConsecutive(sortedActive) && sortedActive.length > 1

  function cellPos(key: string): CellPos {
    if (!activeSet.has(key)) return null
    if (!rangeMode) return 'single'
    if (key === sortedActive[0]) return 'first'
    if (key === sortedActive[sortedActive.length - 1]) return 'last'
    return 'middle'
  }

  // ── mouse handlers ──

  function onDown(key: string, e: React.MouseEvent) {
    e.preventDefault()

    // Shift+click: extend range
    if (e.shiftKey && lastClickRef.current) {
      const next = new Set(selectedRef.current)
      getRange(lastClickRef.current, key).forEach(k => next.add(k))
      commit(next)
      lastClickRef.current = key
      return
    }

    // Ctrl/Cmd+click: toggle
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedRef.current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      commit(next)
      lastClickRef.current = key
      return
    }

    // Start drag
    isDragRef.current = true
    setIsDragging(true)
    dragStartRef.current = key
    const p = new Set([key])
    previewRef.current = p
    setPreview(p)
  }

  function onEnter(key: string) {
    if (!isDragRef.current || !dragStartRef.current) return
    const p = new Set(getRange(dragStartRef.current, key))
    previewRef.current = p
    setPreview(p)
  }

  function finishDrag(targetKey?: string) {
    if (!isDragRef.current) return

    const p = previewRef.current
    const start = dragStartRef.current
    const end = targetKey ?? null

    if (p.size === 1 && start === end) {
      // Simple click: toggle, clear others
      const key = [...p][0]
      if (selectedRef.current.has(key) && selectedRef.current.size === 1) {
        commit(new Set())
      } else {
        commit(new Set([key]))
      }
      lastClickRef.current = key
    } else if (p.size > 1) {
      // Drag range: replace selection
      commit(p)
      lastClickRef.current = [...p].sort().pop() ?? null
    }

    isDragRef.current = false
    setIsDragging(false)
    dragStartRef.current = null
    previewRef.current = new Set()
    setPreview(new Set())
  }

  // Global mouseup: commit whatever is in preview
  useEffect(() => {
    const onUp = () => finishDrag(undefined)
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const displayText = formatDisplay([...selected].sort())

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: '#fff',
        border: '1.5px solid rgba(61,26,46,0.15)',
        userSelect: 'none',
      }}
    >
      {/* Month nav */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid rgba(61,26,46,0.08)' }}
      >
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full text-base transition-colors hover:bg-black/5"
          style={{ color: '#3D1A2E' }}
        >
          ‹
        </button>
        <span className="text-sm font-semibold" style={{ color: '#3D1A2E' }}>
          {year}. {String(month + 1).padStart(2, '0')}
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full text-base transition-colors hover:bg-black/5"
          style={{ color: '#3D1A2E' }}
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-2 pt-3 pb-1">
        {DAY.map((d, i) => (
          <div
            key={d}
            className="text-center text-xs font-medium py-1"
            style={{ color: i === 0 ? '#D94F35' : '#8B6A5A' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 px-2 pb-3">
        {cells.map((key, idx) => {
          if (!key) return <div key={`e-${idx}`} />

          const pos = cellPos(key)
          const dow = parse(key).getDay()
          const isToday = key === todayKey

          // Connecting bar behind circles for consecutive range
          let barStyle: React.CSSProperties = {}
          const barColor = 'rgba(61,26,46,0.09)'
          if (pos === 'first')  barStyle = { background: `linear-gradient(to right, transparent 50%, ${barColor} 50%)` }
          if (pos === 'last')   barStyle = { background: `linear-gradient(to left, transparent 50%, ${barColor} 50%)` }
          if (pos === 'middle') barStyle = { backgroundColor: barColor }

          // Circle
          const filled = pos === 'single' || pos === 'first' || pos === 'last'
          const circleStyle: React.CSSProperties = filled
            ? { backgroundColor: '#3D1A2E', borderRadius: '50%' }
            : pos === 'middle'
            ? { backgroundColor: 'transparent' }
            : {}

          const textColor = filled
            ? '#F5F0E8'
            : pos === 'middle'
            ? '#3D1A2E'
            : dow === 0
            ? '#D94F35'
            : '#3D1A2E'

          return (
            <div key={key} className="py-0.5" style={barStyle}>
              <div
                className="relative mx-auto w-9 h-9 flex items-center justify-center cursor-pointer text-sm font-medium rounded-full transition-colors hover:bg-black/5"
                style={{ ...circleStyle, color: textColor }}
                onMouseDown={e => onDown(key, e)}
                onMouseEnter={() => onEnter(key)}
                onMouseUp={() => finishDrag(key)}
              >
                {parse(key).getDate()}
                {isToday && !pos && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: '#D94F35' }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected date display */}
      {displayText && (
        <div
          className="px-5 py-3 text-sm font-medium"
          style={{
            borderTop: '1px solid rgba(61,26,46,0.08)',
            color: '#D94F35',
            backgroundColor: 'rgba(217,79,53,0.04)',
          }}
        >
          {displayText}
        </div>
      )}
    </div>
  )
}
