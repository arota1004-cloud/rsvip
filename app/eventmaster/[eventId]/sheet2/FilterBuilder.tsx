'use client'

import { useState, useMemo } from 'react'
import type { FilterRule } from './actions'
import type { Column, GuestRow } from '../sheet1/actions'

type Props = {
  rules: FilterRule[]
  columns: Column[]
  rows: GuestRow[]
  onChange: (rules: FilterRule[]) => void
}

const CONDITIONS = [
  { value: 'eq',          label: '같음' },
  { value: 'neq',         label: '같지 않음' },
  { value: 'contains',    label: '포함' },
  { value: 'not_contains',label: '포함 안 함' },
  { value: 'is_empty',    label: '비어 있음' },
  { value: 'is_not_empty',label: '비어 있지 않음' },
] as const

function evalRule(rule: FilterRule, row: GuestRow): boolean {
  const val = (row.data[rule.columnId] ?? '').toLowerCase()
  const rv  = rule.value.toLowerCase()
  switch (rule.condition) {
    case 'eq':           return val === rv
    case 'neq':          return val !== rv
    case 'contains':     return val.includes(rv)
    case 'not_contains': return !val.includes(rv)
    case 'is_empty':     return val === ''
    case 'is_not_empty': return val !== ''
  }
}

function applyFilters(rules: FilterRule[], rows: GuestRow[]): GuestRow[] {
  if (rules.length === 0) return rows
  return rows.filter(row => {
    let result = evalRule(rules[0], row)
    for (let i = 1; i < rules.length; i++) {
      const cur = evalRule(rules[i], row)
      result = rules[i].logic === 'AND' ? result && cur : result || cur
    }
    return result
  })
}

