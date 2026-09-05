# MİRFİX Operasyon Katmanı

Mikro'nun üzerine kurulan iş takibi, alacak riski, eskalasyon ve raporlama
katmanı.

**Mikro sistem-of-record olarak kalır.** Cari, fatura, çek, e-fatura ve muhasebe
Mikro'da devam eder; bu katman onu **yalnızca okur** ve üstüne şunu ekler:

- **Günlük arama kuyruğu** — risk sıralamasına göre üretilir. Rapor değil görev
  kuyruğudur: bakılıp geçilemez, kapatılması gerekir.
- **Sonuç zorunlu kapatma** — "kapattım" demek yetmez; ulaşıldı mı, ödeme sözü mü
  alındı, itiraz mı var, girilmek zorunda. Hem kodda hem veritabanı kısıtında.
- **Eskalasyon merdiveni** — süresi geçen iş kendiliğinden yukarı çıkar:
  sorumlu → yönetici → üst onay. Kimsenin hatırlaması gerekmez.
- **8 kademeli alacak risk skoru** — beş bileşenden hesaplanır ve *neden* o skoru
  aldığı ekranda gösterilir.
- **Raporlama ve veri çekme** — her liste ve rapor `json | csv | xlsx` verir;
  API anahtarıyla panel dışından da (Excel, Power BI, n8n) çekilebilir.

## Hızlı başlangıç

```bash
cp .env.example .env      # OTURUM_SIRRI'yi değiştirin
docker compose up -d
npm run tohum             # kullanıcılar + ayarlar + tatiller
```

Panel `http://localhost:8080`, API belgeleri `/api/belgeler`.

Mikro'suz denemek için `.env` içinde `MIKRO_ADAPTER=seed` bırakın — gerçekçi
sahte veriyle tüm zincir çalışır.

## Geliştirme

```bash
npm install
npm run gecis                 # veritabanı geçişleri
npm run tohum
npm run is -- W-01 W-02 W-03  # zinciri elle çalıştır
npm run dev                   # API  :8080
npm run dev:web               # panel :5173 (API'ye vekil eder)
npm test                      # birim testler
TEST_DATABASE_URL=postgres://mirfix:mirfix@localhost:5432/mirfix_test npm test   # + uçtan uca zincir testi
```

## Mimari

```
Mikro (MSSQL)  ──salt-okunur──▶  stg_*  ──hesap──▶  an_*  ──▶  op_*  ──▶  panel / API
   değişmez                      ham veri          analiz     operasyon      çıktı
```

| Katman | Nerede |
|---|---|
| Saf iş mantığı (yaşlandırma, risk, eskalasyon, iş takvimi) | `apps/server/src/core/` |
| Mikro erişimi (seed / csv / mssql) | `apps/server/src/mikro/` |
| Görev motoru | `apps/server/src/gorev/` |
| Zamanlanmış işler W-01…W-15 | `apps/server/src/jobs/` |
| API v1 | `apps/server/src/api/` |
| Panel | `apps/web/` |
| Şema ve raporlama view'ları | `db/migrations/` |

Ayrıntılı kurulum: [`docs/kurulum.md`](docs/kurulum.md).
Mikro alan eşlemesi: [`docs/mikro-eslesme.json`](docs/mikro-eslesme.json).

## Kapsam dışı

Muhasebe, e-fatura, stok hareketi ve resmî kayıt **bu sistemin işi değildir** —
Mikro'da kalır. Kapsam kayması olursa proje bir ERP yazma projesine döner ve
devreye alınamaz.
