/**
 * RSVP 링크 생성 유틸리티
 * 형식: /rsvp/{eventId}/{guestId}
 */
export function generateRsvpLink(eventId: string, guestId: string): string {
  return `/rsvp/${eventId}/${guestId}`
}

/**
 * 전체 링크 텍스트 포맷
 * 형식: "홍길동 | https://app.com/rsvp/eventId/guestId"
 */
export function formatRsvpLinks(
  guests: { id: string; name: string }[],
  eventId: string,
  baseUrl: string,
): string {
  return guests
    .map(g => `${g.name} | ${baseUrl}${generateRsvpLink(eventId, g.id)}`)
    .join('\n')
}
