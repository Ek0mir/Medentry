-- ============================================================================
-- Medentry Filo Takip - baslangic semasi
--
-- Tasarim notlari:
--  * Tum zaman damgalari timestamptz (UTC). Gun siniri raporlamada sirketin
--    saat dilimine gore hesaplanir (companies.timezone).
--  * Cok kiracili (multi-tenant): her tablo company_id tasir.
--  * KVKK tablolari (aydinlatma, teyit, denetim kaydi, saklama, mahremiyet
--    penceresi) semanin birinci sinif parcasidir; sonradan eklenen bir ek
--    degildir.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Kiraci ve kullanicilar
-- ---------------------------------------------------------------------------

CREATE TABLE companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  tax_number    text,
  timezone      text NOT NULL DEFAULT 'Europe/Istanbul',
  currency      text NOT NULL DEFAULT 'TRY',
  -- KVKK veri sorumlusu iletisim bilgileri (aydinlatma metninde kullanilir)
  kvkk_contact_name  text,
  kvkk_contact_email text,
  verbis_number      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email         text NOT NULL,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  phone         text,
  -- owner | manager | site_chief | operator | viewer | dpo
  role          text NOT NULL,
  -- Operatorler icin personel/sicil numarasi
  employee_no   text,
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);

CREATE INDEX users_company_role_idx ON users (company_id, role);

-- ---------------------------------------------------------------------------
-- Varliklar (makine / arac) ve cihazlar
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  customer    text,
  starts_on   date,
  ends_on     date,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rate_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id          uuid REFERENCES projects(id) ON DELETE SET NULL,
  name                text NOT NULL,
  currency            text NOT NULL DEFAULT 'TRY',
  -- hourly | daily | hourly_with_min | monthly
  mode                text NOT NULL,
  hourly_rate         numeric(12,2),
  daily_rate          numeric(12,2),
  monthly_rate        numeric(12,2),
  working_days_per_month integer DEFAULT 26,
  min_hours_per_day   numeric(5,2),
  overtime_after_hours numeric(5,2),
  overtime_multiplier numeric(5,2) DEFAULT 1.5,
  idle_billable       boolean NOT NULL DEFAULT false,
  idle_hourly_rate    numeric(12,2),
  transport_fee       numeric(12,2),
  fuel_included       boolean NOT NULL DEFAULT true,
  fuel_price_per_liter numeric(10,2),
  vat_rate            numeric(5,4) DEFAULT 0.20,
  rounding_step_hours numeric(5,2) DEFAULT 0.25,
  rounding_mode       text DEFAULT 'up',
  valid_from          date,
  valid_to            date,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  -- machine | vehicle
  category        text NOT NULL,
  asset_type      text NOT NULL,
  plate           text,
  make            text,
  model           text,
  model_year      integer,
  fuel_tank_liters numeric(8,2),
  -- Cihaz takilmadan onceki motor saati (toplam saat gostergesi icin)
  hour_meter_offset_sec bigint NOT NULL DEFAULT 0,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  rate_card_id    uuid REFERENCES rate_cards(id) ON DELETE SET NULL,
  -- Rolanti tespit stratejisi: auto | speed | rpm | movement
  idle_strategy   text NOT NULL DEFAULT 'auto',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id      uuid REFERENCES assets(id) ON DELETE SET NULL,
  -- tracker | mdvr | ipcam
  kind          text NOT NULL,
  -- gt06 | teltonika | jt808 | generic
  protocol      text NOT NULL,
  -- IMEI veya terminal numarasi
  ident         text NOT NULL,
  sim_msisdn    text,
  sim_operator  text,
  model         text,
  firmware      text,
  -- Cihazin bildirdigi yerel saatin UTC ofseti (JT808 terminalleri icin)
  utc_offset_minutes integer NOT NULL DEFAULT 0,
  installed_at  timestamptz,
  last_seen_at  timestamptz,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ident)
);

CREATE INDEX devices_asset_idx ON devices (asset_id);

