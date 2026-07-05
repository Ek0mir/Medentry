---
tip: blueprint/bolum
kod: MRF-OS-07
surum: v1.0
tarih: 2026-07-05
sahip: Chief Systems Architect
durum: onaylandi
bagimlilik: [MRF-OS-02, MRF-OS-03]
---

# BÖLÜM 7 — KURUMSAL HAFIZA MOTORU
## "Şirkette Öğrenilen Hiçbir Bilgi Kaybolmaz"

> **Doktrin:** Bilgi kişinin kafasında değil, sistemin bağ dokusunda yaşar. Bir insan
> ayrılınca bildiği gitmez; çünkü yazılmıştır (İlke 3) ve en az 3 yere bağlanmıştır
> (İlke 7). Kurumsal hafıza, bu bağların otomatik kurulması ve bakımıdır.

---

## 7.1 3-Bağlantı Kuralı ve Bağlantı Türleri Sözlüğü

**Kural:** Hiçbir kayıt en az 3 anlamlı bağlantı almadan "tam" sayılmaz (İlke 7).
Bağlantısız not = yetim not = kayıp bilgi adayı.

### Bağlantı Türleri Sözlüğü
| Tür | Anlam | Örnek |
|---|---|---|
| `ilgili-musteri` | Kayıt bir cariye ait | Sipariş → [[CAR-2026-00042]] |
| `ilgili-urun` | Kayıt bir ürünle ilgili | Şikâyet → [[MFX-...]] |
| `kaynagi` | Bilginin geldiği yer | Karar → [[TOP-2026-00007]] |
| `parcasi` | Üst yapıya ait | Görev → [[PRJ-2026-00003]] |
| `sonucu` | Bir eylemin çıktısı | Sevkiyat → [[SIP-2026-00817]] |
| `benzer` | Bilgi atomu ilişkisi | [[Fason fiyatlama notu]] |

Her varlık şablonu, YAML `iliskiler[]` alanında en az 3 slot ile gelir (B2.6).

---

## 7.2 Otomatik İlişkilendirme

Elle bağ kurmak yorucudur; motor yardım eder — ama **AI önerir, insan onaylar** (İlke 4).

1. **AI Etiketleyici:** INBOX'a düşen not → agent metni okur → önerilen tip, etiket, ilişki
   çıkarır → not YAML'ına *taslak* olarak yazar → insan haftalık INBOX ritüelinde teyit eder.
2. **İsim Çözümleme:** Serbest metindeki "Pazarcık Faruk" → sistem CAR kayıtlarında arar →
   `[[CAR-2026-00051 Faruk Yapı]]` önerir. Belirsizse (>1 eşleşme) insana sorar, uydurmaz.
3. **Backlink Denetimi:** Her kayıt oluşunca geri-bağ kontrolü: hedef not bu kaydı görüyor mu?
   Tek yönlü bağlar haftalık raporda listelenir.

---

## 7.3 Uçtan Uca Senaryo — Bir Toplantının 8 Varlığa Bağlanışı

> **Olay:** 12 Mart'ta Pazarcık'ta İbrahim Yapı ile toplantı. Yeni ürün talebi, gecikmiş
> ödeme, bir şikâyet, bir bayi adayı önerisi konuşuldu.

Toplantı notu (TOP-2026-00019) işlenince motor şu 8 bağı kurar:

