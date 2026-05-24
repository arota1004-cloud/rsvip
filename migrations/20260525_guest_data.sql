-- ============================================================
-- 20260525_guest_data.sql
--
-- 추가 테이블: guest_sheets, guests, invitations, send_history,
--             rsvp_settings, guest_tokens, rsvp_responses
-- 기존 테이블 보완 정책: events(anon SELECT), event_staff(자기수락)
--
-- 실행 전제: 20260522064654_create-users-table.sql,
--            20260522_events.sql 이 먼저 적용되어 있어야 함
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 기존 테이블 보완 정책
-- ════════════════════════════════════════════════════════════

-- ── events: RSVP 공개 페이지가 이벤트 이름·장소·날짜 조회 (anon 접근) ──────────
CREATE POLICY "events_anon_select" ON public.events
  FOR SELECT TO anon
  USING (true);

-- ── event_staff: 초대 수락 — 본인 이메일 레코드만 UPDATE 허용 ─────────────────
-- (acceptStaffInvite 서버 액션이 호출, 미수락 레코드만 대상)
CREATE POLICY "event_staff_self_accept" ON public.event_staff
  FOR UPDATE TO authenticated
  USING (
    accepted_at IS NULL
    AND email = (SELECT email FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    email = (SELECT email FROM public.users WHERE auth_id = auth.uid())
  );


-- ════════════════════════════════════════════════════════════
-- guest_sheets  (이벤트별 컬럼 스키마 — event 당 1행)
-- ════════════════════════════════════════════════════════════
CREATE TABLE public.guest_sheets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  columns    JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- updated_at: saveColumns() 에서 직접 갱신
);

ALTER TABLE public.guest_sheets ENABLE ROW LEVEL SECURITY;

-- owner: 전체 권한
CREATE POLICY "guest_sheets_owner_all" ON public.guest_sheets
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

-- editor staff: 전체 권한
CREATE POLICY "guest_sheets_editor_all" ON public.guest_sheets
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  );

-- viewer staff: 읽기 전용
CREATE POLICY "guest_sheets_viewer_select" ON public.guest_sheets
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'viewer'
        AND accepted_at IS NOT NULL
    )
  );

-- RSVP 서버 액션: anon도 columns 읽기 (survey 컬럼 id 조회용)
CREATE POLICY "guest_sheets_anon_select" ON public.guest_sheets
  FOR SELECT TO anon
  USING (true);


-- ════════════════════════════════════════════════════════════
-- guests  (게스트 행 데이터)
-- ════════════════════════════════════════════════════════════
CREATE TABLE public.guests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  row_index  INTEGER     NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NOTE: (event_id, row_index) 는 앱 레벨에서 관리
  --       upsertGuests 가 onConflict:'id' 를 사용하므로 DB 유니크 불필요
);

CREATE INDEX idx_guests_event_row ON public.guests (event_id, row_index);

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- owner
CREATE POLICY "guests_owner_all" ON public.guests
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

-- editor staff
CREATE POLICY "guests_editor_all" ON public.guests
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  );

-- viewer staff
CREATE POLICY "guests_viewer_select" ON public.guests
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'viewer'
        AND accepted_at IS NOT NULL
    )
  );

-- RSVP 공개 페이지: anon 읽기 (게스트 이름 표시용, guest_id는 token에서 서버 도출)
CREATE POLICY "guests_anon_select" ON public.guests
  FOR SELECT TO anon
  USING (true);

-- RSVP 제출 후 survey 컬럼 업데이트 (서버 액션 레벨에서 token 검증 완료)
CREATE POLICY "guests_anon_update" ON public.guests
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);


-- ════════════════════════════════════════════════════════════
-- invitations  (초대장 버전/템플릿)
-- ════════════════════════════════════════════════════════════
CREATE TABLE public.invitations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT '초대장',
  html_content TEXT        NOT NULL DEFAULT '',
  filter_rules JSONB       NOT NULL DEFAULT '[]',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- updated_at: saveInvitation() 에서 직접 갱신
);

CREATE INDEX idx_invitations_event_sort ON public.invitations (event_id, sort_order);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- owner
CREATE POLICY "invitations_owner_all" ON public.invitations
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

-- editor staff: 초대장 생성·편집 가능
CREATE POLICY "invitations_editor_all" ON public.invitations
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  );

-- viewer staff: 읽기 전용
CREATE POLICY "invitations_viewer_select" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'viewer'
        AND accepted_at IS NOT NULL
    )
  );


-- ════════════════════════════════════════════════════════════
-- send_history  (발송 이력 — append-only 로그)
-- ════════════════════════════════════════════════════════════
CREATE TABLE public.send_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invitation_id  UUID        NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  -- 발신자 유저 삭제 시 이력은 보존 (SET NULL)
  sender_user_id UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  channel        TEXT        NOT NULL CHECK (channel IN ('email', 'link', 'sms')),
  sent_to_count  INTEGER     NOT NULL DEFAULT 0,
  guest_ids      UUID[]      NOT NULL DEFAULT '{}',
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_send_history_event ON public.send_history (event_id, sent_at DESC);

