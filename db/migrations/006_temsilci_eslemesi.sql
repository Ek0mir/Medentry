-- ---------------------------------------------------------------------------
-- 006 — Panel kullanıcısını Mikro temsilcisine bağlama
--
-- Bölüm 11: SATIS rolü "kendi carilerini" görür. Portföyü kullanıcının EKRANDA
-- GÖRÜNEN ADIYLA eşleştirmek kırılgan: Mikro'daki temsilci alanı "Ferhat Yılmaz"
-- derken panelde kullanıcı "Ferhat Bey" olabilir ve süzgeç sessizce boş liste
-- döndürür. Bu yüzden eşleme açık bir alan olarak tutuluyor.
--
-- NULL ise kullanıcının adı kullanılır; o da tutmuyorsa süzgeç uygulanmaz ve
-- API yanıtında uyarı döner. Bu bir güvenlik sınırı değil, odaklanma
-- süzgecidir — 4 kişilik bir ofiste sessizce boş ekran göstermek, biraz fazla
-- veri göstermekten daha kötüdür.
-- ---------------------------------------------------------------------------

ALTER TABLE op_kullanici ADD COLUMN mikro_temsilci text;

COMMENT ON COLUMN op_kullanici.mikro_temsilci IS
  'Mikro cari kartındaki temsilci alanının karşılığı. Boşsa op_kullanici.ad kullanılır.';

CREATE INDEX stg_cari_temsilci_ix ON stg_cari (temsilci);
