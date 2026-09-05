-- ---------------------------------------------------------------------------
-- 003 — an_*: hesaplanan analiz katmanı
-- Her gün W-02 tarafından yeniden üretilir; geçmiş korunur (trend için).
-- ---------------------------------------------------------------------------

CREATE TABLE an_yaslandirma (
  cari_kod     text NOT NULL,
  tarih        date NOT NULL,
  b_0_30       numeric(18,2) NOT NULL DEFAULT 0,
  b_31_60      numeric(18,2) NOT NULL DEFAULT 0,
  b_61_90      numeric(18,2) NOT NULL DEFAULT 0,
  b_91_180     numeric(18,2) NOT NULL DEFAULT 0,
  b_180_plus   numeric(18,2) NOT NULL DEFAULT 0,
  vadesi_gelmemis numeric(18,2) NOT NULL DEFAULT 0,
  toplam       numeric(18,2) NOT NULL DEFAULT 0,
  en_eski_gun  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (cari_kod, tarih)
);
COMMENT ON COLUMN an_yaslandirma.en_eski_gun IS 'En eski açık faturanın vade aşım günü (negatifse vadesi gelmemiş)';

CREATE TABLE an_risk_skor (
  cari_kod        text NOT NULL,
  tarih           date NOT NULL,
  skor            numeric(6,2) NOT NULL,
  kademe          integer NOT NULL,          -- 1..8 (1 = en iyi)
  kademe_ad       text NOT NULL,
  bilesenler_json jsonb NOT NULL,            -- skorun neden o olduğu ekranda gösterilir
  PRIMARY KEY (cari_kod, tarih)
);
CREATE INDEX an_risk_skor_tarih_skor_ix ON an_risk_skor (tarih, skor DESC);

CREATE TABLE an_oncelik (
  cari_kod  text NOT NULL,
  tarih     date NOT NULL,
  sira      integer NOT NULL,
  gerekce   text NOT NULL,
  PRIMARY KEY (cari_kod, tarih)
);
CREATE INDEX an_oncelik_tarih_sira_ix ON an_oncelik (tarih, sira);
