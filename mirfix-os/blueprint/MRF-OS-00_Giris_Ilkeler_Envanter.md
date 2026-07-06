---
tip: blueprint-bolum
kod: MRF-OS-00
baslik: "Giriş, İlkeler ve Mevcut Varlık Envanteri"
surum: v1.0
tarih: 2026-07-05
sahip: CEO (Kurucu Ortak)
durum: onaylandi
alan: OS
etiketler: [anayasa, ilkeler, envanter, mimari]
---

# BÖLÜM 0 — GİRİŞ, İLKELER ve MEVCUT VARLIK ENVANTERİ

> **Bu belge MİRFİX OS'in anayasasıdır.** Diğer tüm bölümler ([B1](MRF-OS-01_Dijital_Omurga.md) ve devamı) bu belgede tanımlanan ilkelere tabidir. Bir çelişki durumunda BÖLÜM 0 üstündür. Bu belgeyi değiştirmek, sistemin anayasasını değiştirmek anlamına gelir ve yalnızca CEO onayı ile mümkündür.

---

## 0.1 Amaç, Kapsam ve Hedef Okuyucu

### Amaç

MİRFİX Yapı Kimyasalları (EKOMİR İnşaat Mühendislik Robotik San. ve Tic. Ltd. Şti.), yapı kimyasalları üretiminde büyümek isteyen, küçük ve çevik bir ekiple (5 kişi + AI agent'lar) çalışan bir üreticidir. Şirket bugün 22 belgelik bir satış seti, MFX kodlu bir fiyat listesi, 8 kademeli bir risk/kredi matrisi, 241 formluk bir mutabakat sistemi, nakit akış analizleri ve AI-KOS (Obsidian + Claude + n8n) altyapısı gibi güçlü ama **dağınık** varlıklara sahiptir. Bu varlıklar tek tek değerlidir; ancak birbirine bağlı, tek bir doğruluk kaynağından beslenen ve otomasyonla yaşayan bir bütün oluşturmazlar.

**MİRFİX OS'in amacı**, bu dağınık varlıkları Sika / Mapei / Weber disiplininde çalışan tek bir kurumsal işletim sistemi altında birleştirmektir. Hedef, patronun kafasındaki bilgiyi belgeye, belgeleri birbirine, süreçleri otomasyona ve kararları ölçülebilir verilere bağlamaktır.

### Kapsam

Bu Blueprint şu alanları kapsar:

- **OS (Çekirdek):** Bilgi mimarisi, dijital omurga, yetki/rol yapısı, güvenlik, sürüm yönetimi.
- **SAT (Satış):** 22 belgelik satış seti, teklif–sözleşme–sipariş akışı.
- **URT (Üretim):** Fason üretim, reçete, ambalaj (şirink/streç/zımba, torba, palet), hammadde (çimento + kum).
- **FIN (Finans):** Nakit akış, alacak–borç, risk matrisi, tahsilat.
- **PZR (Pazarlama):** Ürün veri yönetimi, bayi programı, dijital içerik.
- **IK (İnsan Kaynakları):** Rol katalogları, prosedürler.
- **IHR (İhracat):** Dış pazar süreçleri (ileriki fazlarda).

Kapsam dışı (bu fazda): ERP satın alma kararı, muhasebe yazılımı değişimi, e-fatura entegrasyon detayları. Bunlar **birer "fiş"** olarak ele alınır (bkz. [0.3](#03-tasarım-felsefesi-araç-bağımsızlık-doktrini)).

### Hedef Okuyucu

| Okuyucu | Bu Blueprint'i Neden Okumalı |
|---|---|
| CEO / Kurucu Ortak | Sistemin sahibi ve nihai karar mercii. Anayasayı onaylar. |
| Satış Sorumlusu (Ferhat B. rolü) | Satış akışlarını ve onay kapılarını uygular. |
| Üretim Sorumlusu | Reçete, fason ve ambalaj süreçlerini bağlar. |
| Kasa / Finans | Risk matrisi, tahsilat ve nakit akış disiplinini yürütür. |
| Depo–Sevkiyat | Sevkiyat blokajı ve stok kayıt kurallarına uyar. |
| AI Agent'lar (KOS) | Bu belgeler agent'ların anayasası ve bilgi tabanıdır. |
| Dış Muhasebe / Danışman | Sistemin sınır ve arayüzlerini anlar. |

---

## 0.2 MİRFİX OS Nedir / Ne Değildir

### MİRFİX OS **Nedir**

MİRFİX OS, bir bilgisayarın işletim sistemi gibi, şirketin üzerinde çalıştığı **soyut ama her yerde olan** katmandır. Nasıl ki Windows üzerinde Word, Excel ve tarayıcı çalışır ama Windows bunların hiçbiri değildir; MİRFİX OS de WhatsApp, Obsidian, n8n, Google Drive ve muhasebe programının **üzerinde** yaşar, ama bunların hiçbirine bağımlı değildir.

MİRFİX OS:

- Bilginin nasıl yakalanacağını, sınıflanacağını, saklanacağını ve imha edileceğini tanımlar.
- Kararların kim tarafından, hangi kanıta dayanarak alınacağını belirler.
- İnsan ile AI arasındaki iş bölümünü ("AI önerir, insan onaylar") kurallara bağlar.
- Her belgeye bir kod, bir sahip ve bir sürüm verir.

### MİRFİX OS **Ne Değildir**

- **Bir yazılım değildir.** Satın alınacak, kurulacak, lisanslanacak bir program değildir. Yarın Obsidian yerine başka bir not aracı gelirse, OS değişmez; sadece "fiş" değişir.
- **Bir ERP değildir.** ERP bir araçtır; OS ERP'nin de üzerinde durur. İleride bir ERP alınırsa, o da OS'e takılan bir fiştir.
- **Patronun kişisel hafızası değildir.** OS, bilgiyi patronun kafasından çıkarıp role ve belgeye taşımak için vardır (İlke 10).
- **Bir defalık proje değildir.** Kademeli devreye alınan, sürümlenen, yaşayan bir organizmadır (İlke 6).

> **Özet cümle:** *MİRFİX OS bir yazılım değil, yazılımların üzerinde yaşayan işletim sistemidir.*

---

## 0.3 Tasarım Felsefesi: Araç-Bağımsızlık Doktrini

MİRFİX OS'in en kritik mühendislik kararı **araç-bağımsızlıktır**. Küçük bir ekip, tek bir aracın esiri olamaz. Bir SaaS servisinin fiyatını on katına çıkarması, kapanması veya erişimi kesmesi şirketi felç etmemelidir.

### İlke 1 — Düz Metin Önceliği (Markdown + CSV)

Her bilginin **birincil ve kalıcı hali düz metindir**:

- Belgeler → **Markdown (.md)** + YAML frontmatter.
- Tablolar, listeler, kayıtlar → **CSV**.
- Görseller, PDF'ler, fotoğraflar → dosya olarak; ama künyesi (metadata) düz metinde.

Düz metin; her cihazda açılır, hiçbir lisans gerektirmez, Git ile sürümlenir, 30 yıl sonra da okunur. "Zengin" ama kapalı formatlar (özel not uygulaması veritabanı, tescilli ERP tabloları) **asla tek doğru kaynak olamaz**.

### İlke 2 — Her Araç Bir "Fiş"tir

Bir bilgisayarın USB portuna klavye, fare, disk takılır; bilgisayar bunların hangisi olduğuyla ilgilenmez, ortak bir arayüzden konuşur. MİRFİX OS de aynıdır:

| Fiş (Araç) | Görevi (Port) | Yerine Ne Takılabilir |
|---|---|---|
| Obsidian | Bilgi çekirdeği editörü | VS Code, Logseq, herhangi bir Markdown editörü |
| n8n | Otomasyon motoru | Make, Zapier, Node-RED, kendi script'lerimiz |
| Google Drive | Dosya deposu | OneDrive, S3, yerel NAS |
| WhatsApp | Yakalama kanalı | Telegram, SMS, e-posta |
| Claude / KOS | Zekâ katmanı | Başka bir LLM, insan analist |

Her fiş **ortak veri sözleşmesine** (düz metin girdi/çıktı) uyduğu sürece, hangi markanın takılı olduğu OS'i ilgilendirmez.

### İlke 3 — Çıkış Stratejisi (Exit Strategy)

Bir aracı seçmeden önce **"Bu araç yarın ölürse verimi nasıl çıkarırım?"** sorusuna cevap olmalı. Kural:

1. **Veriyi asla sadece bir aracın içinde tutma.** Obsidian vault'u aynı zamanda Git deposudur ve Drive'da aynalanır (3-2-1, bkz. [B1 §1.5](MRF-OS-01_Dijital_Omurga.md)).
2. **Dışa aktarımı test et.** Her araç için "tüm veriyi CSV/MD olarak dışa aktar" adımı çeyrekte bir denenir.
3. **Bağımlılık sınırı.** Hiçbir kritik süreç, dışa aktarımı imkânsız bir aracın içine gömülmez.
4. **Ölüm senaryosu tatbikatı.** "n8n bugün kapandı" senaryosunda kritik akışların manuel yedek prosedürü [B1 §1.2 çevrimdışı senaryo] altında tanımlıdır.

> **Doktrin cümlesi:** *Aracı severiz ama ona güvenmeyiz. Veriye güveniriz.*

---

## 0.4 On Kurucu İlke

Bu on ilke MİRFİX OS'in davranış kurallarıdır. Her belge, her akış, her agent bu ilkelere uymak zorundadır.

### İlke 1 — Tek Doğru Kaynak (SSOT)

Her bilgi parçasının **tek bir yetkili kaynağı** vardır (Single Source Of Truth). Bir müşterinin kredi limiti, bir ürünün fiyatı, bir belgenin son hali yalnızca tek bir yerde "doğru" kabul edilir; diğer her yer o kaynağın kopyasıdır veya ona link verir. Aynı bilginin iki farklı yerde iki farklı değeri varsa, sistem çürümeye başlamış demektir. SSOT ihlali, OS'te en ağır kusurdur. Golden Record (Altın Kayıt) ilkesi bu ilkenin veri katmanındaki uygulamasıdır (bkz. [B1 §1.2](MRF-OS-01_Dijital_Omurga.md)).

### İlke 2 — Her Bilginin Bir Sahibi Var

Sahipsiz bilgi çürür. Her belge, her CSV, her akış ve her karar defterinin YAML frontmatter'ında bir **`sahip` (rol)** alanı bulunur. Sahip; bilginin güncelliğinden, doğruluğundan ve arşivlenmesinden sorumludur. Sahip bir **kişi değil roldür** (İlke 10); "Ferhat" değil "Satış Sorumlusu" sahiptir. Böylece kişi ayrıldığında bilgi sahipsiz kalmaz, rol devredilir.

### İlke 3 — Yazılmayan Bilgi Yok Hükmündedir

Bir bilgi WhatsApp'ta konuşulduysa ama sisteme yazılmadıysa, o bilgi **yoktur**. Sözlü anlaşmalar, "hallettim", "konuştuk halloldu" gibi ifadeler OS'te geçersizdir. Bu ilke, patronun kafasındaki değeri belgeye taşımanın motorudur. Bir sipariş, bir taviz, bir söz — yazılmadıysa hiç yaşanmamıştır. Bu acımasız ama koruyucudur: hafızayı kişiden kuruma taşır.

### İlke 4 — AI Önerir, İnsan Onaylar

AI agent'lar (KOS) analiz eder, taslak hazırlar, uyarır, önerir ve hesaplar. Ancak **para, taahhüt veya risk doğuran hiçbir kararı tek başına veremez.** Fiyat, kredi limiti, sevkiyat serbestisi, sözleşme, ödeme talimatı gibi kararlar mutlaka bir insanın **onay kapısından** geçer (9 Kapı, bkz. [B1 §1.4](MRF-OS-01_Dijital_Omurga.md)). AI'ın gücü hız ve tutarlılık; insanın gücü sorumluluk ve sezgidir. İkisi ayrılmaz.

### İlke 5 — Önce Yakala, Sonra Mükemmelleştir

Bir bilgiyi kaybetmektense, dağınık ama kayıtlı tutmak yeğdir. 00_INBOX disiplini bu ilkeye dayanır: gelen her şey önce ham haliyle yakalanır, sonra sınıflanır ve işlenir (bkz. [B1 §1.1](MRF-OS-01_Dijital_Omurga.md)). "Mükemmel formatı bulana kadar bekleyelim" tuzağı, en çok bilgi kaybettiren tuzaktır. Yakala; iyileştirme sonra gelir.

### İlke 6 — Kademeli Devreye Alma

MİRFİX OS bir gecede kurulmaz. Küçük ekip, aynı anda 20 yeni disiplini kaldıramaz. Sistem **fazlara** bölünür; her faz çalıştığı kanıtlandıktan sonra bir sonraki gelir. Önce yakalama, sonra sınıflama, sonra otomasyon, sonra zekâ. "Büyük patlama" ile tüm sistemi aynı anda açmak, en sık başarısızlık nedenidir. Küçük, çalışan adımlar; büyük, çökmüş planlardan iyidir.

### İlke 7 — Her Kayıt En Az 3 Bağlantı

İzole bir belge ölü bir belgedir. Her kayıt, en az **üç başka kayda** bağlanır (link, etiket veya referans). Bir müşteri kaydı → risk sınıfına, sipariş geçmişine ve mutabakat formuna bağlanır. Bu ağ yapısı, bilgiyi "aranabilir" olmaktan çıkarıp "keşfedilebilir" yapar. Bağlantısız bilgi, arşivde kaybolur; bağlantılı bilgi, bir tıkla komşularını gösterir. Obsidian graph görünümü bu ilkenin görsel denetimidir.

### İlke 8 — Ölçülmeyen Yönetilmez

Bir süreç ölçülmüyorsa, iyileştiği veya bozulduğu bilinemez. Her kritik süreç bir **KPI**'a bağlanır: DSO (tahsilat gün sayısı), teklif→sipariş dönüşümü, sevkiyat gecikmesi, fire oranı vb. Ölçüm, dashboard'da görünür (K5 katmanı). "Hislerle yönetim" büyümenin tavanıdır; MİRFİX OS sayılarla yönetir.

### İlke 9 — Sürümsüz Belge Yayınlanmaz

Sürümü olmayan belge güvenilmezdir. Her belge YAML frontmatter'ında `surum` (v1.0, v1.1...) ve `durum` (taslak / gözden-geçiriliyor / onaylandi) taşır. Hangi kararın hangi belgenin hangi sürümüne dayandığı her an izlenebilir olmalıdır. Sürümsüz bir fiyat listesi, hangi anlaşmanın hangi fiyata yapıldığı sorusunu cevaplayamaz. Sürüm, kurumsal hafızanın omurgasıdır (bkz. [B1 §1.6](MRF-OS-01_Dijital_Omurga.md)).

### İlke 10 — Sistem Patrona Değil Role Çalışır

MİLFİX OS'in nihai testi şudur: **CEO iki hafta ulaşılamaz olsa, şirket çalışmaya devam eder mi?** Sistem, kişilere değil **rollere** kuruludur. "Bunu Ahmet bilir" cümlesi bir risktir; "Bunu Kasa/Finans rolü bilir ve belgede yazar" cümlesi bir sistemdir. Kişiler gelir gider; roller ve belgeler kalır. Bu ilke, şirketi kurucuya bağımlı bir atölyeden, kendi kendine yürüyen bir kuruma dönüştürür.

---

## 0.5 Mevcut Varlık Envanteri ve OS'e Bağlanma Adresleri

MİRFİX bugün sıfırdan başlamıyor; ciddi varlıkları var. Aşağıdaki tablo, her mevcut varlığın OS içindeki **bağlanma adresini** (hangi bölüm, hangi akış, hangi agent) gösterir. Bu, "yeni sistem eskiyi çöpe atmaz, üzerine oturur" ilkesinin haritasıdır.

| # | Mevcut Varlık | Açıklama | OS'e Bağlanma Adresi |
|---|---|---|---|
| 1 | **22 belgelik satış seti** (MRF-SAT-*) | Teklif, sözleşme, sipariş, teslim belgeleri | **B3 Satış** — her belge B3'te bir form karşılığına eşlenir; geriye uyumlu kodlama korunur |
| 2 | **MFX kodlu fiyat listesi** | Ürün–fiyat–ambalaj matrisi | **B3.3** Fiyatlandırma modülü; SSOT olarak tek fiyat kaynağı |
| 3 | **8 kademeli risk/kredi matrisi** (A–H) | Müşteri sınıfı bazlı limit/vade | **B3.2** (satış onayı) + **B4 Tahsilat Agent** (izleme/uyarı) |
| 4 | **241 formluk mutabakat sistemi** | Cari mutabakat formları | **WF-04** Mutabakat akışı |
| 5 | **Nakit akış / alacak-borç analizleri** | Excel/CSV finansal tablolar | **B6 Finans** — dashboard'a beslenir, DSO ve likidite KPI'ları |
| 6 | **AI-KOS** (Obsidian + Claude + n8n, güven alanı 0-3, Git sync) | Mevcut bilgi + otomasyon altyapısı | **B2 / B7 temeli** (bilgi çekirdeği ve kurumsal hafıza); pazarlama tarafı **B5 / WF-09** |
| 7 | **WhatsApp arşivi** ("Mirfix sipariş" grubu + finans + üretim-kasa icmal fotoğrafları) | Ham yakalama kanalı | **WF-01** (sipariş yakalama) / **WF-06** (finans-kasa icmal işleme) |

> **Not:** "Güven alanı 0-3" ifadesi KOS'un mevcut yetki kademelerini tanımlar; OS'te bu, İnsan-Onay Kapıları (9 Kapı) ile hizalanır (bkz. [B1 §1.4](MRF-OS-01_Dijital_Omurga.md)).

---

## 0.6 Referans Model Analizi — Sika, Mapei, Weber

MİRFİX, yapı kimyasalları sektörünün küresel disiplinini (Sika, Mapei, Saint-Gobain Weber) referans alır; ama onların ağır bürokrasisini değil, **özünü ve AI ile yeniden yorumunu** alır.

| Referans | **Ne Alınacak** | **Ne Alınmayacak** | **AI ile Yeniden Yorum** |
|---|---|---|---|
| **Sika** | Belge disiplini; TDS/MSDS standardı; kalite izlenebilirliği | Devasa onay zincirleri; çok katmanlı bürokrasi | TDS taslaklarını AI üretir, teknik sorumlu onaylar |
| **Mapei** | Ürün veri yönetimi; sistem satışı (çözüm paketi); eğitim kültürü | Yüzlerce SKU'luk şişkin katalog | AI ürün seçim asistanı; müşteriye doğru ürün önerisi |
| **Weber** | Bayi programı; sadakat ve segmentasyon; KPI kültürü | Ağır CRM lisans maliyetleri; büyük saha ekibi | Bayi skorlaması ve tahsilat izleme AI ile |

**Doktrin:** *Büyüklerin disiplinini al, hantallığını alma. Onların 500 kişiyle yaptığını, biz 5 kişi + AI ile yapacağız.*

Alınacakların özeti:
- **Belge disiplini** → İlke 9 (sürüm) + doküman mimarisi (bkz. [B1 §1.7](MRF-OS-01_Dijital_Omurga.md)).
- **Ürün veri yönetimi** → B5 Pazarlama + TDS/MSDS standardı.
- **Bayi programı** → B5 bayi segmentasyonu + B4 risk matrisi.
- **KPI kültürü** → İlke 8 + K5 dashboard.

---

## 0.7 Üst Mimari Şeması — 5 Katman

MİRFİX OS beş katmanlı bir mimaridir. Bilgi aşağıdan yukarı akar (yakalama → karar), kararlar yukarıdan aşağı geri besler (yeni görev → yeni yakalama).

```
┌───────────────────────────────────────────────────────────────────┐
│  K5 · KARAR KATMANI                                                 │
│  Dashboard · KPI paneli · CEO Engine · Karar Defteri                │
│  "Ne yapmalıyız?"  →  onaylanmış kararlar, yeni görevler            │
└───────────────────────────▲───────────────────────┬────────────────┘
                            │ içgörü / uyarı         │ görev / onay
┌───────────────────────────┴───────────────────────▼────────────────┐
│  K4 · ZEKÂ KATMANI (AI Agent'lar / KOS)                             │
│  Satış Agent · Tahsilat Agent · Üretim Agent · Analist Agent        │
│  "AI önerir" (İlke 4) — asla tek başına para/taahhüt kararı vermez  │
└───────────────────────────▲───────────────────────┬────────────────┘
                            │ okur                    │ yazar (taslak)
┌───────────────────────────┴───────────────────────▼────────────────┐
│  K3 · BİLGİ ÇEKİRDEĞİ (SSOT)                                        │
│  Obsidian Vault (.md) + Google Drive (dosya) + Git (sürüm)          │
│  Golden Record · düz metin öncelikli · her kayıt ≥3 bağlantı        │
└───────────────────────────▲───────────────────────┬────────────────┘
                            │ yakalanan veri          │ işlenmiş kayıt
┌───────────────────────────┴───────────────────────▼────────────────┐
│  K2 · OTOMASYON KATMANI (n8n)                                       │
│  Yakala → Sınıfla → Yönlendir → Bildir · WF-01…WF-09 akışları       │
└───────────────────────────▲────────────────────────────────────────┘
                            │ ham girdi
┌───────────────────────────┴────────────────────────────────────────┐
│  K1 · KANALLAR                                                      │
│  WhatsApp · Telefon · Saha (satış/sevkiyat) · E-posta · Fotoğraf    │
└─────────────────────────────────────────────────────────────────────┘
```

### Veri Sözleşmeleri (Katmanlar Arası Arayüz)

Her katman, bir üstteki katmanla **düz metin sözleşmesi** üzerinden konuşur. Örnek:

| Arayüz | Girdi | Çıktı | Format |
|---|---|---|---|
| K1 → K2 | Ham mesaj/fotoğraf | Yapılandırılmış olay | JSON/CSV satırı |
| K2 → K3 | Yapılandırılmış olay | Vault kaydı | Markdown + frontmatter |
| K3 → K4 | Vault kaydı | Analiz bağlamı | Markdown (okuma) |
| K4 → K5 | İçgörü/öneri | Karar talebi | Markdown (Durum-Kanıt-Seçenek) |
| K5 → K1 | Onaylı karar | Yeni görev/mesaj | Bildirim + görev kaydı |

### Geri Besleme Döngüleri

1. **Operasyonel döngü (dakikalar):** Sipariş gelir (K1) → n8n işler (K2) → vault'a yazılır (K3) → agent stok/limit kontrol eder (K4) → sevkiyat onayı (K5) → şoföre görev (K1).
2. **Taktik döngü (günler):** Tahsilat verisi (K3) → Tahsilat Agent DSO hesaplar (K4) → dashboard uyarır (K5) → satışa "X müşterisine sevkiyatı durdur" (K1).
3. **Stratejik döngü (aylar):** Toplam KPI'lar (K5) → CEO Engine trend analizi (K4) → fiyat/ürün/bayi kararı → yeni fiyat listesi sürümü (K3).

---

## 0.8 Terimler Sözlüğü ve Kısaltmalar

| Kısaltma | Açılım | Anlamı (MİRFİX OS bağlamında) |
|---|---|---|
| **SSOT** | Single Source Of Truth | Tek Doğru Kaynak; her bilginin tek yetkili adresi (İlke 1) |
| **OS** | Operating System | İşletim Sistemi; araçların üzerinde yaşayan katman |
| **KOS** | Kurumsal OS / AI-KOS | Mevcut Obsidian+Claude+n8n zekâ altyapısı |
| **WF** | Workflow | İş akışı; n8n'de otomatize edilmiş süreç (WF-01…WF-09) |
| **SIP** | Sipariş | Müşteri sipariş kaydı |
| **DSO** | Days Sales Outstanding | Ortalama tahsilat gün sayısı (alacak yaşlandırma KPI'ı) |
| **RACI** | Responsible-Accountable-Consulted-Informed | Sorumlu-Onaylayan-Danışılan-Bilgilendirilen yetki matrisi |
| **MOC / CR** | Management Of Change / Change Request | Değişiklik Yönetimi / Değişiklik Talebi mini süreci |
| **TDS** | Technical Data Sheet | Ürün teknik veri föyü |
| **MSDS/SDS** | (Material) Safety Data Sheet | Güvenlik bilgi formu |
| **KVKK** | Kişisel Verilerin Korunması Kanunu | Kişisel veri uyum çerçevesi |
| **Golden Record** | Altın Kayıt | Bir varlığın (müşteri/ürün) birleştirilmiş, yetkili tek kaydı |
| **Frontmatter** | YAML üst-veri bloğu | Belge başındaki `tip/kod/surum/sahip/durum` alanları |
| **Vault** | Kasa | Obsidian bilgi çekirdeği deposu (Markdown) |
| **INBOX** | 00_INBOX | Yakalanan ham verinin ilk durağı (İlke 5) |
| **SKU** | Stock Keeping Unit | Ürün stok kodu |
| **Fiş** | (mecaz) Pluggable tool | OS'e takılan, değiştirilebilir araç (İlke: araç-bağımsızlık) |
| **2FA** | Two-Factor Authentication | İki adımlı doğrulama |
| **3-2-1** | Yedekleme kuralı | 3 kopya, 2 farklı ortam, 1 dış lokasyon |
| **CEO Engine** | Karar motoru | Stratejik kararlar için CEO'ya sunulan analiz katmanı |

---

## 0.9 Blueprint Kullanım Kılavuzu ve Sürüm Politikası

### Nasıl Okunmalı

1. **Yeni katılan herkes** önce BÖLÜM 0'ı (bu belge) baştan sona okur. Bu, işe alıştırmanın ilk adımıdır.
2. Rolüne göre ilgili bölüme geçer (Satış → B3, Finans → B6...).
3. Her bölüm sonundaki **Uygulama Kontrol Listesi** ve **Sizden Beklenen Girdiler** tabloları eylem planıdır.

### Belge Kodlama Standardı

Format: **`MRF-[ALAN]-[TİP]-[NO]`**

- **ALAN:** OS, SAT, URT, FIN, PZR, IK, IHR
- **TİP:** BLUEPRINT, FORM, PROSEDUR (PRS), SABLON (TPL), LISTE, RAPOR...
- **NO:** İki haneli sıra (00, 01...)

Örnek: `MRF-OS-00` (bu belge), `MRF-SAT-FORM-03`.

### Sürüm Politikası (İlke 9)

| Aşama | Sürüm | Anlamı |
|---|---|---|
| Çalışma | v0.1 → v0.9 | Taslak, dolaşımda değil |
| İlk yayın | **v1.0** | Onaylandı, yürürlükte |
| Küçük düzeltme | v1.1, v1.2 | İçerik güncellemesi (+0.1) |
| Büyük revizyon | v2.0 | Yapısal değişiklik |

- Her sürüm YAML frontmatter'da (`surum`, `tarih`, `durum`) tutulur.
- Eski sürümler `_ARSIV/` klasörüne taşınır, silinmez.
- Değişiklik yönetimi süreci: bkz. [B1 §1.6](MRF-OS-01_Dijital_Omurga.md).

---

## Sizden Beklenen Girdiler

Bu bölümü tamamlamak ve v1.1'e taşımak için CEO / ekipten aşağıdaki bilgiler gereklidir:

| # | Eksik Bilgi | Neden Gerekli | Sahip | Öncelik |
|---|---|---|---|---|
| 1 | 22 satış belgesinin tam listesi ve mevcut kodları | B3 form eşlemesini kesinleştirmek | Satış Sorumlusu | Yüksek |
| 2 | 8 kademeli risk matrisinin (A–H) limit/vade değerleri | B4 Tahsilat Agent kurallarını yazmak | Kasa/Finans | Yüksek |
| 3 | KOS "güven alanı 0-3" tanımlarının detayı | 9 Kapı ile hizalamak | CEO / KOS | Yüksek |
| 4 | Mevcut ekip 5 kişinin rol dağılımı | Rol katalogunu netleştirmek (B1 §1.4) | CEO | Orta |
| 5 | Ürün/SKU ana listesi ve ambalaj matrisi | Fiyat SSOT ve ürün veri yönetimi | Üretim + Satış | Orta |
| 6 | Kullanılan muhasebe/e-fatura programı adı | Entegrasyon "fiş" tanımı | Dış Muhasebe | Düşük |
| 7 | KVKK aydınlatma metni / veri envanteri mevcut mu? | Güvenlik paketi (B1 §1.5) | CEO | Orta |

---

*İlgili bölümler:* [BÖLÜM 1 — Dijital Omurga](MRF-OS-01_Dijital_Omurga.md)

*Belge sonu — MRF-OS-00 v1.0*