ALTER TABLE public.send_history ENABLE ROW LEVEL SECURITY;

-- owner + 모든 staff: 이력 조회
CREATE POLICY "send_history_select" ON public.send_history
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND accepted_at IS NOT NULL
    )
  );

-- owner + editor staff: 이력 추가
CREATE POLICY "send_history_insert" ON public.send_history
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  );


-- ════════════════════════════════════════════════════════════
-- rsvp_settings  (이벤트별 RSVP 설정 — event 당 1행)
-- ════════════════════════════════════════════════════════════
CREATE TABLE public.rsvp_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  enabled          BOOLEAN     NOT NULL DEFAULT true,
  custom_questions JSONB       NOT NULL DEFAULT '[]',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- updated_at: saveRsvpSettings() onConflict:'event_id' upsert 에서 갱신
);

ALTER TABLE public.rsvp_settings ENABLE ROW LEVEL SECURITY;

-- owner + editor staff: 설정 변경
CREATE POLICY "rsvp_settings_owner_editor_all" ON public.rsvp_settings
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  );

-- viewer staff: 읽기
CREATE POLICY "rsvp_settings_viewer_select" ON public.rsvp_settings
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'viewer'
        AND accepted_at IS NOT NULL
    )
  );

-- RSVP 공개 페이지: anon 읽기 (enabled 여부 확인, 커스텀 질문 표시)
CREATE POLICY "rsvp_settings_anon_select" ON public.rsvp_settings
  FOR SELECT TO anon
  USING (true);


-- ════════════════════════════════════════════════════════════
-- guest_tokens  (RSVP / QR 체크인 토큰)
-- ════════════════════════════════════════════════════════════
CREATE TABLE public.guest_tokens (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID        NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  event_id UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- token: 32자 hex (128-bit entropy), INSERT 시 DB가 자동 생성
  token    TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  type     TEXT        NOT NULL CHECK (type IN ('rsvp', 'qr_checkin')),
  used_at  TIMESTAMPTZ,
  -- generateGuestTokens: onConflict:'guest_id,type' → 게스트당 타입별 토큰 1개
  UNIQUE (guest_id, type)
);

CREATE INDEX idx_guest_tokens_token   ON public.guest_tokens (token);
CREATE INDEX idx_guest_tokens_event   ON public.guest_tokens (event_id);

ALTER TABLE public.guest_tokens ENABLE ROW LEVEL SECURITY;

-- owner + editor staff: 토큰 생성·관리
CREATE POLICY "guest_tokens_owner_editor_all" ON public.guest_tokens
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  );

-- viewer staff: 읽기
CREATE POLICY "guest_tokens_viewer_select" ON public.guest_tokens
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND role = 'viewer'
        AND accepted_at IS NOT NULL
    )
  );

-- RSVP 공개 페이지: anon 읽기 (token 으로 조회 → guest_id/event_id 도출)
-- token 은 128-bit 랜덤 → 열거 공격 불가
CREATE POLICY "guest_tokens_anon_select" ON public.guest_tokens
  FOR SELECT TO anon
  USING (true);

-- RSVP 제출 후 used_at 마킹 (서버 액션 레벨에서 token 검증 완료)
CREATE POLICY "guest_tokens_anon_update" ON public.guest_tokens
  FOR UPDATE TO anon
  USING  (true)
  WITH CHECK (true);


-- ════════════════════════════════════════════════════════════
-- rsvp_responses  (게스트 RSVP 응답)
-- ════════════════════════════════════════════════════════════
CREATE TABLE public.rsvp_responses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id     UUID        NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'U' CHECK (status IN ('Y', 'N', 'U')),
  answers      JSONB       NOT NULL DEFAULT '{}',
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- submitRsvp: onConflict:'event_id,guest_id' → 재응답 시 업데이트
  UNIQUE (event_id, guest_id)
);

CREATE INDEX idx_rsvp_responses_event ON public.rsvp_responses (event_id);

ALTER TABLE public.rsvp_responses ENABLE ROW LEVEL SECURITY;

-- owner + 모든 staff: 응답 조회
CREATE POLICY "rsvp_responses_auth_select" ON public.rsvp_responses
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR event_id IN (
      SELECT event_id FROM public.event_staff
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND accepted_at IS NOT NULL
    )
  );

-- RSVP 공개 페이지: anon 읽기 (기존 응답 불러오기)
CREATE POLICY "rsvp_responses_anon_select" ON public.rsvp_responses
  FOR SELECT TO anon
  USING (true);

-- RSVP 응답 INSERT (서버 액션 레벨 token 검증 완료)
CREATE POLICY "rsvp_responses_anon_insert" ON public.rsvp_responses
  FOR INSERT TO anon
  WITH CHECK (true);

-- RSVP 재응답 UPDATE (변경 허용)
CREATE POLICY "rsvp_responses_anon_update" ON public.rsvp_responses
  FOR UPDATE TO anon
  USING  (true)
  WITH CHECK (true);
