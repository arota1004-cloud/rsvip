'use client'

import type { SendRecord } from './actions'

type Props = {
  history: SendRecord[]
}

const CHANNEL_LABEL: Record<SendRecord['channel'], string> = {
  email: '이메일',
  link:  '링크',
  sms:   'SMS',
}

const CHANNEL_COLOR: Record<SendRecord['channel'], string> = {
  email: 'rgba(59,130,246,0.12)',
  link:  'rgba(34,197,94,0.12)',
  sms:   'rgba(168,85,247,0.12)',
}

const CHANNEL_TEXT: Record<SendRecord['channel'], string> = {
  email: '#2563EB',
  link:  '#16A34A',
  sms:   '#9333EA',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h  = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${mo}.${da} ${h}:${mi}`
}

export default function SendHistoryPanel({ history }: Props) {
  if (history.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '32px 0', gap: 8,
      }}>
        <span style={{ fontSize: 28, opacity: 0.3 }}>📭</span>
        <p style={{ fontSize: 12, color: '#8B6A5A', margin: 0 }}>아직 발송 이력이 없습니다.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {history.map((record, i) => (
        <div
          key={record.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            borderBottom: i < history.length - 1 ? '1px solid rgba(61,26,46,0.07)' : 'none',
            backgroundColor: i % 2 === 0 ? '#fff' : '#faf8f4',
          }}
        >
          {/* 채널 배지 */}
          <span style={{
            flexShrink: 0, fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 9999,
            backgroundColor: CHANNEL_COLOR[record.channel],
            color: CHANNEL_TEXT[record.channel],
            minWidth: 44, textAlign: 'center',
          }}>
            {CHANNEL_LABEL[record.channel]}
          </span>

          {/* 발송 버전명 */}
          <span style={{ flex: 1, fontSize: 12, color: '#3D1A2E', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.invitation_name ?? '초대장'}
          </span>

          {/* 수신자 수 */}
          <span style={{ flexShrink: 0, fontSize: 12, color: '#8B6A5A' }}>
            <strong style={{ color: '#D94F35' }}>{record.sent_to_count.toLocaleString()}</strong>명
          </span>

          {/* 발송자 */}
          {record.sender_email && (
            <span style={{ flexShrink: 0, fontSize: 11, color: '#8B6A5A', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.sender_email}
            </span>
          )}

          {/* 발송 일시 */}
          <span style={{ flexShrink: 0, fontSize: 11, color: '#8B6A5A', whiteSpace: 'nowrap' }}>
            {formatDate(record.sent_at)}
          </span>
        </div>
      ))}
    </div>
  )
}
