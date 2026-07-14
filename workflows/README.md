# MirFix OS — n8n Ajanları

Bu klasördeki n8n iş akışları:

| Ajan | Dosya / Kılavuz |
|---|---|
| Katalog & Reklam Üretim Ajanı | [`mirfix-katalog-reklam-ajani.json`](./mirfix-katalog-reklam-ajani.json) (aşağıda) |
| Tahsilat Takipçisi + Günlük Tahsilat Raporu | [`tahsilat-os-README.md`](./tahsilat-os-README.md) |

---

# MirFix — Katalog & Reklam Üretim Ajanı

n8n iş akışı: Google Sheet'teki "Bekliyor" durumundaki ürünleri tek tek alır, bir
LLM ajanı (Claude + Higgsfield MCP) ile katalog görselleri ve metinlerini üretir,
görselleri Google Drive'a arşivler, sonucu tabloya yazar ve Slack'e bildirir.
Her akşam bir "bekçi" akışı da tabloyu özetleyip ekibe e-posta gönderir.

- **İş akışı dosyası:** [`mirfix-katalog-reklam-ajani.json`](./mirfix-katalog-reklam-ajani.json)
- **Gereken n8n sürümü:** LangChain (AI) düğümlerini destekleyen güncel bir n8n
  (Agent, Anthropic Chat Model, MCP Client Tool, Structured Output Parser).

## Akışın çalışma mantığı

### 1) Üretim hattı (her 15 dakikada)
1. **Zamanlayıcı (15 dk)** tetikler.
2. **Bekleyen Ürünleri Çek** — Sheet'ten yalnızca `durum = Bekliyor` satırlarını okur.
   Yeni ürün yoksa akış kendiliğinden durur.
3. **Ürün Döngüsü** — her ürünü tek tek (batch = 1) işler.
4. **Durum: İşleniyor** — satırı kilitler (tekrar işlenmesini önler).
5. **Katalog Ajanı** — Claude + Higgsfield (MCP) ile 3 görsel (katalog / lifestyle /
   reklam) üretir, upscale eder ve Türkçe katalog metni + 3 slogan yazar. Çıktıyı
   sabit JSON şemasında döner. Hata olursa akış durmaz, hata koluna düşer.
6. **Görsel Var mı?** — üretilen görselleri indirir, **Drive'a Yükle** ile arşivler
   (Higgsfield linkleri kalıcı olmayabilir), linkleri toplar.
7. **Durum: Tamamlandı** — başlık, metin, sloganlar, Drive linkleri ve tarihi Sheet'e
   yazar; **Ekibe Bildir** Slack'e özet düşer; döngü sonraki ürüne geçer.
8. Hata durumunda **Durum: Hata** + **Hata Alarmı** (Slack) çalışır, döngü devam eder.

### 2) Günlük bekçi (hafta içi 18:00)
- **Her Gün 18:00** → tüm tabloyu okur → **Günlük Özet** (Claude) raporu yazar →
  **Rapor E-postası** ekibe gönderir. Rapor: bugün tamamlananlar, 24 saatten uzun
  süredir "İşleniyor"da takılanlar, hatalar, bekleyen kuyruk ve öneriler.

## Kurulum

### 1. İş akışını içe aktar
n8n → **Workflows → Import from File** → `mirfix-katalog-reklam-ajani.json`.

### 2. Doldurulması gereken yer tutucular
İçe aktardıktan sonra aşağıdaki değerleri kendi hesaplarınıza göre değiştirin:

| Yer tutucu | Nerede | Ne yazılmalı |
|---|---|---|
| `GOOGLE_SHEET_ID_BURAYA` | 5 Google Sheets düğümü | Ürün tablosunun Google Sheet ID'si |
| `gid=0` / `Urunler` | Google Sheets düğümleri | Çalışılacak sekmenin adı/gid'i |
| `DRIVE_KLASOR_ID_BURAYA` | Drive'a Yükle | Görsellerin arşivleneceği Drive klasör ID'si |
| `#uretim` | Ekibe Bildir, Hata Alarmı | Slack kanalı |
| `otomasyon@mirfix.com` / `ekip@mirfix.com` | Rapor E-postası | Gönderen / alıcı e-posta |

### 3. Kimlik bilgileri (credentials)
Her düğüme ilgili credential'ı bağlayın:

- **Google Sheets** — OAuth2 (okuma/yazma yetkili).
- **Google Drive** — OAuth2 (yükleme yetkili).
- **Anthropic** — Claude API anahtarı (`Claude (Ajan Beyni)` ve `Claude (Rapor)`).
- **Higgsfield (MCP)** — `https://mcp.higgsfield.ai/mcp`, Header Auth ile API anahtarı.
- **Slack** — bildirim gönderilecek workspace.
- **SMTP / E-posta** — `Rapor E-postası` düğümü için gönderim hesabı.

### 4. Google Sheet kolon şeması
"Urunler" sekmesinde ilk satır başlık olacak şekilde şu kolonlar bulunmalı:

**Girdi (siz doldurursunuz):**
`urun_kodu` · `urun_adi` · `kategori` · `ozellikler` · `ham_gorsel_url` · `not` · `durum`

**Çıktı (ajan doldurur):**
`baslik` · `katalog_metni` · `sloganlar` · `gorsel_linkleri` · `notlar` · `islem_tarihi`

> `urun_kodu` satır eşleştirme (matching) anahtarıdır — benzersiz ve dolu olmalı.
> `durum` değerleri akış boyunca: **Bekliyor → İşleniyor → Tamamlandı** (veya **Hata**).

### 5. Çalıştırma
Kimlik bilgileri ve yer tutucular tamamlandıktan sonra iş akışını **Active** yapın.
İlk denemeyi Sheet'e 1 satır `Bekliyor` ürün ekleyip **Execute Workflow** ile
manuel tetikleyerek doğrulayın.

## Notlar
- Ajan yalnızca gerçekten üretilmiş görsellerin URL'lerini döndürür; hiç görsel
  üretilemezse `gorsel_linkleri` boş kalır ve nedeni `notlar`a yazılır.
- Zaman dilimi `Europe/Istanbul` olarak ayarlıdır.
- Başarılı ve hatalı çalıştırma verileri saklanır (`saveDataSuccessExecution` /
  `saveDataErrorExecution = all`).
