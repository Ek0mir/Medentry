# 🎣 SAKİN KOY — GAME DESIGN DOCUMENT v1.0
### "Milyon İndirme" Tasarım Kitabı · Premium Idle + Relaxing Fishing
**Sahip:** Yapımcı (sen) · **Teknik Direktör:** Claude · **Tarih:** Temmuz 2026
**Statü:** Master Book & Blueprint'i GENİŞLETİR. Çelişki durumunda Master Book'un KAPI/KPI sistemi kazanır.

> **His formülü:** %20 Dave the Diver (aktif av + kişilik) · %20 Stardew Valley (gün ritmi + köy)
> · %20 Dredge (gizem, stressiz) · %20 Animal Crossing (koleksiyon + müze + gerçek takvim)
> · %20 Alto's Odyssey (tek parmak akış hali + ışık).
>
> **Hedef cümle:** *"Son bir balık daha tutayım."* Bu doküman her sistemi bu cümleye bağlar.

**Etiketler:** Her özellik bir faz taşır → `[P]` prototip (şimdi) · `[VS]` vertical slice ·
`[SL]` soft launch v0.9 · `[GL]` global v1.0 · `[L+]` liveops v1.x · `[SONRA]` sonra.md (dokunma).
Etki etiketleri → **RET** retention · **SES** oturum süresi · **MON** monetizasyon · **MUT** memnuniyet.

---

## 0. TASARIM ANAYASASI (5 Madde — her karar buna vurulur)

1. **Core loop kutsaldır.** Hiçbir meta, 15–45 sn'lik cast döngüsünü yavaşlatamaz veya kesintiye uğratamaz.
2. **Stres yasak, gerilim serbest.** Kayıp cezası yok (misina KOPMAZ, enerji YOK, ölüm YOK). Gerilim = "kaçacak mı?" merakıdır, "kaybedecek miyim?" korkusu değil.
3. **Her cast bir şey ilerletir.** En kötü cast bile altın + bir sayaç (görev/mastery/defter) ilerletir. Boş el dönmek yasak.
4. **Ekran her an 3 yarım hedef gösterebilmeli.** (Zeigarnik etkisi: yarım kalan iş zihni bırakmaz → "bir balık daha".)
5. **Oyuncu reklama değil, reklam oyuncuya hizmet eder.** (Master Book §8.3 manifesto aynen geçerli.)

---

# BÖLÜM 1 — CORE GAMEPLAY LOOP (Saniye Saniye)

## 1.1 Döngünün anatomisi (hedef: 18–40 sn/cast)

| Zaman | Oyuncu | Sistem/Animasyon | Kamera | Partikül/VFX | Ses | Titreşim |
|---|---|---|---|---|---|---|
| 0.0–0.3 | AT'a basar (veya basılı tutar → güç) | Balıkçı kolunu kaldırır, olta esner (squash) | %4 zoom-out | — | Misina "vınn" | hafif tık |
| 0.3–0.8 | — | Kanca parabolle suya girer | Kancaya kilitlenir | Su sıçraması + halka dalga | "Plop" + damla | orta |
| 0.8–8s | Parmakla kancayı yönlendirir | Kanca iner; balıklar davranışına göre tepki verir | Dikey pan, derinlikle hızlanır hissi (paralaks) | Baloncuk izi | Derinlik bandı değişince 2-nota jingle; müzik low-pass'e girer | — |
| her yakalama | balığa değer | 80ms hitstop + balık squash | 2px sarsıntı | Nadirlik renginde patlama | Tık + nadirlik perdesi | nadirliğe göre 1–3 vuruş |
| near-miss | nadir balığı ıskalarsa | Balık parlar, "!" baloncuğu, yavaşça uzaklaşır | mikro-slow %92 | ışık izi | Kısık "vuu" (hüsran değil merak tonu) | — |
| kapasite dolu / SAR | SAR'a basar (veya otomatik) | Makara sarma; hız üstel artar | Yukarı pan + hız çizgileri | Kabarcık duvarı | Makara "tık-tık-tık" ASMR + crescendo | ritmik mikro |
| yüzey +0.3s | — | Balıklar yay şeklinde havaya dizilir | %6 zoom-in | Su patlaması + güneş parıltısı | "Şlap!" + martı | kuvvetli tek |
| +0.3–1.5s | (izler — dopamin anı) | Balıklar tek tek sayaca UÇAR, altın sayacı akar | — | Coin pop ×n (60ms arayla) | "ka-ching" ×n, perde her seferinde +yarım ton | her coin mikro |
| +1.5s | Karar: tekrar AT / sür / yükselt | YÜKSELT rozeti yanıyorsa nazikçe pulse | idle çerçeve | — | Ambient geri açılır | — |

**Nadir (4★+) yakalama istisnası:** 300 ms slow-motion + vignette + ışık hüzmesi + özel fanfar + keşif kartı. Oturumda ilk 5★: ekran kenarları altın parlar (bir kez — enflasyona uğratma).

- **RET:** Kısa, tamamlanmış döngü + değişken ödül oranı = klasik alışkanlık döngüsü; near-miss geri dönme isteği yaratır (kumar psikolojisinin etik kullanımı: kayıp yok, sadece "az kalmıştı").
- **SES:** "Havaya dizilme + sayaca uçma" anı 1.5 sn'lik ödül vuruşu — oyuncu bir sonrakini görmek için devam eder.
- **MON:** Near-miss anı = "Tekrar dene (reklam)" placement'ının doğal evi; dönüşümü standart placement'ın 3–5 katı.

