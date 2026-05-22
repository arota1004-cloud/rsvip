-- events 테이블
CREATE TABLE public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  host_type   TEXT NOT NULL CHECK (host_type IN ('business', 'community')),
  event_type  TEXT NOT NULL CHECK (event_type IN ('ticket', 'free')),
  dates       TEXT[] NOT NULL DEFAULT '{}',
  venue       TEXT,
  memo        TEXT,
  settings    JSONB NOT NULL DEFAULT '{
    "invitationEnabled": false,
    "rsvpEnabled": false,
    "confirmedInviteEnabled": false,
    "confirmedInviteMode": "auto",
    "qrCheckinEnabled": false,
    "postEventEnabled": false
  }',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- owner만 자신의 이벤트에 접근
CREATE POLICY "events_owner_all" ON public.events
  FOR ALL TO authenticated
  USING (
    owner_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- event_staff 테이블
CREATE TABLE public.event_staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('editor', 'viewer')),
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

-- event owner 또는 스태프 본인만 조회
CREATE POLICY "event_staff_select" ON public.event_staff
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (
        SELECT id FROM public.users WHERE auth_id = auth.uid()
      )
    )
    OR
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- event owner만 스태프 초대/수정/삭제
CREATE POLICY "event_staff_owner_write" ON public.event_staff
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (
        SELECT id FROM public.users WHERE auth_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (
        SELECT id FROM public.users WHERE auth_id = auth.uid()
      )
    )
  );
