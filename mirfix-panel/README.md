# MİRFİX Operasyon Paneli — MRF-PNL-01 v2.0

WhatsApp arşivleri, kasa hareket dökümü, eski-kasa tahsilat çalışması, cari ve
stok listelerini okuyup **kendini eğiten**; Obsidian vault'a bağlanan; canlı
WhatsApp siparişlerini ekrana düşüren yerel yazılım.
**AI önerir, insan onaylar** — panel hiçbir kapı kararını icra etmez.

## Hızlı Başlangıç (kendi bilgisayarınızda)

1. Klasörü VS Code ile açın (`File → Open Folder`).
2. Terminal açın (`` Ctrl+` ``) ve bir kez kurulum yapın:

   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

3. Çalıştırın:

   ```bash
   python run.py
   ```

   İlk açılışta `data/raw/` (ve bağlıysa vault `MIRFIX/Gelen/`) okunur,
   ardından panel açılır: **http://127.0.0.1:8000**

   Alternatif: `F5` → "MIRFIX Panel — çalıştır" (hazır launch.json vardır).

## Obsidian Vault Bağlantısı

Panel, vault'unuza üç klasörle bağlanır (eklenti gerekmez, düz dosyalar):

| Klasör | Yön | İçerik |
|---|---|---|
| `<vault>/MIRFIX/Gelen/`  | vault → panel | Ek kaynak kutusu: xlsx/txt buraya da bırakılabilir |
| `<vault>/MIRFIX/Defter/` | çift yön | `events.jsonl` — sipariş/tahsilat defteri (yerel SSOT) |
| `<vault>/MIRFIX/Panel/`  | panel → vault | Her eğitimde tazelenen markdown raporlar: `Pano-Ozeti.md`, `Siparis-Defteri.md`, `Tahsilat-Defteri.md` |

Bağlamak için: paneldeki **09 · Veri & Sistem → Obsidian Vault** kutusuna vault
klasörünüzün yolunu yazıp **Bağla**'ya basın (ya da `MIRFIX_VAULT` ortam
değişkenini ayarlayın). Raporlar Obsidian içinde normal not gibi açılır,
başka notlara bağlanabilir.

## Kendini Eğitme Döngüsü

```
data/raw/ veya vault MIRFIX/Gelen/ içine dosya bırak
        └─▶ panel 60 sn içinde değişikliği kendisi görür ve yeniden eğitilir
            (ya da 09. sekmedeki "Yeniden Eğit" düğmesi / python run.py --retrain)
```

Okunan dosyalar ad ipucuyla tanınır — yeniden adlandırma gerekmez:

| Ad ipucu | İçerik | Panele yansıması |
|---|---|---|
| `*kasa_yonetim*.xlsx` | Kasa hareket dökümü | Nakit akışı, kategoriler, **Eylem Planı uyum motoru** |
| `*eski_kasa*.xlsx` | Eski kasa tahsilat çalışması | Eski Kasa Kurtarma sekmesi, mahsup fırsatları |
| `*cari*.xlsx` | Cari bakiye listesi (unvan + borç/alacak/bakiye) | 07 · Cari & Stok |
| `*stok*.xlsx` | Stok listesi (stok adı + miktar/fiyat) | 07 · Cari & Stok |
| `_chat*.txt` | WhatsApp dışa aktarımı | Ödeme/çek/sipariş sinyalleri |

Veritabanı (`data/mirfix.db`) **türetilmiş ve yeniden kurulabilir**dir.
Sipariş ve tahsilat kayıtlarınız ise **defterde** (`events.jsonl`) saklanır:
her eğitim turunda deftere yeniden işlenir, asla kaybolmaz.

## Canlı WhatsApp Sipariş Ajanı

Gelen WhatsApp mesajları gerçek zamanlı işlenir: sinyal çıkarılır, sipariş
sinyali **02 · Canlı Siparişler** sekmesine anında düşer (bildirim + öneri
kartı). **Onayla** formu doldurur — kaydı yine siz yaparsınız.

İki giriş kapısı vardır:

### A) Meta WhatsApp Business Cloud API (resmî)

1. [developers.facebook.com](https://developers.facebook.com) → App oluşturun →
   WhatsApp ürününü ekleyin.
2. Webhook URL'i: `https://<sizin-adresiniz>/api/v1/wa/webhook`
   Verify token: `MIRFIX_WA_VERIFY_TOKEN` ortam değişkeniyle aynı değer
   (varsayılan: `mirfix-panel`).
3. Panel yerel çalıştığı için Meta'nın erişebileceği bir adres gerekir —
   en kolayı [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
   tüneli: `cloudflared tunnel --url http://127.0.0.1:8000`
4. `messages` webhook alanına abone olun. Gelen her mesaj panele düşer.

### B) Genel köprü (gayriresmî / esnek)

Herhangi bir yönlendirici (whatsapp-web.js, n8n, Tasker...) şu uca POST atar:

```
POST http://127.0.0.1:8000/api/v1/wa/gelen
Content-Type: application/json

{"grup": "Mirfix sipariş", "gonderen": "Fehmi Daşcı",
 "metin": "Fehmi daşcı\n2 palet hazır sıva", "medya": false}
```

`MIRFIX_WA_TOKEN` ayarlanırsa istekte `X-Mirfix-Anahtar` başlığı zorunlu olur.
Canlı akış SSE ucundan izlenir: `GET /api/v1/wa/canli`.

## Sipariş & Tahsilat Defteri

- **02 · Canlı Siparişler:** hızlı sipariş girişi + WA önerisi onayı +
  durum takibi (yeni → hazırlanıyor → sevk → kapandı).
- **05 · Eski Kasa & Tahsilat:** görüşme sonuçları (söz / tahsil / mahsup)
  buradan girilir; **OKR-O1 kurtarım çubuğu** bu kayıtlarla dolar.
- Her iki defter de journal'a (`events.jsonl`) yazılır — vault bağlıysa
  vault'ta durur, Obsidian ile senkronlanır.

## Dürüstlük Kuralları (kanondan panele)

- **Kaynaksız sayı yok:** her kartın altında verinin geldiği yer yazar.
- **Guven 0-3:** WhatsApp'tan çıkarılan her sinyal güven puanı taşır;
  tutar metinden net okunamıyorsa **uydurulmaz**, boş bırakılır.
- **"Veri-yok" dürüstlüğü:** kanıtı veride olmayan kural "veri-yok" der.
- **Gri, kırmızıdan kötüdür:** son eğitim 26 saati aşarsa "VERİ BAYAT" yanar.

## Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `MIRFIX_VAULT` | — | Obsidian vault klasörü (panelden de ayarlanabilir) |
| `MIRFIX_HOST` / `MIRFIX_PORT` | `127.0.0.1` / `8000` | Sunucu adresi |
| `MIRFIX_WA_VERIFY_TOKEN` | `mirfix-panel` | Meta webhook doğrulama token'ı |
| `MIRFIX_WA_TOKEN` | — | Genel köprü paylaşımlı anahtarı (boşsa kontrol yok) |
| `MIRFIX_WATCH_SECONDS` | `60` | Dosya izleyici aralığı (saniye) |

## Mimari Notu

- Kod, şema ve tanımlayıcılar **İngilizce**; iş verisi ve arayüz **Türkçe**
  (PO kuralı). SQLite yalnızca yerel analitik okuma modelidir; kullanıcı
  girdilerinin SSOT'u append-only journal'dır (vault içinde).
- API yüzeyi API-Bible ile hizalı: `/api/v1/...`, her yanıt `X-Iz-Id` yankılar,
  komut/sorgu ayrıktır, kapı kapsamında uç yoktur.
- Grafikler el yapımı SVG'dir; panel **internetsiz** çalışır (WhatsApp canlı
  ajanı hariç — o, seçtiğiniz köprüye bağlıdır).

```
mirfix-panel/
├── run.py                  # giriş noktası (ETL + sunucu)
├── requirements.txt        # fastapi, uvicorn, openpyxl
├── .vscode/launch.json     # F5 ile çalıştırma
├── data/raw/               # kaynak dosyalar (buraya bırakın)
├── data/journal/           # defter (vault bağlı değilse)
├── data/mirfix.db          # türetilmiş SQLite (otomatik oluşur)
├── src/
│   ├── config.py           # yollar, limitler, vault & WA ayarları
│   ├── tr.py               # Türkçe metin/sayı yardımcıları
│   ├── database.py         # şema + olay defteri
│   ├── journal.py          # append-only kullanıcı defteri (yerel SSOT)
│   ├── obsidian.py         # vault köprüsü + markdown rapor yazıcı
│   ├── wa_gateway.py       # canlı WhatsApp ajanı (webhook + köprü + SSE)
│   ├── seeds.py            # ürün kataloğu + KPI tanımları
│   ├── analytics.py        # tüm hesaplar (uyum motoru dâhil)
│   ├── api.py              # FastAPI /api/v1 + dosya izleyici
│   └── etl/
│       ├── whatsapp.py     # sohbet ayrıştırıcı + sinyal çıkarımı
│       ├── workbooks.py    # xlsx okuyucular (kasa/eski-kasa/cari/stok)
│       └── pipeline.py     # eğitim turu orkestrasyonu + defter tekrarı
└── web/index.html          # panel (tek dosya, çevrimdışı çalışır)
```

## Yol Haritası (öneri)

1. İcmal fotoğrafları için OCR (WF-06) → üretim KPI'ları otomatik dolar.
2. Günlük kasa mutabakat formu akışı → Eylem Planı K3 hesaplanabilir olur.
3. Cari bakiyeleri eski-kasa carileriyle eşleştirip mahsup önerisini
   otomatikleştirmek.
4. Panel MV'lerini kanonik Postgres'e taşımak (vault yapısı bağlanınca).

— MRF-PNL-01 v2.0 · 07.07.2026 · MİRFİX YAPI KİMYASALLARI (ALMİR İNŞAAT)