-- Kamera kanallari. KVKK acisindan kritik tablo: her kameranin nereye
-- baktigi, ses kaydi yapip yapmadigi ve mahremiyet sinifi burada tanimlidir.
CREATE TABLE device_cameras (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id      uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  channel_no     integer NOT NULL,
  -- cabin | front | rear | left | right | boom | vehicle_front
  position       text NOT NULL,
  label          text,
  -- Ses kaydi varsayilan olarak KAPALI olmalidir (olcululuk ilkesi).
  records_audio  boolean NOT NULL DEFAULT false,
  -- standard | high  (kabin = high)
  privacy_class  text NOT NULL DEFAULT 'standard',
  -- Kabin kamerasi yalnizca olay aninda kayit alir
  event_only     boolean NOT NULL DEFAULT false,
  sd_recording   boolean NOT NULL DEFAULT true,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, channel_no)
);

-- Tanimsiz cihazlardan gelen veriler: sahada yanlis IMEI girisini yakalamak icin
CREATE TABLE unknown_devices (
  ident       text PRIMARY KEY,
  protocol    text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  hit_count   bigint NOT NULL DEFAULT 1,
  sample      jsonb
);

-- ---------------------------------------------------------------------------
-- Telemetri
-- ---------------------------------------------------------------------------

CREATE TABLE positions (
  id              bigserial PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id        uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  device_id       uuid REFERENCES devices(id) ON DELETE SET NULL,
  ts              timestamptz NOT NULL,
  lat             double precision,
  lon             double precision,
  gps_valid       boolean NOT NULL DEFAULT true,
  speed_kph       double precision NOT NULL DEFAULT 0,
  heading_deg     double precision,
  altitude_m      double precision,
  satellites      integer,
  hdop            double precision,
  ignition        boolean,
  movement        boolean,
  odometer_m      double precision,
  engine_hours_sec bigint,
  engine_rpm      integer,
  fuel_level_pct  double precision,
  fuel_level_liters double precision,
  coolant_temp_c  double precision,
  battery_v       double precision,
  external_v      double precision,
  gsm_signal      integer,
  raw             jsonb,
  received_at     timestamptz NOT NULL DEFAULT now()
);

-- Ana sorgu deseni: "su varligin su araliktaki kayitlari".
CREATE INDEX positions_asset_ts_idx ON positions (asset_id, ts DESC);
CREATE UNIQUE INDEX positions_dedup_idx ON positions (asset_id, ts, device_id);
-- NOT: Buyuk filolarda positions tablosu ay bazli bolumlendirilmelidir
-- (PARTITION BY RANGE (ts)); saklama suresi isletimi de bolum dusurerek yapilir.

