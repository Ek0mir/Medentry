# 🎣 Sakin Koy — Balık Tutma Oyunu · v0.4 Greybox Prototip

## v0.4 farkları — Animasyonlu Balıkçı + Fırlatma Fiziği
- **İskeletsel balıkçı rig'i** (procedural, ileri kinematik). Pose parametreleri
  hedefe yumuşak blend edilir → animasyonlar arası geçiş yumuşak. Katmanlar:
  - Idle: nefes alma, teknenin salınımına kısmi uyum, başını sağa-sola çevirme, oltayı elde sallama, rüzgârda mont/etek dalgalanması
  - Yakalama: heyecan darbesi (nadirlikle artar), geriye yaslanma, makara çevirme (el orbit), omuz/gövde hareketi, misina gerilmesi, **büyük balıkta titreme + derin yaslanma + yavaş makara**
- **Fırlatma fiziği** ("aşağı bırakma" kaldırıldı): windup (geri al) → savurma →
  şamandıra **havada mermi yayı** çizer (yerçekimi + rüzgâr) → suya düşer →
  sıçrama efekti → misina gerilir → drop (bekleme/iniş). Şamandıra rod ucundan
  fırlatılır; misina rod ucundan takip eder. Kanca suya düştüğü yerden iner.
- Yeni sesler: yay gerilme, kol savurma (whip), suya düşüş (splash).

## v0.3 farkları — Joystick + Mekânsal Dünya
- **Joystick ile tekne sürme** (sol başparmak; klavyede ←/→ veya A/D). İki parmak
  aynı anda çalışır: sol el tekne, sağ el kanca (pointerId ile ayrışır).
- **Yatay dünya (4600px):** solda iskele + "SAKİN KOY" tabelası; sağa açıldıkça
  **dip derinleşir** (26m → ~1100m). Şamandıralar 80/250/600/1000m'yi işaretler.
- **Hareketin amacı var:** nadir tür = uzağa git + uzun misina. Balıklar yerel dip
  derinliğine göre doğar; kanca dibe çarpınca kum bulutu + otomatik sarma.
- **Yükseltmeler alt-sheet'e taşındı** (⬆️ YÜKSELT butonu; alınabilir yükseltme
  varken turuncu rozet). HUD minimalizmi (§11.2) korunur.
- Tekne fiziği: ivme/sürtünme, hızla yatma (tilt), köpük izi partikülleri.

## v0.2 farkları
- **Farklılaştırılmış balıklar:** 11 ayrı silüet (sprat, çipura, ton, orfoz,
  kalkan, vatoz, fener, ay balığı…) — Art Bible kuralı "siluetten tanınmalı" (§11.3)
- **Hikaye katmanı:** dedenin teknesi + yarısı boş balık defteri anlatısı; her tür
  için gerçek bilgi (`fact_tr`, §10.1). Kitap'ı duygusal olarak motive eder → "yaşayan
  meta" farklılaşma sütunu (§3.2)
- **Keşif kartı:** yeni tür yakalanınca isim + ★ + nadirlik + gerçek bilgi + defter sayacı
- **Geliştirilmiş balıkçı:** sırtı dönük, kasketli, teknede oturan; sarmada geriye yaslanır


Master Book & Blueprint dokümanlarının **FAZ 1 prototipi**. Amaç tek şey: core loop
("oltayı atmak") tek başına, sanat olmadan eğlenceli mi? (Üretim Süreci — KAPI 1)

## Ne var
- **Core loop:** AT → kancayı sürükle → balığa değ → SAR → sat → altın (§5.1)
- **Veri-güdümlü balıklar:** 15 tür, derinlik bandı + nadirlik (1–5★) ile spawn (§10.1)
- **Ekonomi formülleri birebir uygulandı** (§7.2):
  - Değer = taban × boyut(0.8–1.6) × nadirlik(1/1.8/3.2/6/12)
  - Yükseltme maliyeti = taban × büyümeOranı^seviye
- **4 yükseltme hattı:** Misina Derinliği, Kanca Kapasitesi, Makara Hızı, Şanslı Yem
- **Progression hook'u:** derine indikçe daha nadir balık → daha çok altın → daha derin
- **Juice (§11.2):** ekran sarsıntısı, partiküller, nadir balıkta slow-motion + flash,
  altın count-up, yükselen değer yazıları, prosedürel ses (asset yok)
- **Kitap (Fishdex) sayacı** + yerel kayıt (localStorage)

## Ne YOK (bilerek — kapsam disiplini §6)
Akvaryum/idle gelir · sat-mı-akvaryum-mu karar ekranı · gerçek sanat · menüler ·
reklam/IAP · bölge geçişi · günlük görev. Bunlar v0.9+ (Vertical Slice / Meta Build).

## Çalıştırma
`prototype/index.html` dosyasını herhangi bir tarayıcıda aç. Kurulum yok, bağımlılık yok,
tek dosya. Mobil + masaüstü. Ses için ekrana bir kez dokun (tarayıcı autoplay kuralı).

## KAPI 1 test protokolü (Üretim Süreci FAZ 1)
10 kişi × 20 dk, sessizce izle, sonra tek soru: **"Yarın tekrar açar mıydın?"**
→ %60+ "evet" değilse core loop'u değiştir; meta ile örtmeye çalışma.

## Teknik not
Doküman Unity 6 öneriyor (SDK ekosistemi için doğru karar). Bu prototip bilerek
**HTML5 canvas** — çünkü prototip fazının tek amacı *his testi* ve bunun için oyunun
anında paylaşılabilir bir linkle 10 kişinin telefonunda açılması gerekir. Kanca
"his"i (§ hız eğrisi) burada ayarlanıp doğrulandıktan sonra Unity'ye taşınabilir.
