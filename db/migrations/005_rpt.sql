-- ---------------------------------------------------------------------------
-- 005 — rpt_*: raporlama okuma modeli
-- API ve panel bu view'ları okur. Dışarıdan veri çekecek olan (Excel, Power BI,
-- n8n) da aynı view'ları görür — böylece rapor mantığı tek yerde durur.
-- ---------------------------------------------------------------------------

-- Cari başına en güncel risk + yaşlandırma + öncelik, tek satırda.
CREATE VIEW rpt_cari_risk AS
SELECT
  c.kod,
  c.unvan,
  c.telefon,
  c.temsilci,
  c.il,
  c.risk_limiti,
  c.vade_gun,
  c.aktif,
  COALESCE(r.skor, 0)                       AS skor,
  COALESCE(r.kademe, 1)                     AS kademe,
  COALESCE(r.kademe_ad, 'Veri yok')         AS kademe_ad,
  COALESCE(r.bilesenler_json, '{}'::jsonb)  AS bilesenler_json,
  COALESCE(y.b_0_30, 0)                     AS b_0_30,
  COALESCE(y.b_31_60, 0)                    AS b_31_60,
  COALESCE(y.b_61_90, 0)                    AS b_61_90,
  COALESCE(y.b_91_180, 0)                   AS b_91_180,
  COALESCE(y.b_180_plus, 0)                 AS b_180_plus,
  COALESCE(y.vadesi_gelmemis, 0)            AS vadesi_gelmemis,
  COALESCE(y.toplam, 0)                     AS toplam_bakiye,
  COALESCE(y.b_0_30,0)+COALESCE(y.b_31_60,0)+COALESCE(y.b_61_90,0)
    +COALESCE(y.b_91_180,0)+COALESCE(y.b_180_plus,0)  AS vadesi_gecen,
  COALESCE(y.en_eski_gun, 0)                AS en_eski_gun,
  o.sira                                    AS oncelik_sira,
  o.gerekce                                 AS oncelik_gerekce,
  CASE WHEN c.risk_limiti > 0
       THEN round(COALESCE(y.toplam,0) / c.risk_limiti * 100, 1)
       ELSE NULL END                        AS limit_kullanim_yuzde,
  s.son_arama_ts,
  a.acik_gorev_adedi
FROM stg_cari c
LEFT JOIN LATERAL (
  SELECT * FROM an_risk_skor r WHERE r.cari_kod = c.kod ORDER BY r.tarih DESC LIMIT 1
) r ON true
LEFT JOIN LATERAL (
  SELECT * FROM an_yaslandirma y WHERE y.cari_kod = c.kod ORDER BY y.tarih DESC LIMIT 1
) y ON true
LEFT JOIN LATERAL (
  SELECT * FROM an_oncelik o WHERE o.cari_kod = c.kod ORDER BY o.tarih DESC LIMIT 1
) o ON true
LEFT JOIN LATERAL (
  SELECT max(g.kapanma_ts) AS son_arama_ts
  FROM op_gorev g WHERE g.cari_kod = c.kod AND g.tip = 'ARAMA' AND g.durum = 'KAPALI'
) s ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS acik_gorev_adedi
  FROM op_gorev g WHERE g.cari_kod = c.kod AND g.durum = 'ACIK'
) a ON true;

-- Yaşlandırma pivotu: gün bazında toplamlar (trend grafiği bunu okur).
CREATE VIEW rpt_yaslandirma_ozet AS
SELECT
  tarih,
  count(*)::int          AS cari_adedi,
  sum(b_0_30)            AS b_0_30,
  sum(b_31_60)           AS b_31_60,
  sum(b_61_90)           AS b_61_90,
  sum(b_91_180)          AS b_91_180,
  sum(b_180_plus)        AS b_180_plus,
  sum(vadesi_gelmemis)   AS vadesi_gelmemis,
  sum(toplam)            AS toplam,
  sum(b_91_180 + b_180_plus) AS doksan_gun_ustu
FROM an_yaslandirma
GROUP BY tarih;

-- Görev kapanma oranı: iş günü × tip × sorumlu.
CREATE VIEW rpt_gorev_kapanma AS
SELECT
  g.is_gunu,
  g.tip,
  g.sorumlu_id,
  k.ad AS sorumlu_ad,
  count(*)::int                                                   AS acilan,
  count(*) FILTER (WHERE g.durum = 'KAPALI')::int                 AS kapanan,
  count(*) FILTER (WHERE g.durum = 'ACIK')::int                   AS acik,
  count(*) FILTER (WHERE g.sonuc = 'ODEME_SOZU')::int             AS odeme_sozu,
  count(*) FILTER (WHERE g.sonuc = 'ULASILAMADI')::int            AS ulasilamadi,
  count(*) FILTER (WHERE g.eskalasyon_seviyesi > 0)::int          AS eskalasyona_giden,
  round(100.0 * count(*) FILTER (WHERE g.durum = 'KAPALI') / NULLIF(count(*), 0), 1) AS kapanma_orani
FROM op_gorev g
JOIN op_kullanici k ON k.id = g.sorumlu_id
GROUP BY g.is_gunu, g.tip, g.sorumlu_id, k.ad;

-- Eskalasyon trendi: hangi hafta kaç iş hangi seviyeye çıktı.
CREATE VIEW rpt_eskalasyon_haftalik AS
SELECT
  date_trunc('week', e.ts)::date AS hafta,
  e.seviye,
  count(*)::int                  AS adet,
  count(DISTINCT e.kaynak_id)::int AS ayrik_kayit
FROM op_eskalasyon e
GROUP BY 1, 2;

-- DSO: ortalama tahsilat süresi. Ciro penceresi 90 gün.
CREATE VIEW rpt_dso AS
SELECT
  y.tarih,
  sum(y.toplam)                                              AS acik_bakiye,
  sum(ci.son_90_gun)                                         AS ciro_90_gun,
  CASE WHEN sum(ci.son_90_gun) > 0
       THEN round(sum(y.toplam) / (sum(ci.son_90_gun) / 90.0), 1)
       ELSE NULL END                                         AS dso_gun
FROM an_yaslandirma y
LEFT JOIN stg_ciro ci ON ci.cari_kod = y.cari_kod
GROUP BY y.tarih;

-- Çek vade takvimi (W-08 ve muhasebe ekranı için).
CREATE VIEW rpt_cek_takvimi AS
SELECT
  ck.cek_no, ck.cari_kod, c.unvan, ck.vade, ck.tutar, ck.kesideci, ck.banka, ck.durum,
  (ck.vade - CURRENT_DATE) AS kalan_gun
FROM stg_cek ck
LEFT JOIN stg_cari c ON c.kod = ck.cari_kod
WHERE ck.durum = 'PORTFOYDE';
