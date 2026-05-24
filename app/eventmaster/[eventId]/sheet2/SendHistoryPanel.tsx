'use client'

import { Fragment, useState } from 'react'
import type { SendRecord } from './actions'
import type { Column, GuestRow } from '../sheet1/actions'

type Props = {
  history: SendRecord[]
  rows?: GuestRow[]
  columns?: Column[]
}

const CHANNEL_LABEL: Record<SendRecord['channel'], string> = {
  email: '이메일',
  link:  '링크',
  sms:   'SMS',
}

const CHANNEL_BG: Record<SendRecord['channel'], string> = {
  email: 'rgba(59,130,246,0.12)',
  link:  'rgba(34,197,94,0.12)',
  sms:   'rgba(168,85,247,0.12)',
}

const CHANNEL_FC: Record<SendRecord['channel'], string> = {
  email: '#2563EB',
  link:  '#16A34A',
  sms:   '#9333EA',
}

function formatDate(d: string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
}

const TH: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', color: '#8B6A5A',
  fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(61,26,46,0.1)',
  backgroundColor: '#F0EBE1',
}

const TD: React.CSSProperties = {
  padding: '7px 10px', fontSize: 12, color: '#3D1A2E',
  borderBottom: '1px solid rgba(61,26,46,0.07)', verticalAlign: 'middle',
}

export default function SendHistoryPanel({ history, rows = [], columns = [] }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 이름·이메일·연락처 컬럼 우선 추출 (최대 3개)
  const keyCols = (() => {
    const priority = ['이름', '이메일', '연락처']
    const sorted = [...columns].sort((a, b) => {
      const ai = priority.indexOf(a.name); const bi = priority.indexOf(b.name)
      if (ai < 0 && bi < 0) return 0; if (ai < 0) return 1; if (bi < 0) return -1; return ai - bi
    })
    return sorted.slice(0, 3)
  })()

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2" style={{ padding: '40px 0' }}>
        <span style={{ fontSize: 28, opacity: 0.3 }}>📭</span>
        <p style={{ fontSize: 12, color: '#8B6A5A', margin: 0 }}>아직 발송 이력이 없습니다.</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr>
            <th style={TH}>발송일시</th>
            <th style={TH}>버전</th>
            <th style={{ ...TH, textAlign: 'center' }}>대상수</th>
            <th style={{ ...TH, textAlign: 'center' }}>채널</th>
            <th style={{ ...TH, width: 28 }}></th>
          </tr>
        </thead>
        <tbody>
          {history.map((rec, i) => {
            const isExpanded = expandedId === rec.id
            const bg = i % 2 === 0 ? '#fff' : '#fafaf8'
            // 이 발송에 포함된 게스트 rows
            const guestSet = new Set(rec.guest_ids)
            const guestRows = rows.filter(r => guestSet.has(r.id))

            return (
              <Fragment key={rec.id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  style={{ backgroundColor: bg, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,92,26,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = bg)}>
                  {/* 발송일시 */}
                  <td style={TD}>
                    <span style={{ fontSize: 11, color: '#8B6A5A' }}>{formatDate(rec.sent_at)}</span>
                  </td>
                  {/* 버전명 */}
                  <td style={TD}>
                    <span style={{ fontWeight: 500 }}>{rec.invitation_name ?? '초대장'}</span>
                  </td>
                  {/* 대상수 */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <strong style={{ color: '#FF5C1A' }}>{rec.sent_to_count.toLocaleString()}</strong>
                    <span style={{ fontSize: 11, color: '#8B6A5A' }}>명</span>
                  </td>
                  {/* 채널 배지 */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
                      fontSize: 11, fontWeight: 600,
                      backgroundColor: CHANNEL_BG[rec.channel],
                      color: CHANNEL_FC[rec.channel],
                    }}>
                      {CHANNEL_LABEL[rec.channel]}
                    </span>
                  </td>
                  {/* 펼치기 토글 */}
                  <td style={{ ...TD, textAlign: 'center', fontSize: 10, color: '#8B6A5A' }}>
                    {isExpanded ? '▴' : '▾'}
                  </td>
                </tr>

                {/* 펼쳐진 수신자 목록 */}
                {isExpanded && (
                  <tr style={{ backgroundColor: '#faf5f0' }}>
                    <td colSpan={5} style={{ padding: '0 12px 12px' }}>
                      {guestRows.length === 0 ? (
                        <p style={{ fontSize: 11, color: '#8B6A5A', margin: '10px 0 0', textAlign: 'center' }}>
                          수신자 정보를 불러올 수 없습니다.
                        </p>
                      ) : (
                        <div style={{
                          marginTop: 8, border: '1px solid rgba(61,26,46,0.1)',
                          borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto',
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead>
                              <tr style={{ backgroundColor: '#F0EBE1' }}>
                                <th style={{ padding: '4px 8px', textAlign: 'left', color: '#8B6A5A', fontWeight: 600, width: 28 }}>#</th>
                                {keyCols.map(col => (
                                  <th key={col.id} style={{ padding: '4px 8px', textAlign: 'left', color: '#8B6A5A', fontWeight: 600 }}>
                                    {col.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {guestRows.map((r, idx) => (
                                <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#faf8f4' }}>
                                  <td style={{ padding: '3px 8px', color: '#8B6A5A' }}>{idx + 1}</td>
                                  {keyCols.map(col => (
                                    <td key={col.id} style={{ padding: '3px 8px', color: '#3D1A2E', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {r.data[col.id] ?? '─'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {rec.guest_ids.length > guestRows.length && (
                            <p style={{ fontSize: 10, color: '#8B6A5A', textAlign: 'center', padding: '4px 0', margin: 0 }}>
                              * 현재 목록에 없는 게스트 {rec.guest_ids.length - guestRows.length}명 포함
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
