# 🎣 Sakin Koy — Balık Tutma Oyunu · v0.1 Greybox Prototip

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