export default function FilterBuilder({ rules, columns, rows, onChange }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const filteredRows = useMemo(() => applyFilters(rules, rows), [rules, rows])

  const addRule = () => {
    const newRule: FilterRule = {
      id: crypto.randomUUID(),
      columnId: columns[0]?.id ?? '',
      condition: 'contains',
      value: '',
      logic: 'AND',
    }
    onChange([...rules, newRule])
  }

  const updateRule = (id: string, patch: Partial<FilterRule>) => {
    onChange(rules.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const removeRule = (id: string) => {
    onChange(rules.filter(r => r.id !== id))
  }

  const noValueConditions: FilterRule['condition'][] = ['is_empty', 'is_not_empty']

  return (
    <div className="flex flex-col gap-2">
      {/* 필터 조건 목록 */}
      {rules.map((rule, idx) => (
        <div key={rule.id} className="flex items-center gap-2 flex-wrap">
          {/* AND/OR (첫 번째 제외) */}
          {idx > 0 ? (
            <select
              value={rule.logic}
              onChange={e => updateRule(rule.id, { logic: e.target.value as 'AND' | 'OR' })}
              style={{
                width: 64, padding: '4px 6px', fontSize: 11, borderRadius: 6,
                border: '1px solid rgba(61,26,46,0.2)', backgroundColor: '#faf8f4',
                color: '#3D1A2E', cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          ) : (
            <span style={{ width: 64, fontSize: 11, color: '#8B6A5A', paddingLeft: 6, flexShrink: 0 }}>
              조건
            </span>
          )}

          {/* 컬럼 선택 */}
          <select
            value={rule.columnId}
            onChange={e => updateRule(rule.id, { columnId: e.target.value })}
            style={{
              flex: '1 1 100px', minWidth: 80, padding: '4px 6px', fontSize: 12,
              borderRadius: 6, border: '1px solid rgba(61,26,46,0.2)',
              backgroundColor: '#fff', color: '#3D1A2E', outline: 'none',
            }}
          >
            {columns.map(col => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>

          {/* 조건 선택 */}
          <select
            value={rule.condition}
            onChange={e => updateRule(rule.id, { condition: e.target.value as FilterRule['condition'] })}
            style={{
              flex: '1 1 110px', minWidth: 90, padding: '4px 6px', fontSize: 12,
              borderRadius: 6, border: '1px solid rgba(61,26,46,0.2)',
              backgroundColor: '#fff', color: '#3D1A2E', outline: 'none',
            }}
          >
            {CONDITIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {/* 값 입력 (is_empty / is_not_empty는 숨김) */}
          {!noValueConditions.includes(rule.condition) && (
            <input
              value={rule.value}
              onChange={e => updateRule(rule.id, { value: e.target.value })}
              placeholder="값 입력"
              style={{
                flex: '2 1 120px', minWidth: 80, padding: '4px 8px', fontSize: 12,
                borderRadius: 6, border: '1px solid rgba(61,26,46,0.2)',
                outline: 'none', color: '#3D1A2E',
              }}
              onFocus={e => (e.target.style.borderColor = '#D94F35')}
              onBlur={e => (e.target.style.borderColor = 'rgba(61,26,46,0.2)')}
            />
          )}

          {/* 삭제 */}
          <button
            onClick={() => removeRule(rule.id)}
            title="조건 삭제"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: 'rgba(61,26,46,0.35)', padding: '2px 4px', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#D94F35')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(61,26,46,0.35)')}
          >✕</button>
        </div>
      ))}

      {/* 조건 추가 버튼 */}
      <button
        onClick={addRule}
        style={{
          alignSelf: 'flex-start', padding: '4px 12px', fontSize: 12,
          borderRadius: 6, border: '1px dashed rgba(61,26,46,0.25)',
          background: 'none', color: '#8B6A5A', cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#D94F35'; e.currentTarget.style.color = '#D94F35' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,26,46,0.25)'; e.currentTarget.style.color = '#8B6A5A' }}
      >
        + 조건 추가
      </button>

      {/* 대상자 수 + 미리보기 토글 */}
      {rows.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#3D1A2E' }}>
              대상자{' '}
              <strong style={{ color: rules.length > 0 ? '#D94F35' : '#3D1A2E' }}>
                {filteredRows.length}
              </strong>
              /{rows.length}명
            </span>
            {filteredRows.length > 0 && (
              <button
                onClick={() => setPreviewOpen(v => !v)}
                style={{
                  fontSize: 11, color: '#8B6A5A', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline',
                }}
              >
                {previewOpen ? '미리보기 닫기' : '미리보기'}
              </button>
            )}
          </div>

          {/* 대상자 미리보기 테이블 */}
          {previewOpen && filteredRows.length > 0 && (
            <div style={{
              marginTop: 8, border: '1px solid rgba(61,26,46,0.12)',
              borderRadius: 8, overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ backgroundColor: '#F0EBE1' }}>
                    <th style={{ padding: '5px 10px', textAlign: 'left', color: '#8B6A5A', fontWeight: 600, borderBottom: '1px solid rgba(61,26,46,0.1)', width: 32 }}>#</th>
                    {columns.slice(0, 4).map(col => (
                      <th key={col.id} style={{ padding: '5px 10px', textAlign: 'left', color: '#8B6A5A', fontWeight: 600, borderBottom: '1px solid rgba(61,26,46,0.1)', whiteSpace: 'nowrap' }}>
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, 50).map((row, i) => (
                    <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#faf8f4' }}>
                      <td style={{ padding: '4px 10px', color: '#8B6A5A', borderBottom: '1px solid rgba(61,26,46,0.06)' }}>{i + 1}</td>
                      {columns.slice(0, 4).map(col => (
                        <td key={col.id} style={{ padding: '4px 10px', color: '#3D1A2E', borderBottom: '1px solid rgba(61,26,46,0.06)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.data[col.id] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredRows.length > 50 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '6px 10px', color: '#8B6A5A', fontSize: 11, textAlign: 'center' }}>
                        … 외 {filteredRows.length - 50}명
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
