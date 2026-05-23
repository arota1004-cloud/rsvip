export type EventSettings = {
  // ── 1단계: 인비테이션 발송 ──────────────────────
  invitationEnabled: boolean
  invitationChannel: 'email' | 'sms' | 'link'
  invitationTiming: 'immediate' | 'scheduled'
  invitationScheduledAt: string

  // ── 2단계: RSVP ─────────────────────────────────
  rsvpEnabled: boolean
  rsvpDeadline: string
  rsvpReminder: boolean

  // ── 3단계: 확정 인비테이션 (QR) ──────────────────
  confirmedInviteEnabled: boolean
  confirmedInviteMethod: 'auto_qr' | 'scheduled'
  confirmedInviteScheduledAt: string

  // ── 4단계: QR 체크인 ─────────────────────────────
  qrCheckinEnabled: boolean
  qrCheckinManager: string

  // ── 5단계: 사후 자료 요청 ────────────────────────
  postEventEnabled: boolean
  postEventContent: string
  postEventScheduledAt: string
}

export const DEFAULT_SETTINGS: EventSettings = {
  invitationEnabled: false,
  invitationChannel: 'email',
  invitationTiming: 'immediate',
  invitationScheduledAt: '',
  rsvpEnabled: false,
  rsvpDeadline: '',
  rsvpReminder: false,
  confirmedInviteEnabled: false,
  confirmedInviteMethod: 'auto_qr',
  confirmedInviteScheduledAt: '',
  qrCheckinEnabled: false,
  qrCheckinManager: '',
  postEventEnabled: false,
  postEventContent: '',
  postEventScheduledAt: '',
}

export type StaffMember = {
  id: string
  event_id: string
  user_id: string | null
  email: string
  role: 'editor' | 'viewer'
  invited_at: string
  accepted_at: string | null
}