CREATE TABLE device_events (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  device_id   uuid REFERENCES devices(id) ON DELETE SET NULL,
  ts          timestamptz NOT NULL,
  -- ignition_on | ignition_off | overspeed | harsh_braking | crash | sos |
  -- power_cut | fuel_drop | fuel_fill | geofence_enter | geofence_exit | idle
  event_type  text NOT NULL,
  severity    text NOT NULL DEFAULT 'info',
  lat         double precision,
  lon         double precision,
  payload     jsonb,
  -- Olay bazli kamera klibi talep edildi mi (KVKK: yalnizca olayda kabin kaydi)
  clip_requested boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX device_events_asset_ts_idx ON device_events (asset_id, ts DESC);
CREATE INDEX device_events_type_idx ON device_events (company_id, event_type, ts DESC);

-- ---------------------------------------------------------------------------
-- Calisma oturumlari ve operator atamalari
-- ---------------------------------------------------------------------------

CREATE TABLE work_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  operator_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz,
  duration_sec  integer NOT NULL DEFAULT 0,
  idle_sec      integer NOT NULL DEFAULT 0,
  working_sec   integer NOT NULL DEFAULT 0,
  distance_m    double precision NOT NULL DEFAULT 0,
  start_lat     double precision,
  start_lon     double precision,
  end_lat       double precision,
  end_lon       double precision,
  fuel_start_pct double precision,
  fuel_end_pct   double precision,
  fuel_used_liters numeric(10,2),
  -- auto (telemetri) | manual (elle girilen puantaj)
  source        text NOT NULL DEFAULT 'auto',
  is_open       boolean NOT NULL DEFAULT true,
  -- Santiye sefi onayi (hakedise girmesi icin)
  approved_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at   timestamptz,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_sessions_asset_started_idx ON work_sessions (asset_id, started_at DESC);
CREATE UNIQUE INDEX work_sessions_open_idx ON work_sessions (asset_id) WHERE is_open;

-- "Makineyi kim kullaniyor" sorusunun cevabi.
CREATE TABLE operator_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  -- roster (planli vardiya) | ibutton (anahtar okuyucu) | manual | app
  source      text NOT NULL DEFAULT 'roster',
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX operator_assignments_asset_idx ON operator_assignments (asset_id, starts_at DESC);

-- Canli durum: telefondaki tek ekran bu tablodan beslenir.
CREATE TABLE asset_state (
  asset_id        uuid PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  last_ts         timestamptz,
  lat             double precision,
  lon             double precision,
  speed_kph       double precision,
  heading_deg     double precision,
  ignition        boolean,
  movement        boolean,
  fuel_level_pct  double precision,
  engine_hours_sec bigint,
  odometer_m      double precision,
  battery_v       double precision,
  external_v      double precision,
  gsm_signal      integer,
  open_session_id uuid REFERENCES work_sessions(id) ON DELETE SET NULL,
  -- Icinde bulunulan geofence kimlikleri
  geofence_ids    uuid[] NOT NULL DEFAULT '{}',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Geofence
-- ---------------------------------------------------------------------------

CREATE TABLE geofences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  name        text NOT NULL,
  -- circle | polygon
  kind        text NOT NULL,
  -- worksite | depot | restricted | privacy_zone | customer
  purpose     text NOT NULL DEFAULT 'worksite',
  center_lat  double precision,
  center_lon  double precision,
  radius_m    double precision,
  polygon     jsonb,
  hysteresis_m double precision DEFAULT 50,
  color       text DEFAULT '#2563eb',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX geofences_company_idx ON geofences (company_id) WHERE is_active;

CREATE TABLE geofence_events (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  geofence_id uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  ts          timestamptz NOT NULL,
  -- enter | exit
  kind        text NOT NULL,
  lat         double precision,
  lon         double precision,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX geofence_events_asset_ts_idx ON geofence_events (asset_id, ts DESC);

-- ---------------------------------------------------------------------------
-- Yakit
-- ---------------------------------------------------------------------------

CREATE TABLE fuel_events (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  ts          timestamptz NOT NULL,
  -- fill | drop
  kind        text NOT NULL,
  liters      numeric(10,2) NOT NULL,
  level_before_pct double precision,
  level_after_pct  double precision,
  lat         double precision,
  lon         double precision,
  confidence  numeric(4,2) NOT NULL DEFAULT 0.5,
  -- Dogrulanmis fis/fatura ile eslesti mi
  matched_transaction_id uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, ts, kind)
);

CREATE INDEX fuel_events_asset_ts_idx ON fuel_events (asset_id, ts DESC);

-- Elle girilen / yakit karti entegrasyonundan gelen alimlar
CREATE TABLE fuel_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  ts          timestamptz NOT NULL,
  liters      numeric(10,2) NOT NULL,
  unit_price  numeric(10,2),
  total       numeric(12,2),
  station     text,
  receipt_no  text,
  entered_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Hakedis
-- ---------------------------------------------------------------------------

CREATE TABLE daily_billing (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  rate_card_id  uuid REFERENCES rate_cards(id) ON DELETE SET NULL,
  work_date     date NOT NULL,
  currency      text NOT NULL DEFAULT 'TRY',
  engine_hours  numeric(8,2) NOT NULL DEFAULT 0,
  working_hours numeric(8,2) NOT NULL DEFAULT 0,
  idle_hours    numeric(8,2) NOT NULL DEFAULT 0,
  billable_hours numeric(8,2) NOT NULL DEFAULT 0,
  normal_hours  numeric(8,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(8,2) NOT NULL DEFAULT 0,
  fuel_used_liters numeric(10,2) NOT NULL DEFAULT 0,
  amount_base   numeric(12,2) NOT NULL DEFAULT 0,
  amount_overtime numeric(12,2) NOT NULL DEFAULT 0,
  amount_idle   numeric(12,2) NOT NULL DEFAULT 0,
  amount_transport numeric(12,2) NOT NULL DEFAULT 0,
  amount_fuel   numeric(12,2) NOT NULL DEFAULT 0,
  amount_net    numeric(12,2) NOT NULL DEFAULT 0,
  amount_vat    numeric(12,2) NOT NULL DEFAULT 0,
  amount_total  numeric(12,2) NOT NULL DEFAULT 0,
  -- Hesabin satir bazli dokumu (fatura eki / itiraz halinde delil)
  lines         jsonb NOT NULL DEFAULT '[]',
  manual_adjust_hours numeric(6,2),
  manual_adjust_note  text,
  -- draft | approved | invoiced
  status        text NOT NULL DEFAULT 'draft',
  approved_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at   timestamptz,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, work_date)
);

CREATE INDEX daily_billing_company_date_idx ON daily_billing (company_id, work_date DESC);

-- ---------------------------------------------------------------------------
-- Kamera / medya
-- ---------------------------------------------------------------------------

-- Canli izleme oturumlari. Her kayit, "kim, ne zaman, hangi amacla, hangi
-- gerekceyle izledi" sorusunun cevabidir.
CREATE TABLE media_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  camera_id     uuid NOT NULL REFERENCES device_cameras(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- live | playback
  mode          text NOT NULL,
  purpose       text NOT NULL,
  reason        text NOT NULL,
  linked_event_id bigint REFERENCES device_events(id) ON DELETE SET NULL,
  -- Ikinci onay gerekiyorsa (kabin goruntusu) onaylayan
  approved_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  -- Geri oynatma araligi
  window_start  timestamptz,
  window_end    timestamptz,
  ip            inet,
  user_agent    text,
  -- Operatore bildirim gonderildi mi (seffaflik yukumlulugu)
  operator_notified_at timestamptz,
  stream_token_hash text
);

CREATE INDEX media_sessions_user_idx ON media_sessions (user_id, started_at DESC);
CREATE INDEX media_sessions_asset_idx ON media_sessions (asset_id, started_at DESC);

-- SD karttaki ve buluta alinan kayitlarin dizini
CREATE TABLE recordings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  camera_id     uuid NOT NULL REFERENCES device_cameras(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz NOT NULL,
  -- sd | cloud
  storage       text NOT NULL DEFAULT 'sd',
  size_bytes    bigint,
  storage_path  text,
  event_id      bigint REFERENCES device_events(id) ON DELETE SET NULL,
  -- Saklama suresi sonunda otomatik imha tarihi
  retention_until timestamptz NOT NULL,
  -- Hukuki sureclerde imhayi durdurma (legal hold)
  legal_hold    boolean NOT NULL DEFAULT false,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recordings_asset_time_idx ON recordings (asset_id, started_at DESC);
CREATE INDEX recordings_retention_idx ON recordings (retention_until) WHERE deleted_at IS NULL AND NOT legal_hold;

-- Cihazdan kayit cekme talepleri (0x9206 / 0x9201)
CREATE TABLE media_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  camera_id     uuid REFERENCES device_cameras(id) ON DELETE CASCADE,
  requested_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  event_id      bigint REFERENCES device_events(id) ON DELETE SET NULL,
  window_start  timestamptz NOT NULL,
  window_end    timestamptz NOT NULL,
  purpose       text NOT NULL,
  reason        text,
  -- pending | sent | uploading | done | failed
  status        text NOT NULL DEFAULT 'pending',
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- KVKK
-- ---------------------------------------------------------------------------

-- Aydinlatma metinleri ve politikalar (surumlenir)
CREATE TABLE privacy_notices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- camera | location | general
  kind         text NOT NULL,
  version      text NOT NULL,
  title        text NOT NULL,
  body_md      text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind, version)
);

-- Personelin aydinlatma metnini okudugunu teyidi.
-- Kamera goruntusune erisim, ilgili operator icin bu kayit yoksa reddedilir.
CREATE TABLE notice_acknowledgements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notice_id   uuid NOT NULL REFERENCES privacy_notices(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- ack (aydinlatma teyidi) | consent (acik riza)
  kind        text NOT NULL DEFAULT 'ack',
  granted     boolean NOT NULL DEFAULT true,
  -- app | wet_sign | kep | email
  method      text NOT NULL DEFAULT 'app',
  document_path text,
  ip          inet,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  UNIQUE (notice_id, user_id, kind)
);

-- Mahremiyet pencereleri: mola, vardiya disi, ozel kullanim
CREATE TABLE privacy_windows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id    uuid REFERENCES assets(id) ON DELETE CASCADE,
  -- break | off_shift | private_use
  kind        text NOT NULL,
  -- ISO hafta gunleri: 1=Pzt .. 7=Paz. Bos ise her gun.
  weekdays    integer[],
  start_time  time,
  end_time    time,
  starts_at   timestamptz,
  ends_at     timestamptz,
  note        text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Denetim kaydi: kisisel veriye her erisim buraya yazilir (izin verilen ve
-- reddedilen). KVKK m.12 veri guvenligi ve hesap verebilirlik icin zorunlu.
CREATE TABLE data_access_log (
  id            bigserial PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  ts            timestamptz NOT NULL DEFAULT now(),
  action        text NOT NULL,
  data_type     text NOT NULL,
  purpose       text NOT NULL,
  reason        text,
  asset_id      uuid REFERENCES assets(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  -- allow | deny
  result        text NOT NULL,
  decision_code text,
  obligations   text[],
  ip            inet,
  user_agent    text
);

CREATE INDEX data_access_log_user_ts_idx ON data_access_log (user_id, ts DESC);
CREATE INDEX data_access_log_subject_idx ON data_access_log (subject_user_id, ts DESC);
CREATE INDEX data_access_log_asset_idx ON data_access_log (asset_id, ts DESC);

-- Saklama ve imha politikasi (KVKK Saklama ve Imha Politikasi'nin makine
-- okunur karsiligi). Periyodik is bu tabloya gore siler/anonimlestirir.
CREATE TABLE retention_policies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data_type     text NOT NULL,
  retention_days integer NOT NULL,
  -- delete | anonymize
  action        text NOT NULL DEFAULT 'delete',
  legal_basis   text,
  last_run_at   timestamptz,
  last_run_deleted bigint,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, data_type)
);

-- Ilgili kisi basvurulari (KVKK m.11-13). 30 gun icinde cevaplanmalidir.
CREATE TABLE dsr_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subject_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subject_name  text,
  subject_contact text,
  -- access | erasure | rectification | objection | restriction
  request_type  text NOT NULL,
  description   text,
  -- received | in_progress | answered | rejected
  status        text NOT NULL DEFAULT 'received',
  received_at   timestamptz NOT NULL DEFAULT now(),
  -- Yasal cevap suresi (30 gun)
  due_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  answered_at   timestamptz,
  answer        text,
  handled_by    uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX dsr_requests_status_idx ON dsr_requests (company_id, status, due_at);

-- ---------------------------------------------------------------------------
-- Bildirimler (operatore "goruntunuz izlendi" bilgilendirmesi dahil)
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  payload     jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