## 1.2 Beceri katmanı: PERFECT CATCH `[VS]`
Kanca halkası balığın **gövde merkezine** denk gelirse (±6px): "Mükemmel!" ×1.5 değer + ekstra mastery puanı. Ardışık perfect → combo ×2/×3 (max ×3; Ridiculous Fishing DNA'sı, ama ıskalayınca combo kaybolur — ceza yok, sadece sıfırlanır).
- **RET/SES:** Beceri tavanı skoru "kendi rekorum" yapar; casual oyuncu fark etmeden oynar, optimizasyoncu Can kovalar. **MON:** "Perfect şansı +%20" premium yem satışının gerekçesi.

## 1.3 Juice envanteri (eksiksiz liste — his bunlarla yaşar) `[VS]`
Ekran sarsıntısı (yakalamada 2px, boss'ta 6px) · hitstop (80ms) · squash&stretch (kanca+balık) · coin pop perde merdiveni · sayaç akışı (count-up) · su halkaları · güneş parıltısı · derinlik bandı renk jingle'ı · haptic partitürü (aşağıda §13.4) · balıkların kancadan mikro-kaçınma "ürperti" animasyonu · idle'da balıkçının nefesi + martı konması (30 sn hareketsizlikte — Alto sükuneti).

---

# BÖLÜM 2 — OYUNCU HAREKETİ (Joystick Sistemi)

## 2.1 Durum makinesi `[P: tekne tamam · VS: yürüme]`

```
   TEKNE (deniz) ──iskeleye yanaş──▶ YÜRÜME (iskele/köy/ada)
      ▲  │ cast → OLTA MODU (joystick kilitli, "önce sar" ipucu)
      │  └─ mağara girişi ──▶ MAĞARA (fener yarıçapı + yankı sesi)
      └── tekneye bin ◀──────────────┘
```

- **Tekne `[P — v0.3'te CANLI]`:** Sol joystick yatay sürüş; ivme 640px/s², sürtünme exp(−2.6t), maks 250px/s; hızla gövde yatar, köpük izi. Dünya 4600px; dip 26m→1100m derinleşir; şamandıralar 80/250/600/1000m işaretler. **Hareket = ilerleme ekseni:** nadir tür uzakta VE derinde.
- **Yürüme `[VS]`:** İskeleye yanaşınca tek buton "İn". Yürüme alanları: iskele → köy meydanı → 4 NPC kapısı (§5.4). Joystick aynı; zıplama yok, düşme yok (huzur).
- **Mağaralar `[GL]`:** Kayalık burunda 2 giriş. İçeride görüş = fener yarıçapı; fener balığı yakalandıysa yarıçap ×1.6 (balık = araç!). İçeride yankılı damla sesi, özel 3 tür + 1 artifact.
- **Gizli koylar `[GL]`:** Haritada sisli 3 nokta; yaklaşınca sis açılır (keşif "şşşt" sesi). İçerik: 1 efsane balık spotu + 1 şişe mektubu.
- **Hazine adası `[L+]`:** Haftalık rotasyonda beliren küçük ada; harita parçaları (§8.6) burayı işaret eder.
- **Hava etkisi `[GL]`:** Rüzgar teknesini 8–20px/s sürükler (yön göstergesi flama); fırtınada dalga tekneyi sallar, cast sapması +%15 AMA fırtına türleri aktif (opt-in risk: istemeyen limana döner, ceza yok).

- **RET:** Hareket keşif vaadi taşır — "şu sisin arkasında ne var?" yarım hedeftir (Anayasa #4). **SES:** Seyir süresi = doğal oturum uzatıcı; ama Anayasa #1 gereği hiçbir hedef 45 sn'den uzak olamaz (hız yükseltmeleri bunu korur). **MON:** Tekne motoru/hız = altın sink'i; kozmetik tekne skinleri vitrini seyirde görünür.

## 2.2 İtiraz — "balıkçıyı yürütme" kapsamı
Yürüme sadece köy/iskele/adada. **Açık denizde yürüme yok, yüzme yok, dalış yok** (Dave the Diver'a özenip dalış eklemek = ikinci bir oyun geliştirmek; kapsam ölümü). Dalış hissini **kancanın kamera yolculuğu** zaten veriyor.

---

# BÖLÜM 3 — BALIK YAPAY ZEKÂSI ("Canlı Deniz")

## 3.1 Davranış mimarisi: 3 katmanlı LOD `[VS]`
- **LOD0 (ekranda, ≤25 balık):** Tam davranış — steering + kişilik + tepki.
- **LOD1 (ekran çevresi):** Sadece pozisyon entegrasyonu, 10 Hz.
- **LOD2 (uzak):** Var olmayan; spawn tablosunda "olasılık" olarak yaşar.
→ Mobilde 60 FPS'in tek yolu: deniz "simüle" değil "sahnelenmiş" olacak. Oyuncu farkı asla görmez.

## 3.2 Davranış sözlüğü (veri-güdümlü; `fish.csv`'ye kolonlar) `[VS→GL]`

| Davranış | Kural | Örnek tür | Etki |
|---|---|---|---|
| Sürü (boids-lite) | 5–14 birey; ayrılma/hizalanma/çekim, lider takibi | Hamsi, istavrit | Sürüye dalış = çoklu yakalama dopamini |
| Avcı | Sürüye saldırır, sürü dağılır; avcı yakalanırsa **midesinden bonus balık** | Lüfer, palamut | RET: "avcıyı avla" mini-hedef (Dave) |
| Ürkek | Kanca 90px yaklaşınca kaçar; yavaş inişte (≤%60 hız) kaçmaz | Sinarit, kalkan | Beceri: sabırlı iniş öğrenilir |
| Meraklı | Kancaya yaklaşır, 1sn "koklar", %30 kendini takar | Çipura | Bedava sevimlilik + değişken ödül |
| Saldırgan | Kancayı görünce ATLAR (dikkat: kapasiteyi yer) | Fangri | "İstemediğim balık" mikro-kararı |
| Gece | 21:00–05:00 (oyun saati) aktif; fener yemle gündüz de | Fener balığı | Gece oturumu sebebi |
| Yağmur | Sadece yağmurda yüzeye çıkar | Yayın (göl) | Hava = içerik anahtarı |
| Dolunay | Gerçek takvim dolunayında spawn ×3 | Ay balığı | Takvim senkronu = geri dönüş |
| Yem-seçici | Sadece belirli yem tipini yer | Sinarit→canlı yem | Yem ekonomisinin anlamı |
| Derinlik-sadık | Bandı ±10m dışına asla çıkmaz | Hepsi (temel) | Derinlik = harita |

## 3.3 Kişilik (tür başına 1 trait + bireysel %10 sapma) `[GL]`
Aynı türün bireyleri hız/boy/ürkeklikte ±%10 oynar → deniz "kopyala-yapıştır" hissetmez. Boss bireylerin adı vardır ("Koca Orfoz Fettah") — köy NPC'leri ondan bahseder (§7).

## 3.4 Göç & beslenme `[L+]`
- **Haftalık göç:** Her hafta 1 tür "göçte" → spawn noktası değişir, haberi köy panosunda. (RET: haftalık login.)
- **Feeding frenzy:** Günde 2–3 kez, 60 sn, kuş sürüsü işaret eder → o noktada spawn ×2.5 + değer ×1.2. (SES: "5 dk daha kalayım, frenzy gelebilir.")

---

# BÖLÜM 4 — OLTA SİSTEMİ (Yeniden Tasarım)

## 4.1 Cast: güç mekaniği `[VS]`
AT'a **basılı tut** → güç yayı salınır (0→100→0, 1.2sn periyot) → bırak. Güç = kancanın giriş mesafesi (tekneden 0–120px öne) + giriş hızı. Yay tepe noktasında bırakış = "Perfect Cast" (+%10 iniş hızı kontrolü). Rüzgar göstergesi sapmayı gösterir.
**Tek dokunuş korunur:** basıp hemen bırakmak = normal cast. Beceri opsiyonel, asla zorunlu.

## 4.2 Su katmanları: akıntı `[GL]`
50–150m: sağa akıntı (kancayı 6px/s iter) · 150–400m: sola · 400m+: durgun + soğuk mavi ton. Akıntı göstergesi misinada dalgalanma. → Derin iniş pasif izleme olmaktan çıkar, mikro-düzeltme ister (flow hali).

## 4.3 Büyük balık düellosu (SADECE boss/efsane; normal avda YOK) `[GL]`
Gerginlik yayı: balık çeker (bar sağa) / bırakır (bar sola). Oyuncu **basılı tut/bırak** ritmiyle yeşil bantta tutar. 3 tur = yakalama. Bant dışına çıkarsa: **misina kopmaz** — balık "yorulmadan sıyrılır", 1 pul bırakır (pul = teselli para birimi, 10 pul = o türü garantili çağırma yemi). Ritim yavaştır (ASMR-uyumlu), refleks değil sabır testi.
- **İtiraz (vizyon dokümanına):** "Misina kopması/dayanıklılık" istenmişti. **Reddediyorum** — Anayasa #2. Kopan misina = kayıp cezası = churn. "Sıyrılma + pul" aynı gerilimi verir, sıfır öfke üretir. Dayanıklılık istatistiği yerine **"kontrol bandı genişliği"** istatistiği koyuyorum (aynı fantezi, pozitif çerçeve).

## 4.4 Ekipman matrisi `[SL başlangıç, GL tam]`

| Parça | İstatistik | Arketipler |
|---|---|---|
| Olta (5 arketip × 12 sv) | atış mesafesi, kontrol bandı, nadir bonusu | Derinci / Hızcı / Geniş Halka / Şanslı / Dengeli |
| Makara (12 sv) | sarma hızı, perfect penceresi | — |
| Misina (12 sv) | maks derinlik, akıntı direnci | — |
| Kanca (6 tip) | tür ailesine bonus (dip/sürü/avcı/gece/dev/hepsi) | av öncesi seçim = build kararı |
| Yem (8 tip) | canlı (ürkekler) / sahte (avcılar) / kokulu (dipçiler) / ışıklı (gece) / nadir (efsane çağırma) | tüketilebilir, altın sink |

Build çeşitliliği = "bugün gece avına çıkıyorum: gece kancası + ışıklı yem + şanslı olta" → **oturum önü ritüel** (Stardew sabah planı hissi). **MON:** yem tüketimi sağlıklı sink; premium yem = rewarded/IAP; P2W değil çünkü sadece ZAMAN kazandırır, kapı açmaz.

---

# BÖLÜM 5 — DÜNYA TASARIMI

## 5.1 İtiraz & karar: Göl başlangıcı mı, koy mu?
Vizyon "küçük göl" diyor. **Analiz:** Göl = korunaklı, duygusal FTUE ✓ ama "derine in" eksenini 30m'de keser ✗ ve mevcut v0.3 koy dünyasını çöpe atar ✗. **Karar:** Başlangıç **Sakin Koy** kalır ama göl gibi SARILIR (iki yanı tepeli, kapalı koy — görsel olarak göl duygusu). **Dağ Gölü** ayrı biyom olarak `[L+]`'da gelir (yayın balığı + yağmur mekaniği + kurbağa ambiyansı oraya). İki isteğin de özü korunur, sıfır israf.

## 5.2 Lansman biyomları (6) `[GL]`

| # | Biyom | Derinlik | İklim | Tür | Müzik | Sır | Hikaye vuruşu |
|---|---|---|---|---|---|---|---|
| 1 | Sakin Koy | 0–80m | Ilıman, şafak | 12 | Gitar+dalga, 62 BPM | İskele altı kayıp yüzük | Defter sayfa 1–8 |
| 2 | Kayalık Burun | 40–250m | Rüzgârlı | 12 | + yaylı pad | 2 mağara | Kayıp balıkçı Halil'in feneri |
| 3 | Mercan Bahçesi | 60–350m | Berrak, renkli | 14 | Kalimba + su çanı | Gece parlayan mercan | Bilim insanı Dr. Mercan gelir |
| 4 | Batık "Umut" Gemisi | 150–500m | Sisli | 13 | Düşük çello, yankı | Kilitli kasa (anahtar: Buzul'da) | Halil'in gemisi... |
| 5 | Buzul Ağzı | 300–800m | Kar, buz kütleleri | 12 | Cam armonikleri | Buzda donmuş "şey" | Dede buraya neden gelmedi? |
| 6 | Abis Kapısı | 600–1500m | Karanlık, biyolüminesans | 12 | Sadece pad + uzak balina | "Ada" siluetinin ilk geçişi | Defterin yırtık son sayfası |

`[L+]`: Dağ Gölü → Nehir & Şelale → Bataklık → Yeraltı Nehri → Volkan Bacası → Mistik Göl → Ejderha Gölü (yıl 2 sezon finali). Her biri geldiğinde 10–14 tür + 1 NPC + 1 efsane getirir.

**Karanlık derinlik korkusu (Subnautica dozunda, AC yumuşaklığında):** 500m+ ekran kenarları kararır, ses pad'e iner, kalp atışı YOK (stres yasak) — sadece huşu. İlk kez inen oyuncuya tek satır: *"Dede buraya 'denizin rüyası' derdi."*

## 5.3 Köy (meta'nın evi) `[VS iskele, GL köy]`
İskele → meydan: **Usta Nuri** (tamirci/yükseltme) · **Kaptan Saliha** (görev panosu + göç haberleri) · **Dr. Mercan** (müze + bilim görevleri) · **Meraklı Cemil** (çocuk; sana balık hikâyeleri anlatır, FTUE rehberi) · **Lokanta "Dalga"** (sipariş sistemi §6.4) · **Tüccar Rıfkı** (gezgin, haftada 2 gün gelir — kıtlık pazarlaması, etik dozda).

---

# BÖLÜM 6 — PROGRESSION (200+ Saat)

## 6.1 Katman haritası (hangi saat hangi sistem açılır)

| Saat | Açılan | Neden bu sıra |
|---|---|---|
| 0–0.5 | Cast + yükseltme + defter | Core loop yalın öğrenilir |
| 0.5–2 | Joystick + şamandıralar + akvaryum | Mekân + idle motoru |
| 2–6 | Köy iskelesi, görevler, mastery | Günlük ritim kurulur |
| 6–15 | Biyom 2–3, kanca/yem matrisi, müze | Build derinliği |
| 15–40 | Biyom 4–6, boss düelloları, BP | Orta oyun omurgası |
| 40–100 | Efsane avları, koleksiyon kapanışları, crew | Uzman hedefleri |
| 100+ | Prestige "Yeni Sezon Yelkeni", mastery altın, LiveOps | Sonsuz oyun |

## 6.2 Ekonomi eğrileri (Master Book §7 üzerine)
Gelir büyümesi ~1.20^sv, maliyet ~1.12^sv (aynen). **Yeni sink'ler:** yem tüketimi (%10) → ekipman matrisi (%15'e çıkar), köy binası onarımları (tek seferlik büyük sink'ler, "duvar" hissi vermeden — her biri kozmetik + işlev açar). **Pul** (kaçan boss teselli) ve **Sedef** (koleksiyon teslim ödülü) mikro-para birimleri: ASLA satın alınamaz — oyuncu emeği rozeti.

## 6.3 Skill tree (3 dal × 12 düğüm) `[GL]`
**Denizci** (tekne hızı, yakıt verimi, sis görüşü) · **Usta Oltacı** (perfect penceresi, combo tavanı, kontrol bandı) · **Doğa Dostu** (frenzy süresi, göç sezgisi, shiny şansı). Puan kaynağı: mastery rozetleri → **oynayarak** kazanılır, satılmaz.

## 6.4 Crew & evcil `[L+]`
Martı Gak (frenzy'yi 30sn önce haber verir) · Kedi Mırnav (teknede uyur; nadir +%5; SADECE sevimlilik reklamı: kendi başına satış yapar) · Dalgıç Emekli İdris (günde 1 dip hazinesi). Lokanta siparişi (Dave): "3 levrek + 1 kalkan getir → ×1.8 fiyat + tarif kartı (koleksiyon)".

## 6.5 Prestige: Yeni Sezon Yelkeni `[L+]`
Tüm biyomlar + defter %70 → "Yelken Aç": İnci kazan, dünya mevsim değiştirir (görsel yenilenir!), kalıcı çarpanlar. Prestige'de SIFIRLANMAYAN: defter, müze, hikâye, kozmetik (emek asla silinmez — AC dersi).

---

# BÖLÜM 7 — HİKÂYE ("Defterin Yarısı Boş")

- **Ana hat:** Dedenin 48 sayfalık balık defteri. Her 3–4 yeni tür = 1 sayfa anısı açılır (2–3 cümle, ses yok, yağmur sesi eşliğinde). Sayfa 47: dede Abis'e hiç inemedi. Sayfa 48 boş — **oyuncu doldurur** (kendi ilk 5★'ının fotoğrafı otomatik yapıştırılır — oyuncu hikâyenin YAZARI olur).
- **Kayıp balıkçı Halil:** 12 şişe mektubu (rastgele av yan ürünü, ~%1). Mektuplar Batık Gemi'ye işaret eder → kasa → fener → Buzul'da final: Halil kurtulmuş, köyde yaşlı adam olarak zaten tanıdığın biri çıkar (Usta Nuri). Sessiz sahne, tek satır: *"Deniz geri verdi."*
- **6 efsane balık:** Her birinin köyde 3 farklı anlatılan versiyonu (Saliha abartır, Cemil masallaştırır, Dr. Mercan bilimselleştirir). Yakalayınca gerçek ortaya çıkar → defterde "Efsane Sayfası".
- **"Ada":** Abis'te nadiren geçen dev siluet. Yakalanamaz. Yıl 1 boyunca sadece 4 kez görünür (topluluk konuşur!). Yıl 2 sezon finali: Ejderha Gölü'nün anahtarı.
- **Gizli son `[L+]`:** Defter %100 + tüm mektuplar + Ada'yı 3 kez görmüş ol → "Ebedi Şafak Koyu" açılır (salt-kozmetik biyom: altın saat ışığı, jenerik yok, sadece huzur + kredi yazıları balık sürüsü olarak yüzer).

**RET:** Hikâye parçaları av YAN ÜRÜNÜ (görev değil) → asla önünü kesmez, hep çekicidir. **MUT:** Duygusal sahiplik ("defteri BEN doldurdum") kalıcı bağ kurar.

---

# BÖLÜM 8 — KOLEKSİYON

1. **Balık Defteri (Fishdex):** tür + 1–5★ + boy rekoru + **shiny varyant (1/500, renk paleti kayar)** — shiny yakalayınca akvaryumda ışıldar. `[SL]`
2. **Mastery rozetleri:** tür başına bronz(10)/gümüş(100)/altın(1000) + boy rekoru taçları. `[GL]`
3. **Müze (AC'nin kalbi):** Dr. Mercan'ın 6 kanatlı müzesi; **boş vitrinler görünür** (tamamlama dürtüsü). Bağışlanan balık satılamaz — fedakârlık = statü. Kanat tamamlanınca köyde görsel iyileşme (çiçekler, ışıklar). `[GL]`
4. **Artifact'ler (24):** Batık gemi + mağara + dip hazineleri. Her biri müzede hikâye plaketi taşır. `[GL]`
5. **Kabuk & antik sikke:** Kabuk: iskelede günlük 3 (AC plaj ritüeli — 20 saniyelik giriş alışkanlığı). Sikke: müze dekor para birimi. `[L+]`
6. **Harita parçaları (4/hazine):** Hazine adası rotasını açar. `[L+]`
7. **Fotoğraf modu:** filtre + çerçeve + defter yapıştırma + paylaş (organik UA!). Günün teması yarışması §9.3. `[GL]`
8. **Akvaryum:** Master Book §2.2 aynen + shiny/kostüm vitrini. `[SL]`

---

# BÖLÜM 9 — SOSYAL (Multiplayer'sız)

1. **Hayalet tekneler `[L+]`:** Arkadaş kodu → arkadaşının teknesi denizinde NPC olarak belirir; korna çalarsan el sallar; günde 1 hediye kutusu bırakır. (Asenkron = sıfır sunucu maliyeti derdi, tam AC sıcaklığı.)
2. **Tür-bazlı leaderboard `[L+]`:** "Bu haftanın en büyük KALKAN'ı" — her hafta farklı tür → herkesin kazanabileceği bir kulvar var (yalnız balina avcıları değil).
3. **Günlük foto yarışması `[L+]`:** Tema ("gün batımında vatoz") → topluluk beğenisi → kazanan çerçevesi.
4. **Günlük/haftalık meydan okuma `[SL]`:** "Bugün 3 gece balığı" tarzı; ödül sandık.
5. **Hediye kodları `[GL]`:** Arkadaşa günlük 1 yem paketi gönder (viral döngü, değeri düşük → ekonomi bozulmaz).

---

# BÖLÜM 10 — RETENTION SİSTEMLERİ

| Sistem | Tasarım | Faz |
|---|---|---|
| Giriş takvimi | 7 gün; 7. gün HEP kozmetik (şapka!); kaçırılan gün STREAK BOZMAZ, sadece ilerlemez (stres yasağı) | SL |
| Akvaryum sayacı | 4sa→12sa; push: "Akvaryumun doldu 🐠" (günde max 1 push, 19:00–21:00 penceresi) | SL |
| Günlük 3 görev + haftalık mega | Master Book §10.4; mega görev = defter/müze temalı | SL |
| Battle Pass | D3–D7'de açılır; 30 gün, 40 tier; ücretsiz hat CÖMERT (her 2 tier'de bir şey) | GL |
| Gerçek mevsim senkronu | Kış türleri gerçek kışta; dolunay gerçek dolunayda (AC'nin süper gücü) | GL |
| Sezonluk balıklar & festival | Ay tablosu §11; festival = köy süslenir + 3 kostüm balık + mini pass | L+ |
| Gizli balık | Ayda 1, ipucu köy panosunda şifreli ("sisli sabah, üçüncü şamandıra...") — topluluk çözer | L+ |
| Achievement | 120 adet; %30'u mizahi ("Bir şey yakalamadan 10 dk denize bak" → 'Filozof') | GL |

**Push felsefesi:** Günde maks 1, kişiselleştirilmiş, hep MÜJDE (asla FOMO tehdidi: "kaçırıyorsun!" yasak, "seni bekliyor" serbest).

---

# BÖLÜM 11 — LIVEOPS (12 Ay)

| Ay | Event | Büyük içerik | Kozmetik teması |
|---|---|---|---|
| 1 | Lansman şenliği (2× sandık) | — | Kurdele tekne |
| 2 | Sevgililer: çift yüzen balıklar | Dağ Gölü biyomu | Kalp şamandıra |
| 3 | Bahar yağmurları (yayın sezonu) | Fotoğraf yarışması altyapısı | Yağmurluk seti |
| 4 | Ramazan/yerel bayram (pazara göre) | Yuva/üreme (akvaryum v2) | Fener seti |
| 5 | Yaz: tropik göç | Nehir & Şelale | Hasır şapka |
| 6 | Dünya Okyanus Günü (eğitici: gerçek tür bilgileri ×2 sedef) | Prestige v1 | Bilim önlüğü |
| 7 | Gece Pazarı (gece avı festivali) | Bataklık | Neon misina |
| 8 | Büyük Yarış (haftalık tür rekorları) | Crew sistemi | Kaptan üniforması |
| 9 | Sis Ayı (Dredge selamı: gizemli varyantlar) | Yeraltı Nehri | Antik dümen |
| 10 | Cadılar Bayramı 🎃 | Volkan Bacası | Kostüm balıklar |
| 11 | Hasat/Şükran | Mistik Göl | Ahşap oymalar |
| 12 | Yılbaşı + YIL ÖZETİ ("2027'de 4.812 balık tuttun; en nadiri: ...") | Ejderha Gölü fragmanı | Kar küresi akvaryum |

Kural: her event canlıdan **30 gün önce content-complete** (Üretim Süreci Faz 7 aynen).

---

# BÖLÜM 12 — GÖRSEL YÖNETMENLİK (Unity 6 URP)

- **Işık:** Gerçek zamanlı gün döngüsü (30 dk); altın saat & siluet saatinde (günbatımı ±3dk) her şey siluet + turuncu gökyüzü → **screenshot-bait** (Alto). Gece: ay yolu suda.
- **Su:** URP Shader Graph — 2 katman normal scroll + derinlik gradyanı + köpük kenarı (iskele/tekne temas). Yansıma: planar değil (mobil pahalı), **SSR taklidi**: yüzeyde ters sprite + %30 alfa. Caustics: hafif scrolling texture 0–40m.
- **Derinlik hissi:** Renk LUT katmanları (v0.3'teki 6 durak aynen) + partikül yoğunluğu + FOV mikro-daralması.
- **Hava:** Yağmur (halka VFX + ıslak vignette), kar (birikme shader'ı iskelede), sis (exponential fog + ses filtresi), fırtına (bulut paralaksı + dalga amplitüdü ×2).
- **Balık animasyonu:** 2D spine, 3 kare yüzme + korku/merak pozu. Boss'lar 6 kare + göz teması (kameraya bakar — kişilik!).
- **Post: ** Bloom (ışıklı yem/biyolüminesans), vignette (derinlik), chromatic aberration YASAK (rahatsızlık).
- **Performans bütçesi:** 60 FPS orta seviye cihaz; draw call <120; tek atlas/biyom; Object Pool (balık/partikül/coin); Addressables biyom-bazlı; GC per frame 0B hedef (struct event'ler).

---

# BÖLÜM 13 — SES MİMARİSİ

1. **3 katman:** Ambient yatak (biyom) → Müzik (interaktif) → SFX/haptic.
2. **İnteraktif müzik:** Derinlikle low-pass + enstrüman soyulması (yüzey: gitar+pad+perküsyon → 100m: gitar gider → 400m: sadece pad → 800m: pad + uzak balina). Yakalama fanfarı müziğin TONUNDA çalar (Fmaj oturumu — asla dissonans).
3. **Biyom sesleri:** Koy (dalga+martı+çan) · Göl (kurbağa+cırcır+su kuşu) · Mercan (cam çıtırtısı) · Batık (metal iniltisi, uzak) · Buzul (buz çatlaması) · Abis (10 sn'de bir tanımsız uzak ses — huşu).
4. **Haptic partitürü:** Her SFX'in eşi (yakalama: nadirlik kadar vuruş; makara: 8Hz mikro; perfect: çift tık). iOS CoreHaptics/Android VibrationEffect; ayarlardan şiddet.
5. **Kural (Master Book §11.4):** Sessiz de eksiksiz oynanır; sesle 2 kat iyidir.

---

# BÖLÜM 14 — MONETİZASYON (Etik; P2W Sıfır)

**Manifesto §8.3 aynen + eklemeler:**

| Ürün | Fiyat | İçerik | Neden çalışır |
|---|---|---|---|
| Starter Pack | $2.99 | 500💎 + özel olta skini + 10 premium yem | D1 ilk zorluk sonrası, tek sefer |
| Reklamsız+VIP | $7.99 tek | 0 interstitial + kalıcı %25 altın + VIP çerçeve | Kategorinin 1 numaralı şikâyet çözümü |
| Battle Pass | $4.99/sezon | Kozmetik hat + yem + 💎 | D3–D7 açılış, %22 IAP payı hedefi |
| Kaptan Kulübü | $4.99/ay | Reklamsız + günlük 100💎 + 2× offline | Whale değil DÜZENLİ oyuncu aboneliği |
| Kozmetik vitrini | $0.99–9.99 | Tekne boyaları, olta skinleri, şapkalar, kedi!, akvaryum dekoru | Kimlik ifadesi; ghost boat'ta GÖRÜNÜR (sosyal vitrin) |
| Elmas keseleri | $0.99–49.99 | Standart merdiven | — |

**Rewarded 5 placement:** Master Book §8.1 aynen (sandık / offline 2× / tekrar dene / yükseltme indirimi / çark). Tavan 8/oturum. IAP yapana 30 gün interstitial sıfır.
**Kırmızı çizgiler:** Enerji yok · gacha-dublikat yok · "son şans!" sayacı yok · ödeme duvarlı tür yok (TÜM balıklar oynayarak yakalanır).

---

# BÖLÜM 15 — 100 BAĞIMLILIK ÖZELLİĞİ (İlham → Bize Uyarlanmış)

**Stardew Valley (1–13):**
1. Gün ritmi: sabah görev panosu ritüeli · 2. NPC doğum günleri (hediye balık!) · 3. Mevsimlik tür rotasyonu · 4. Lokanta tarif koleksiyonu · 5. Köy geliştirme projeleri (ortak hedef) · 6. Yıllık festival takvimi · 7. Ustalaşınca eski bölge yeni katman açar (altın olta → eski koyda shiny şansı) · 8. Ev/kulübe dekorasyonu · 9. Sevilen NPC mektup yazar · 10. Kışın buz deliği avı · 11. Gizli orman spotu · 12. Emeklilik yok — büyükbaba mirası çerçevesi zaten var · 13. "Bugün ne yapsam" çok-hedefliliği.

**Dave the Diver (14–26):**
14. Boss'un 2 fazlı düellosu · 15. Avcının midesinden bonus av · 16. Lokantaya günlük teslimat siparişi · 17. VIP müşteri özel istekleri · 18. Gece avı ayrı tür seti · 19. Tuhaf NPC kadrosu (Rıfkı!) · 20. Ekipman deneme görevleri · 21. Balık boyu abartı anları (dev gölge → küçük balık çıkar, mizah) · 22. Sürpriz mini-etkinlik anları · 23. Fener yarıçapı mekaniği · 24. Kasa/anahtar cross-biome bulmacası · 25. Cutscene yerine 1 satır diyalog (hız!) · 26. Her gün kısa "haber" ekranı.

**Dredge (27–36):**
27. Sis içinde belirsiz siluetler (tehditsiz) · 28. Gece varyant balıklar (hafif tuhaf görünüm) · 29. Bölge söylentileri panosu · 30. Toplanabilir tuhaf objeler · 31. Karanlıkta müzik incelmesi · 32. "Bir şey gördüm" fotoğraf kanıtı mekaniği · 33. Derin çukur kenarında durma cesareti · 34. Eski haritalarda yanlış işaretler (keşifle düzeltilir) · 35. Işıklı yem gece ekonomisi · 36. Ada'nın yılda 4 geçişi.

**Animal Crossing (37–51):**
37. Gerçek saat/mevsim senkronu · 38. Müze boş vitrin suçluluğu · 39. Bağış = kalıcı statü · 40. Günlük kabuk toplama · 41. NPC'ler seni İSMİNLE anar · 42. Ziyaretçi karakterler (haftalık Rıfkı) · 43. Balık ölçüsü espirili yorumlar · 44. Hava durumuna özel diyalog · 45. Ghost boat selamlaşması · 46. Hediye paketleme kültürü · 47. Koleksiyon %'si profil rozeti · 48. Ayın balığı duyurusu · 49. Şafak/gece farklı müzik geçişi · 50. Ekran görüntüsü çerçeveleri · 51. Yıl özeti kartpostalı.

**Subnautica (52–61):**
52. Derinlik = huşu tasarımı · 53. Biyolüminesan gece bahçesi · 54. Uzak ses tasarımı (tanımsız çağrılar) · 55. İlk kez inilen bantta tek satır günlük kaydı · 56. Sonar yükseltmesi (tekne) · 57. Dev gölge geçişleri · 58. Su altı coğrafya adlandırma (oyuncu keşfeder, isim defterde) · 59. "Asla saldırmaz ama ürpertir" yaratık felsefesi · 60. Derinlik rekoru kişisel panosu · 61. Basınç YOK (itiraz: ölüm mekaniği huzuru öldürür — sadece görsel yoğunluk).

**Ridiculous Fishing (62–71):**
62. Perfect catch combo merdiveni · 63. Kanca yönlendirme akrobasisi · 64. Çıkışta balıkların havaya dizilişi · 65. Tek input çok derinlik felsefesi · 66. Absürt mizah dozu (nadir "çizme" yakalarsın → müzeye gider!) · 67. Sayaç coşkusu (perde merdiveni) · 68. Kısa tur garantisi · 69. Yem füzesi YOK (şiddet dışarıda) yerine "foto-turu" bonus halkaları · 70. Rekor kovalama HUD'u · 71. Tuhaf ekipman isimleri ("Dedenin İnadı" oltası).

**Spiritfarer (72–81):**
72. Eski balıkçı RUHU gece teknene biner, 1 hikâye anlatır, şafakta gider (ödül: defter sayfası) · 73. Sarılma değil "birlikte sessiz balık tutma" anı · 74. Veda sahneleri (Halil finali) · 75. Yemek/çay ikramı mini-ritüeli · 76. Müzikli yolculuk pasajları · 77. Duygusal yan görevler (Saliha'nın babasının oltası) · 78. Kayıp eşya iade döngüsü · 79. Mektup sistemi · 80. Anı fotoğraf albümü · 81. Hüzün DOZU: %10 (asla depresif değil, tatlı-buruk).

**Tiny Glade / Alto (82–91):**
82. İskele/kulübe serbest dekorasyonu (işlevsiz, salt zen) · 83. Dekorun köy NPC'lerince övülmesi · 84. Fener/çiçek yerleştirme · 85. Akşam ışığında otomatik "vista" kamerası · 86. Tek parmak akış modu ("Sonsuz Sürüş": sadece seyir + ambient, av yok — meditasyon modu!) · 87. Bulut/kuş paralaksı · 88. Fotoğrafın otomatik "günün karesi" seçimi · 89. Rüzgâr çıngırağı (dekor + ses) · 90. Sessiz başarımlar (aniden beliren huzur rozetleri) · 91. Ekran kapalı ambient modu (uyku sesi — App Store öne çıkarma hilesi, gerçek kullanım!).

**Bizim imzamız (92–100):**
92. Defterin son sayfasını OYUNCU doldurur · 93. Şamandıra derinlik işaretleri (mekânsal hedef dili) · 94. Pul teselli ekonomisi (kaçış = ilerleme) · 95. Frenzy kuş işareti · 96. Gerçek Türkiye denizleri tür bilgileri (yerel gurur + eğitim) · 97. Gece feneri balıkla güçlendirme · 98. "Filozof" tipi mizahi başarımlar · 99. Topluluk şifreli gizli balık avı · 100. Yıl sonu kişisel balıkçılık almanağı.

---

# BÖLÜM 16 — İLK 30 DAKİKA (Dakika Dakika FTUE)

| Dakika | Olay | Duygu | Ölçüm noktası |
|---|---|---|---|
| 0:00–0:20 | Logo yok ekranı yok → direkt şafakta koy, dalga sesi, TEK buton parlar | Huzur | `session_start` |
| 0:20–1:00 | İlk cast, 3 hamsi, havaya diziliş, coin şelalesi | "Anladım!" | `cast_1` funnel |
| 1:00–2:00 | Defter kartı: "Deftere yeni tür" ×2 + dede cümlesi | Merak | `tutorial_step` |
| 2:00–3:00 | İlk yükseltme (rozet parlar, tek dokunuş) + 2. cast | Güç | `upgrade_1` |
| 3:00–4:30 | **İlk nadir** (Lüfer, slow-mo + fanfar) — scripted spawn garantisi | "VAY!" | `first_rare` |
| 4:30–6:00 | Joystick açılır: "Şamandıraya kadar sür" (80m) — dünya BÜYÜKMÜŞ hissi | Keşif | `joystick_intro` |
| 6:00–8:00 | Derin suda cast; dip görünür; İzmarit kaçar (ürkek davranış tanıtımı) | Canlılık | — |
| 8:00–10:00 | Akvaryum tanıtımı: ilk balığı koy, altın damlamaya başlar | Sahiplenme | `aquarium_first` |
| 10:00–12:00 | İskeleye dönüş çağrısı: Cemil el sallar → köy vitrini (kapılar "yakında") | Vaat | — |
| 12:00–15:00 | Görev panosu: günlük 3 görev + İLK SANDIK (rewarded, ZORUNLU DEĞİL, hediye olarak da açılır ilk sefer!) | Cömertlik | `ad_opt_in` |
| 15:00–20:00 | Serbest av; feeding frenzy scripted (kuşlar!) | Coşku | `frenzy_1` |
| 20:00–25:00 | 2. şamandıra hedefi + Saliha'nın ilk söylentisi ("250'de kalkan görülmüş") | Hedef zinciri | — |
| 25:00–30:00 | Oturum kapanış kancası: akvaryum sayacı gösterilir + "yarın: göç haberi" | Dönüş sözü | `session_end` |

**Kural:** İlk 30 dk'da SIFIR zorunlu reklam, SIFIR IAP popup (starter pack D1 sonunda). FTUE atlanabilir (veteranlar için).

---

# BÖLÜM 17 — İLK 30 GÜN (Gün Gün)

| Gün | Oyuncu deneyimi | Sistem tetiği |
|---|---|---|
| D1 | 3 oturum: sabah keşif, akşam akvaryum toplama, gece ilk gece-balığı | Starter pack teklifi (1 kez) |
| D2 | Biyom 2 kapısı görünür; ilk boss SÖYLENTİSİ | Giriş takvimi gün 2 |
| D3 | İlk boss düellosu (kaçar → 3 pul) + BP tanıtımı | BP açılışı (D3–D7 kuralı) |
| D4–5 | Kanca/yem matrisi açılır; build ritüeli başlar | İlk haftalık mega görev |
| D6 | İlk shiny GÖRÜLÜR (yakalanamayabilir — konuşulur!) | `shiny_seen` |
| D7 | 7 gün rozeti: şapka + Biyom 2 açılışı kutlaması | D7 ölçümü (hedef ≥%20) |
| D8–10 | Müze açılır; ilk kanat bağışları; Rıfkı ilk ziyareti | Orta oyun ekonomi geçişi |
| D11–13 | İlk göç eventi; mağara keşfi | Haftalık leaderboard ilk katılım |
| D14 | Boss'a REVANŞ (pul birikti → çağırma yemi) → İLK EFSANE YAKALAMA | IAP dönüşüm penceresi (%2.5 hedef) |
| D15–20 | Biyom 3–4; Halil mektupları 2–3; skill tree ilk dal dolar | Sedef ekonomisi aktif |
| D21 | İlk sezonluk festival başlangıcı | Festival push (müjde tonu) |
| D22–27 | Koleksiyon kapanış hedefleri; ghost boat daveti (arkadaş kodu) | Viral döngü ölçümü |
| D28–29 | Biyom 5 kapısı; Buzul gizemi; "Ada" İLK GEÇİŞİ (scripted, gece) | Topluluk anı |
| D30 | Yıldönümü değil "AY DÖNÜMÜ" kartı: kişisel istatistik + prestige vitrini ("Yelken hazır olduğunda...") | D30 ölçümü (hedef ≥%10) |

---

# BÖLÜM 18 — FİNAL: PUANLAMA, YOL HARİTASI, YARATICI DİREKTÖR İNCELEMESİ

## 18.1 Fikir puanlama matrisi (1–5; Maliyet: düşük=iyi)

| Fikir | Maliyet | RET | MON | MUT | Karar |
|---|---|---|---|---|---|
| Perfect catch + combo | 2 | 4 | 3 | 5 | **VS** |
| Joystick + mekânsal derinlik | 2 | 4 | 3 | 4 | **✅ v0.3'te canlı** |
| Feeding frenzy | 2 | 4 | 3 | 5 | **VS** |
| Davranış sözlüğü (10 davranış) | 3 | 5 | 3 | 5 | **VS→GL kademeli** |
| Akvaryum + offline | 3 | 5 | 4 | 4 | **SL** (Master Book) |
| Sat/akvaryum karar ekranı | 1 | 4 | 3 | 4 | **SL** |
| Boss düellosu (pul sistemi) | 3 | 5 | 3 | 5 | **GL** |
| Köy + 6 NPC | 4 | 5 | 3 | 5 | **VS iskele, GL köy** |
| Müze | 3 | 5 | 3 | 5 | **GL** |
| Defter hikâyesi + keşif kartı | 1 | 4 | 2 | 5 | **✅ v0.2'de canlı** |
| Shiny varyantlar | 1 | 5 | 3 | 5 | **SL** (ucuz, etkisi dev) |
| Gerçek mevsim/dolunay senkronu | 2 | 5 | 2 | 5 | **GL** |
| Battle Pass | 3 | 4 | 5 | 3 | **GL** (D3–D7) |
| Ghost boats | 3 | 4 | 3 | 5 | **L+** |
| Ekipman matrisi (kanca/yem) | 3 | 4 | 4 | 4 | **SL yem, GL tam** |
| Skill tree | 3 | 3 | 2 | 4 | **GL** |
| Hava sistemi (yağmur/fırtına/sis) | 4 | 4 | 3 | 5 | **GL kademeli** |
| Mağaralar + fener mekaniği | 3 | 3 | 2 | 5 | **GL** |
| Crew/pet | 3 | 3 | 4 | 5 | **L+** |
| Prestige | 3 | 5 | 3 | 3 | **L+** (mimari GL'de hazır) |
| Sonsuz Sürüş meditasyon modu | 1 | 3 | 2 | 5 | **GL** (ucuz, PR değeri yüksek) |
| Ruh ziyaretçileri (Spiritfarer) | 2 | 3 | 2 | 5 | **L+** |
| 13 biyom | 5 | 4 | 4 | 4 | **6'sı GL, kalanı L+ takvimi** |
| 9 dil day-one | 4 | 3 | 4 | 3 | **İTİRAZ → aşağıda** |
| Misina kopması | 1 | **−3** | 1 | **−4** | **RED** (§4.3) |
| Yakıt sistemi (tekne) | 2 | −1 | 2 | −3 | **RED — enerji sisteminin kılık değiştirmişi!** |

## 18.2 Yol haritası (Üretim Süreci fazlarına bağlı)

```
ŞİMDİ (HTML prototip): v0.3 canlı → KAPI 1 testi: 10 kişi × 20 dk
  ├─ Test SORUSU: "Yarın tekrar açar mıydın?" ≥%60 → devam
  ▼
VERTICAL SLICE (Unity 6 URP'ye geçiş, 6 hafta):
  Biyom 1 final sanat + perfect catch + frenzy + davranış sözlüğü (5 davranış)
  + akvaryum + karar ekranı + iskele + FTUE ilk 15 dk + GameAnalytics
  ▼
META BUILD (8 hafta): Biyom 2–3 + görevler + yem/kanca + shiny + mediation
  + IAP + remote config + TR/EN lokalizasyon
  ▼
SOFT LAUNCH (6 hafta, TR+PH+BR): KPI kapıları Master Book §9.1 AYNEN
  ▼
GLOBAL (v1.0): 6 biyom + köy + müze + boss + BP + hava + 9 DİL BURADA
  ▼
LIVEOPS: §11 takvimi
```

## 18.3 TEKNİK DİREKTÖR İTİRAZLARI (net ve gerekçeli)

1. **Misina kopması / dayanıklılık → RED.** Kayıp cezası churn üretir. Yerine: sıyrılma + pul teselli (§4.3). Aynı gerilim, sıfır öfke.
2. **Yakıt/depo sistemi → RED.** "Yakıt bitti, bekle" = enerji sistemi = Master Book §7.1'in açıkça yasakladığı şey. Tekne İSTATİSTİĞİ hız/sonar/görüş olsun, sınırlayıcı değil.
3. **9 dil day-one → ERTELE.** Lokalizasyon ALTYAPISI (string tablosu, hardcoded sıfır) day-one ✓ ama 9 dilin ÇEVİRİ+QA maliyeti soft launch öncesi israf. TR+EN soft launch → 9 dil global'de. (JP/KR/CN kültürel QA ister; aceleye gelirse zarar verir.)
4. **13 biyom → 6+7.** Day-one 13 biyom = 18 ay gecikme. 6 lansman + ayda ~1 LiveOps biyomu = aynı içerik, gelir üretirken inşa edilir.
5. **"Gerçekçi" (Fishing Planet tarzı) → HAYIR, "inandırıcı" → EVET.** Simülasyon derinliği casual kitleyi kaçırır (Master Book rakip analizi: Fishing Clash dersi). Gerçek türler + gerçek davranış HİSSİ yeter.
6. **Göl başlangıcı → değiştirilmiş kabul** (§5.1): Koy kalır, göl duygusu giydirilir; Dağ Gölü L+.
7. **Unity kodu ŞİMDİ yazılmaz.** KAPI 1 geçilmeden Unity'ye taşınmaz (Üretim Süreci Kapı kuralı). Prototip HTML'de kalır çünkü test edilebilir tek şey odur. Unity mimarisi (SOLID, SO, EventBus, State Machine, Object Pool, Addressables, Save, Localization) VS başında kurulur — iskelet şeması hazır (§12 performans + aşağıdaki modül planı).

**Unity modül iskeleti (VS ilk haftası):**
`Core/` EventBus (struct, GC-free) · StateMachine (generic) · SaveService (JSON+şifre, ISaveable) · LocalizationService (tablo, TMP)
`Data/` ScriptableObject: FishDef, RodDef, BiomeDef, QuestDef (CSV importer — tasarımcı Sheets'ten basar)
`Gameplay/` CastController · HookSteering · FishBrain (davranış = strateji deseni) · SpawnDirector (LOD)
`Meta/` Economy (source/sink logger) · Aquarium · Codex · QuestRunner
`Services/` Analytics (GameAnalytics) · Ads (MAX sarmalayıcı) · IAP · RemoteConfig (tüm eğri katsayıları buradan!)

## 18.4 "BİR BALIK DAHA" KONTROL LİSTESİ (her build buna vurulur)

- [ ] Ortalama cast süresi 18–40 sn mi?
- [ ] Her cast en az 1 sayaç ilerletti mi? (altın/görev/mastery/defter)
- [ ] Şu an ekranda ≥3 yarım hedef var mı? (görev %2/3 · şamandıraya 40m · defter 11/12...)
- [ ] Son 5 dk'da 1 "az kalmıştı" anı yaşandı mı? (near-miss oranı: cast başına %15–25, remote config)
- [ ] Son 10 dk'da 1 sürpriz oldu mu? (frenzy/meraklı balık/söylenti/shiny görme)
- [ ] Oturum kapanırken dönüş sözü verildi mi? (sayaç/göç/festival)
- [ ] Oyuncu HİÇBİR ekranda bekletildi mi? (bekletme = tasarım hatası)

## 18.5 Zayıf nokta avı (kendi tasarımıma acımasız bakış)

| Zayıflık | Risk | Değişiklik |
|---|---|---|
| Boss düellosu ritmi sıkıcı olabilir | Orta | Her boss'a 1 kişilik cümlesi (Fettah kancayı kayaya dolar → oyuncu yön değiştirir) — mekanik değil KARAKTER çeşitliliği |
| Seyir süresi ölü zaman | Yüksek | Seyirde toplanabilirler (yüzen kabuk/şişe) + frenzy görme şansı; hız yükseltmesi erken ucuz |
| Görev listesi "angarya" hissi | Orta | Görevler HEP oynarken kendiliğinden dolan türden ("5 balık tut" ✓, "X'e git ve bekle" ✗) |
| Müze bağışı gelir kaybı hissettirir | Düşük | Bağış anında sedef + kanat bonusu görünür; "kayıp" değil "yatırım" çerçevesi |
| Perfect catch casual'ı ezebilir | Orta | Perfect hiç yapılmasa da ilerleme aynı; sadece ÜSTÜNE koyar. HUD'da başarısızlık göstergesi YOK |
| Derinlik karanlığı bunaltabilir | Düşük | 800m+ biyolüminesans yoğunluğu artar — karanlık "boş" değil "yıldızlı gece" okunur |

---

## KAPANIŞ — Tek Kural

> Bu dokümandaki her şey, Master Book'un son sözüne tabidir:
> **"Meta, bozuk bir core loop'u kurtaramaz."**
> KAPI 1 (%60 "yarın açarım") geçilmeden bu dokümanın 2. bölümünden sonrası SATIN ALINMAMIŞ HAYALDİR.
> Önce 10 kişi, 20 dakika, tek soru. Sonra bu kitabın tamamı.
