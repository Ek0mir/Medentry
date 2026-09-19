-- ============================================================================
-- Tek kisilik isletme ve harici kayit cihazi destegi
--
-- Senaryo: makineyi isletme sahibi kendi kullaniyor ve video, platforma bagli
-- olmayan bagimsiz bir kayit cihazindan (SD kart) elle aliniyor.
--
--  * solo_mode           : calisan izleme korumalarini, izleyen ile izlenen
--                          ayni kisi oldugunda devre disi birakir
--  * device_cameras.retrieval : kaydin platform uzerinden mi yoksa elle mi
--                          alindigi
--  * devices.clock_offset_sec : kayit cihazi saatinin gercek saatten sapmasi
--  * assets.nominal_consumption_lph : sensor yokken yakitin motor saatinden
--                          tahmin edilmesi
-- ============================================================================

-- Tek kullanici modu: sirkette operator olarak baska calisan yoksa veya
-- erisilen veri kullanicinin kendisine aitse, calisani isverene karsi koruyan
-- kisitlar anlamsizdir. Baska bir operator atandigi anda korumalar kendiliginden
-- geri gelir (bkz. apps/api/src/kvkk/guard.ts).
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS solo_mode boolean NOT NULL DEFAULT false;

-- integrated: 4G uzerinden platformdan izlenir/cekilir
-- manual    : bagimsiz kayit cihazi; goruntu SD karttan elle alinir
ALTER TABLE device_cameras
  ADD COLUMN IF NOT EXISTS retrieval text NOT NULL DEFAULT 'integrated';

-- Bagimsiz kayit cihazlarinin saati zamanla kayar. Olay anini SD kartta
-- ararken bu sapma uygulanir: cihaz_saati = gercek_saat + clock_offset_sec
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS clock_offset_sec integer NOT NULL DEFAULT 0;

-- CAN veya yakit sondasi yokken tuketim, motor saatinden tahmin edilir.
-- Gercek alimlarla (fuel_transactions) karsilastirilarak kalibre edilir.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS nominal_consumption_lph numeric(6,2);

-- Elle baslatilan puantaj oturumlarini kimin actigini bilmek gerekir.
ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN companies.solo_mode IS
  'Tek kisilik isletme: izleyen ile izlenen ayni kisi oldugunda calisan koruma kisitlari uygulanmaz';
COMMENT ON COLUMN device_cameras.retrieval IS
  'integrated: platform uzerinden | manual: bagimsiz kayit cihazi, SD karttan elle alinir';
COMMENT ON COLUMN devices.clock_offset_sec IS
  'Kayit cihazi saatinin gercek saatten sapmasi (saniye); olay klibini SD kartta bulmak icin';
COMMENT ON COLUMN assets.nominal_consumption_lph IS
  'Sensor yokken yakit tahmini icin beyan edilen ortalama tuketim (litre/saat)';