1. **CAR** — [[CAR-2026-00042 İbrahim Yapı]] (ilgili-musteri)
2. **THS** — gecikmiş ödeme → [[THS-2026-00311]] güncellenir + ödeme sözü nesnesi eklenir
3. **SKY** — dile getirilen şikâyet → [[SKY-2026-00028]] açılır (kök-neden Kalite Agent'a)
4. **MFX** — talep edilen yeni ürün → [[MFX-... reçete talebi]] Ar-Ge Agent'a düşer
5. **BAY** — önerilen bayi adayı → [[BAY-2026-00007 aday]] CRM Agent'a
6. **GRV** — 3 görev üretilir (numune gönder, ödeme planı ara, şikâyeti çöz)
7. **KRR** — "İbrahim'e vade 45 güne çıkarılsın mı?" → Karar Defteri'ne (insan onayı bekler)
8. **Bilgi Atomu** — "Pazarcık bölgesinde X ürünü talebi artıyor" kalıcı öğrenme notu

Tek bir 20 dakikalık toplantı → 8 canlı bağ, 3 görev, 1 karar. Kimse hatırlamak zorunda değil.

---

## 7.4 Bilgi Güven Puanı (guven: 0–3)

AI-KOS'tan devralınan `guven` alanı OS geneline yayılır. Her bilgi atomu bir güven taşır:

| Puan | Anlam | Kaynak örneği |
|---|---|---|
| 0 | Doğrulanmamış / söylenti | "Duyduğuma göre rakip zam yapmış" |
| 1 | Tek kaynak, teyit yok | Bir müşterinin sözlü beyanı |
| 2 | Belge/veri var | Fatura, WhatsApp ekran görüntüsü |
| 3 | Çapraz doğrulanmış | 2+ bağımsız kaynak + belge |

**Doğrulama döngüsü:** Agent'lar kararlarında yalnızca guven≥2 bilgiyi "kanıt" sayar (B8.3).
guven=0/1 bilgiler "araştırılacak" kuyruğuna düşer; çeyreklik denetimde ya yükseltilir ya arşivlenir.

---

## 7.5 Kişi Ayrılınca Bilgi Kalır — Devir Protokolü

1. **Rol-Hafıza Paketi:** Her rolün (B1.4) sahip olduğu tüm kayıtlar Dataview ile tek listede
   (`sahip = <rol>`). Ayrılan kişinin değil, ROLün paketi devredilir.
2. **Devir Kontrol Listesi:** açık görevler, bekleyen kararlar, aktif müşteri ilişkileri,
   credential'lar (rotasyon — B1.5), bilinen ama yazılmamış bilgiler (çıkış görüşmesinde yakalanır).
3. **72 Saat Kuralı:** Ayrılış öncesi 72 saatte "kafandaki yazılmamış her şeyi INBOX'a boşalt" seansı.

---

## 7.6 Çeyreklik Hafıza Denetimi

Her çeyrek başı, Sistem Sağlık WF'i (WF-14) tarar:
- **Yetim notlar** — 3'ten az bağı olan kayıtlar → sahibine görev
- **Kopuk bağlar** — hedefi silinmiş/taşınmış linkler → düzeltme kuyruğu
- **Bayat bilgi** — 12 aydır dokunulmamış guven≤1 atomlar → arşiv/yükselt kararı
- **Sahipsiz kayıt** — `sahip` alanı boş → role atama

Çıktı: "Hafıza Sağlık Raporu" — CEO Dashboard'da bir kart.

---

## Uygulama Kontrol Listesi — Bölüm 7
- [ ] 3-Bağlantı kuralı tüm şablonlara `iliskiler[]` slotu olarak işlendi
- [ ] Bağlantı türleri sözlüğü Ek H'ye eklendi
- [ ] AI etiketleyici INBOX ritüeline bağlandı (öneri → insan teyidi)
- [ ] `guven` alanı tüm bilgi atomu şablonlarında zorunlu
- [ ] Rol-Hafıza Paketi Dataview sorgusu hazır
- [ ] Çeyreklik denetim WF-14'e bağlandı

## Sizden Beklenen Girdiler
| # | Soru | Neden |
|---|---|---|
| 1 | Ayrılan personel devir sürecinde yasal/İK zorunlulukları | Devir protokolü |
| 2 | Hangi bilgiler "gizli" sınıfta, devirde kısıtlı mı | Erişim (B1.5) |

---
*MRF-OS-07 · v1.0 · 05.07.2026 · Chief Systems Architect Ofisi*
