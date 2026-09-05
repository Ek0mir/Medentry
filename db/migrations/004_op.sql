-- ---------------------------------------------------------------------------
-- 004 — op_*: operasyon katmanının kendi verisi
--
-- Değişmez kurallar (şemaya gömülü):
--   * Her görevin bir SORUMLUSU ve bir SON TARİHİ vardır. Sahipsiz görev olamaz.
--   * Kapalı görevin SONUCU olmak zorundadır. Boş kapatma veritabanı seviyesinde reddedilir.
--   * Hiçbir kayıt silinmez; durum değişir. op_gorev_hareket tam iz bırakır.
-- ---------------------------------------------------------------------------

CREATE TABLE op_kullanici (
  id             serial PRIMARY KEY,
  ad             text NOT NULL,
  kullanici_adi  text NOT NULL UNIQUE,
  sifre_hash     text NOT NULL,
  rol            text NOT NULL CHECK (rol IN ('YONETICI','UST_ONAY','SATIS','MUHASEBE','SEVKIYAT')),
  telefon        text,
  eposta         text,
  aktif          boolean NOT NULL DEFAULT true,
  olusma_ts      timestamptz NOT NULL DEFAULT now(),
  guncelleme_ts  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER op_kullanici_guncelleme BEFORE UPDATE ON op_kullanici
  FOR EACH ROW EXECUTE FUNCTION guncelleme_ts_tazele();

CREATE TABLE op_oturum (
  id             text PRIMARY KEY,
  kullanici_id   integer NOT NULL REFERENCES op_kullanici(id),
  olusma_ts      timestamptz NOT NULL DEFAULT now(),
  son_erisim_ts  timestamptz NOT NULL DEFAULT now(),
  bitis_ts       timestamptz NOT NULL
);
CREATE INDEX op_oturum_kullanici_ix ON op_oturum (kullanici_id);

-- Otomasyon ve veri çekme için: kullanıcı oturumundan bağımsız erişim.
CREATE TABLE op_api_anahtari (
  id              serial PRIMARY KEY,
  ad              text NOT NULL,
  anahtar_hash    text NOT NULL UNIQUE,
  rol             text NOT NULL CHECK (rol IN ('YONETICI','UST_ONAY','SATIS','MUHASEBE','SEVKIYAT')),
  aktif           boolean NOT NULL DEFAULT true,
  son_kullanim_ts timestamptz,
  olusma_ts       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE op_gorev (
  id                  bigserial PRIMARY KEY,
  tip                 text NOT NULL CHECK (tip IN ('ARAMA','ODEME_SOZU','CEK_VADE','SEVKIYAT','ONAY','SERBEST')),
  cari_kod            text,
  sorumlu_id          integer NOT NULL REFERENCES op_kullanici(id),
  aciklama            text NOT NULL,
  son_tarih           timestamptz NOT NULL,
  is_gunu             date NOT NULL DEFAULT CURRENT_DATE,
  durum               text NOT NULL DEFAULT 'ACIK' CHECK (durum IN ('ACIK','KAPALI','IPTAL')),
  sonuc               text CHECK (sonuc IN ('ULASILDI','ULASILAMADI','ODEME_SOZU','ITIRAZ','TAMAMLANDI','GEREKSIZ')),
  sonuc_notu          text,
  oncelik_sira        integer,
  gerekce             text,
  eskalasyon_seviyesi integer NOT NULL DEFAULT 0 CHECK (eskalasyon_seviyesi BETWEEN 0 AND 3),
  kaynak              text NOT NULL DEFAULT 'ELLE',   -- ELLE | W-03 | W-06 | W-08 ...
  kaynak_anahtar      text UNIQUE,                    -- iş tekrar çalışsa da mükerrer görev açılmaz
  olusturan_id        integer REFERENCES op_kullanici(id),
  olusma_ts           timestamptz NOT NULL DEFAULT now(),
  kapanma_ts          timestamptz,
  kapatan_id          integer REFERENCES op_kullanici(id),
  -- Kritik tasarım kararı: sonuçsuz kapatma yok.
  CONSTRAINT op_gorev_kapali_sonuc_zorunlu CHECK (
    durum <> 'KAPALI' OR (sonuc IS NOT NULL AND kapanma_ts IS NOT NULL)
  )
);
CREATE INDEX op_gorev_sorumlu_durum_ix ON op_gorev (sorumlu_id, durum);
CREATE INDEX op_gorev_acik_son_tarih_ix ON op_gorev (son_tarih) WHERE durum = 'ACIK';
CREATE INDEX op_gorev_cari_ix          ON op_gorev (cari_kod);
CREATE INDEX op_gorev_is_gunu_ix       ON op_gorev (is_gunu, tip);

CREATE TABLE op_gorev_hareket (
  id            bigserial PRIMARY KEY,
  gorev_id      bigint NOT NULL REFERENCES op_gorev(id),
  kullanici_id  integer REFERENCES op_kullanici(id),
  aksiyon       text NOT NULL,   -- ACILDI | KAPATILDI | ESKALASYON | NOT | ATAMA | IPTAL
  notu          text,
  ayrinti       jsonb,
  ts            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX op_gorev_hareket_gorev_ix ON op_gorev_hareket (gorev_id, ts);

CREATE TABLE op_odeme_sozu (
  id           bigserial PRIMARY KEY,
  cari_kod     text NOT NULL,
  gorev_id     bigint REFERENCES op_gorev(id),
  soz_tarihi   date NOT NULL,
  soz_tutari   numeric(18,2) NOT NULL CHECK (soz_tutari > 0),
  gerceklesti  boolean,               -- NULL = henüz kontrol edilmedi
  kontrol_ts   timestamptz,
  tahsil_tutar numeric(18,2),
  olusma_ts    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX op_odeme_sozu_takip_ix ON op_odeme_sozu (soz_tarihi) WHERE gerceklesti IS NULL;

CREATE TABLE op_eskalasyon (
  id          bigserial PRIMARY KEY,
  kaynak_tip  text NOT NULL,          -- GOREV | ONAY
  kaynak_id   bigint NOT NULL,
  seviye      integer NOT NULL CHECK (seviye BETWEEN 1 AND 3),
  hedef_id    integer REFERENCES op_kullanici(id),
  gerekce     text,
  ts          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kaynak_tip, kaynak_id, seviye)   -- aynı seviyeye iki kez çıkılmaz
);

-- Faz 3 (onay/yetki) tabloları: şema şimdi kuruluyor, arayüz sonraki teslimde.
CREATE TABLE op_onay_talebi (
  id            bigserial PRIMARY KEY,
  tip           text NOT NULL,
  cari_kod      text,
  tutar         numeric(18,2),
  gerekce       text NOT NULL,
  talep_eden_id integer NOT NULL REFERENCES op_kullanici(id),
  onayci_id     integer REFERENCES op_kullanici(id),
  durum         text NOT NULL DEFAULT 'BEKLIYOR' CHECK (durum IN ('BEKLIYOR','ONAYLANDI','REDDEDILDI','ZAMAN_ASIMI')),
  son_tarih     timestamptz NOT NULL,
  olusma_ts     timestamptz NOT NULL DEFAULT now(),
  karar_ts      timestamptz
);

CREATE TABLE op_onay_hareket (
  id            bigserial PRIMARY KEY,
  talep_id      bigint NOT NULL REFERENCES op_onay_talebi(id),
  kullanici_id  integer REFERENCES op_kullanici(id),
  karar         text NOT NULL,
  gerekce       text,
  ts            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE op_wa_log (
  id       bigserial PRIMARY KEY,
  alici    text NOT NULL,
  sablon   text NOT NULL,
  icerik   text,
  durum    text NOT NULL DEFAULT 'KUYRUKTA',
  hata     text,
  ts       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE op_sistem_log (
  id      bigserial PRIMARY KEY,
  olay    text NOT NULL,
  seviye  text NOT NULL DEFAULT 'BILGI' CHECK (seviye IN ('BILGI','UYARI','HATA')),
  detay   jsonb,
  ts      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX op_sistem_log_ts_ix ON op_sistem_log (ts DESC);

-- Otomasyon dikişi: WhatsApp / n8n / webhook sonradan BURAYA abone olur,
-- iş mantığının içine gömülmez.
CREATE TABLE op_olay (
  id          bigserial PRIMARY KEY,
  tur         text NOT NULL,     -- GOREV_ACILDI | GOREV_KAPANDI | ESKALASYON | BANT_GECISI | ONAY_TALEBI ...
  konu_tip    text NOT NULL,
  konu_id     text NOT NULL,
  veri        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts          timestamptz NOT NULL DEFAULT now(),
  islendi_ts  timestamptz
);
CREATE INDEX op_olay_islenmemis_ix ON op_olay (ts) WHERE islendi_ts IS NULL;

-- Eşikler ve ağırlıklar: yeniden dağıtım gerektirmeden ayarlanır.
CREATE TABLE op_ayar (
  anahtar        text PRIMARY KEY,
  deger          jsonb NOT NULL,
  aciklama       text,
  guncelleme_ts  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER op_ayar_guncelleme BEFORE UPDATE ON op_ayar
  FOR EACH ROW EXECUTE FUNCTION guncelleme_ts_tazele();

-- İş günü hesabı: "vade − 2 gün", "+24 saat" tatile denk gelmesin.
CREATE TABLE op_tatil (
  tarih date PRIMARY KEY,
  ad    text NOT NULL
);
