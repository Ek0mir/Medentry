# MirFix OS — Aylık Ölçekleme & Finans Danışmanı

Şirketi büyütmeye yönelik aylık analiz ajanı. Her ayın 1'inde bir önceki ayı
inceler: **ne kadar mal sattık (ciro), ne kadar tahsil ettik, büyüme trendi ve
finans durumu** nedir — bunları hesaplayıp yorumlar ve **somut ölçekleme
yönlendirmesi** yazarak yönetime e-postalar.

- **Dosya:** [`aylik-olcekleme-raporu.json`](./aylik-olcekleme-raporu.json)
- **Ne zaman:** Her ayın 1'i, saat **08:00** (cron `0 8 1 * *`)
- **Veri kaynağı:** `Tahsilat` sayfası (tahsilat ajanlarıyla aynı tablo)

## Nasıl çalışır

1. **Satış/Fatura Verisini Çek** — `Tahsilat` sayfasının tamamını okur.
2. **Aylık KPI Hesapla** (deterministik, kod) — geçen ay için hesaplar:
   - Aylık ciro (satış) ve önceki aya göre **büyüme %**
   - Bu ay tahsil edilen tutar ve **tahsilat oranı** (tahsilat ÷ ciro)
   - Toplam **açık alacak** ve **gecikmiş alacak**
   - **Son 6 aylık ciro trendi**
   - **En büyük 5 müşteri**
3. **Stratejik Analiz (Claude)** — bu **kesin rakamları** yorumlar ve yazar:
   durum değerlendirmesi, riskler, 3 somut ölçekleme aksiyonu, ayın odak metriği.
   → Claude'a yalnızca hesaplanmış sayılar verilir; rakam uydurması engellenir.
4. **Raporu Birleştir + Yönetime Gönder** — KPI tablosu + stratejik yorum tek
   e-postada yönetime gider.

> Rakamlar koddan birebir gelir (halüsinasyon yok); Claude yalnızca **yorum ve
> yönlendirme** üretir.

## Kurulum

1. **İçe aktar:** n8n → Import from File → `aylik-olcekleme-raporu.json`.
2. **Yer tutucular:**
   - `GOOGLE_SHEET_ID_BURAYA` → Sheet ID'n (`Satış/Fatura Verisini Çek` düğümü).
   - Sekme adı `Tahsilat` değilse güncelle.
   - `yonetim@mirfix.com` → raporun gideceği adres (`Yönetime Gönder` düğümü).
3. **Credential'lar:** Google Sheets (OAuth2), Gmail (OAuth2) ve **Anthropic**
   (Claude API anahtarı — `Claude (Danışman)` düğümü).
4. **Test:** `Test workflow` ile elle çalıştır. Anlamlı büyüme/trend görmek için
   tabloda birkaç aya yayılmış `fatura_tarihi` ve `odeme_tarihi` dolu satırlar olmalı.
5. **Aktifleştir:** **Active** yap — her ayın 1'inde kendiliğinden çalışır.

## Gerekli kolonlar (`Tahsilat` sayfası)

Bu ajan mevcut tahsilat tablosunu kullanır. Ölçekleme analizinin doğru çalışması için
şu kolonların **dolu** olması önemli:

| Kolon | Neden gerekli |
|---|---|
| `tutar` | Ciro ve alacak hesabı |
| `fatura_tarihi` | Hangi aya ait satış olduğunu belirler (ciro/büyüme) |
| `odeme_tarihi` | Hangi ay tahsil edildiğini belirler (tahsilat oranı) |
| `durum` | `Ödendi` olanlar tahsilat, diğerleri açık alacak sayılır |
| `vade_tarihi` | Gecikmiş alacak tespiti |
| `musteri` | En büyük müşteri analizi |

## İleride genişletme

- **Kâr/zarar (net finans):** Bir `Giderler` sayfası (tarih, tutar, kategori) ekleyip
  ikinci bir Sheets okuma düğümüyle KPI koduna gider toplamını verirsek, ajan ciro
  yanında **net kâr** ve **kâr marjı** da raporlayabilir. İstersen bunu ekleyelim.
- **Hedef takibi:** Aylık ciro hedefini bir sayfaya yazıp gerçekleşme oranını
  ("hedefin %85'i") rapora ekleyebiliriz.
