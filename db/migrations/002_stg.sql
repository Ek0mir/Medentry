-- ---------------------------------------------------------------------------
-- 002 — stg_*: Mikro'dan gelen ham veri
-- Bu tabloların tek doğruluk kaynağı Mikro'dur. Senkron bunları yeniden yazar.
-- ---------------------------------------------------------------------------

CREATE TABLE stg_cari (
  kod            text PRIMARY KEY,
  unvan          text NOT NULL,
  telefon        text,
  eposta         text,
  temsilci       text,
  risk_limiti    numeric(18,2) NOT NULL DEFAULT 0,
  vade_gun       integer       NOT NULL DEFAULT 0,
  il             text,
  aktif          boolean       NOT NULL DEFAULT true,
  guncelleme_ts  timestamptz   NOT NULL DEFAULT now()
);
COMMENT ON TABLE stg_cari IS 'Mikro cari kartları (salt-okunur kopya)';

CREATE TABLE stg_fatura (
  fatura_no    text PRIMARY KEY,
  cari_kod     text NOT NULL,
  tarih        date NOT NULL,
  vade         date NOT NULL,
  tutar        numeric(18,2) NOT NULL,
  kalan        numeric(18,2) NOT NULL,
  para_birimi  text NOT NULL DEFAULT 'TRY',
  tip          text NOT NULL DEFAULT 'SATIS'
);
CREATE INDEX stg_fatura_cari_ix ON stg_fatura (cari_kod);
CREATE INDEX stg_fatura_vade_ix ON stg_fatura (vade) WHERE kalan > 0;
COMMENT ON TABLE stg_fatura IS 'Mikro açık faturalar (kalan > 0 olanlar yaşlandırmaya girer)';

CREATE TABLE stg_tahsilat (
  id        bigserial PRIMARY KEY,
  kaynak_no text,
  cari_kod  text NOT NULL,
  tarih     date NOT NULL,
  tutar     numeric(18,2) NOT NULL,
  tip       text NOT NULL DEFAULT 'HAVALE'  -- NAKIT | HAVALE | CEK | KREDI_KARTI
);
CREATE INDEX stg_tahsilat_cari_tarih_ix ON stg_tahsilat (cari_kod, tarih DESC);

CREATE TABLE stg_cek (
  cek_no    text PRIMARY KEY,
  cari_kod  text NOT NULL,
  vade      date NOT NULL,
  tutar     numeric(18,2) NOT NULL,
  kesideci  text,
  banka     text,
  durum     text NOT NULL DEFAULT 'PORTFOYDE'  -- PORTFOYDE | TAHSIL | KARSILIKSIZ | IADE
);
CREATE INDEX stg_cek_vade_ix ON stg_cek (vade) WHERE durum = 'PORTFOYDE';

-- Risk skorunun geçmişe bakan bileşenleri: Mikro'dan özet olarak çekilir.
CREATE TABLE stg_odeme_gecmisi (
  cari_kod              text PRIMARY KEY,
  ortalama_gecikme_gun  numeric(8,2) NOT NULL DEFAULT 0,
  odenen_fatura_adedi   integer      NOT NULL DEFAULT 0,
  gecikmeli_adet        integer      NOT NULL DEFAULT 0,
  pencere_ay            integer      NOT NULL DEFAULT 24
);

CREATE TABLE stg_karsiliksiz (
  cari_kod   text PRIMARY KEY,
  adet       integer       NOT NULL DEFAULT 0,
  tutar      numeric(18,2) NOT NULL DEFAULT 0,
  son_tarih  date
);

CREATE TABLE stg_ciro (
  cari_kod       text PRIMARY KEY,
  son_90_gun     numeric(18,2) NOT NULL DEFAULT 0,
  onceki_90_gun  numeric(18,2) NOT NULL DEFAULT 0
);

CREATE TABLE stg_senkron_log (
  calisma_id    bigserial PRIMARY KEY,
  kaynak        text NOT NULL,          -- seed | csv | mssql
  baslangic     timestamptz NOT NULL DEFAULT now(),
  bitis         timestamptz,
  kayit_sayisi  integer NOT NULL DEFAULT 0,
  durum         text NOT NULL DEFAULT 'CALISIYOR',  -- CALISIYOR | BASARILI | HATA
  hata          text,
  ayrinti       jsonb
);
CREATE INDEX stg_senkron_log_baslangic_ix ON stg_senkron_log (baslangic DESC);
