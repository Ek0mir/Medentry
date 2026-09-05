-- ---------------------------------------------------------------------------
-- 001 — Temel: şema notu ve ortak yardımcılar
-- ---------------------------------------------------------------------------
-- Üç bölge:
--   stg_*  Mikro'dan gelen HAM veri. Her senkronda yeniden yazılır. Elle dokunulmaz.
--   an_*   Hesaplanan analiz (yaşlandırma, risk skoru, öncelik). Türetilmiştir.
--   op_*   Bu sistemin kendi ürettiği operasyon verisi. Tek sahibi biziz.
--
-- Mikro'ya ASLA yazılmaz. Bu katman Mikro'yu yalnızca okur.
-- Tüm zaman damgaları timestamptz; uygulama TZ=Europe/Istanbul ile çalışır.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS _gecis (
  ad          text PRIMARY KEY,
  uygulama_ts timestamptz NOT NULL DEFAULT now()
);

-- Güncelleme zaman damgasını otomatik tazeleyen ortak tetikleyici
CREATE OR REPLACE FUNCTION guncelleme_ts_tazele() RETURNS trigger AS $$
BEGIN
  NEW.guncelleme_ts = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
