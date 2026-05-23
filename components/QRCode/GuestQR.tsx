'use client'

import dynamic from 'next/dynamic'

// Canvas 기반 qrcode.react → SSR 제외
const QRCodeSVG = dynamic(
  () => import('qrcode.react').then(m => m.QRCodeSVG),
  { ssr: false, loading: () => (
    <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', borderRadius: 4 }}>
      <span style={{ fontSize: 10, color: '#999' }}>QR 로딩…</span>
    </div>
  ) }
)

type Props = {
  guestName: string
  guestId: string
  eventId: string
}

export default function GuestQR({ guestName, guestId, eventId }: Props) {
  const data = JSON.stringify({ guestId, name: guestName, eventId })

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      gap: 6, padding: '10px 12px',
      border: '1px solid rgba(61,26,46,0.12)', borderRadius: 10,
      backgroundColor: '#fff',
    }}>
      <QRCodeSVG value={data} size={120} includeMargin />
      <span style={{ fontSize: 11, color: '#8B6A5A', maxWidth: 130, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {guestName}
      </span>
    </div>
  )
}
