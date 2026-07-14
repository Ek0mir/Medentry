# MirFix OS — Tahsilat Ajanları

Google Workspace (Sheets + Gmail) üzerinde çalışan, günlük tahsilat işlerini yürüten
iki n8n ajanı. İkisi de aynı Google Sheet'i (`Tahsilat` sekmesi) kullanır. Yapay zekâ
kullanmaz — tüm kararlar ve rakamlar tablodaki veriden birebir hesaplanır (para
verisinde uydurma/halüsinasyon riski olmaması için bilinçli tercih).

| Ajan | Dosya | Ne zaman | Ne yapar |
|---|---|---|---|
| Tahsilat Takipçisi | [`tahsilat-takipcisi.json`](./tahsilat-takipcisi.json) | Hafta içi **09:00** | Açık faturalara vadeye göre kademeli hatırlatma e-postası atar, gecikenleri işaretler, ciddi gecikmeleri ekibe eskale eder |
| Günlük Tahsilat Raporu & KPI | [`gunluk-tahsilat-raporu.json`](./gunluk-tahsilat-raporu.json) | Hafta içi **18:00** | Tabloyu okuyup KPI özetini ekibe e-postalar |

## Google Sheet şeması — `Tahsilat` sekmesi

İlk satır başlık olacak şekilde şu kolonlar bulunmalı:

**Girdi (siz doldurursunuz):**

| Kolon | Açıklama | Örnek |
|---|---|---|
| `fatura_no` | Benzersiz fatura no (eşleştirme anahtarı) | `FTR-2026-001` |
| `musteri` | Müşteri adı | `Acme Ltd.` |
| `email` | Hatırlatmanın gideceği e-posta | `muhasebe@acme.com` |
| `tutar` | Fatura tutarı | `12500` veya `12.500,00` |
| `para_birimi` | Para birimi (boşsa `TL`) | `TL` |
| `fatura_tarihi` | Fatura kesim tarihi | `01.07.2026` |
| `vade_tarihi` | Son ödeme tarihi | `31.07.2026` |
| `durum` | `Açık` / `Gecikti` / `Ödendi` / `İptal` | `Açık` |
| `odeme_tarihi` | Ödendiyse ödeme tarihi (rapor için) | `28.07.2026` |

**Ajanların doldurduğu:** `son_hatirlatma_tarihi` · `hatirlatma_sayisi` · `notlar`

> Tarihler `gg.aa.yyyy` veya `yyyy-aa-gg` biçiminde olabilir. Tutar hem `12500` hem
> `12.500,00` biçimini kabul eder. `durum` boş bırakılan satırlar "açık" sayılır.

## Hatırlatma kademeleri (Takipçi)

Vade tarihine göre (bugüne kıyasla):

| Durum | Aksiyon |
|---|---|
| Vadeye **3 gün** var | Nazik ön-hatırlatma |
| Vade **bugün** | Ödeme günü uyarısı |
| **1–7 gün** gecikme | Hatırlatma + Sheet'te `durum = Gecikti` |
| **7+ gün** gecikme | Sert uyarı + ekibe eskalasyon e-postası |

- Aynı faturaya **günde en fazla 1** e-posta gider (`son_hatirlatma_tarihi` kontrolü).
- `Ödendi` / `İptal` / `Kapandı` faturalar atlanır.
- Her hatırlatmada `hatirlatma_sayisi` bir artar.

## Kurulum

1. **İçe aktar:** n8n → Import from File ile iki JSON'u da yükle.
2. **Yer tutucular:**
   - Her Google Sheets düğümünde `GOOGLE_SHEET_ID_BURAYA` → kendi Sheet ID'n.
   - Sekme adı `Tahsilat` değilse düğümlerde güncelle.
   - Ekip e-postası her iki akışta `tahsilat@mirfix.com` yazılı → kendi adresinle değiştir
     (Takipçi'de "Ekibe Eskalasyon", Rapor'da "Raporu Gönder").
3. **Credential'lar:** Google Sheets (OAuth2) ve Gmail (OAuth2) hesaplarını bağla.
   Hatırlatmalar bağladığın Gmail hesabından gönderilir.
4. **Test:** Sheet'e birkaç örnek satır ekle (biri vadesi bugün, biri 10 gün gecikmiş),
   her akışta **Test workflow** ile elle çalıştır, e-postaların gittiğini doğrula.
5. **Aktifleştir:** Sağ üstten **Active** yap. Artık zamanlanmış saatlerde kendiliğinden
   çalışır.

## Notlar

- Zaman dilimi `Europe/Istanbul`. Çalışma saatleri cron ile ayarlı
  (Takipçi `0 9 * * 1-5`, Rapor `0 18 * * 1-5`) — istersen düğümlerden değiştir.
- Hiç hatırlatma/gecikme yoksa akışlar boşa e-posta atmaz (ilgili kollar tetiklenmez).
