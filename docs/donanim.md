# Donanım Seçimi ve Montaj

Bu belge, sahada hangi cihazın ne işe yaradığını ve nasıl kurulacağını anlatır.
Yazılım cihaz bağımsızdır; ancak **hangi veriyi alabildiğiniz cihaza bağlıdır**.

---

## 1. Karar tablosu

| İhtiyaç | Cihaz sınıfı | Neden |
|---------|--------------|-------|
| İş makinesinde **gerçek çalışma saati** | GPS tracker + **CAN adaptörü** | İş makinesinde hız sıfırdır; çalışma ile rölantiyi ancak motor devri ayırır |
| CAN yoksa iş makinesi | GPS tracker + **titreşim/hareket sensörü** | Yaklaşık ayrım; hakedişte itiraz riski daha yüksek |
| Kamyon / pickup | Ekonomik GPS tracker | Hız tabanlı rölanti yeterli |
| Kamera + SD kayıt + 4G canlı izleme | **4G MDVR** (JT/T 808 + 1078) | SD karta döngüsel kayıt, 4G üzerinden yayın ve geri oynatma |
| Yakıt seviyesi | CAN'dan (varsa) veya **kapasitif yakıt sondası** | Şamandıra verisi gürültülüdür; sonda daha doğrudur |

## 2. Önerilen kurulum (bu projedeki demo yapılandırması)

### 2.1 İş makinesi (ekskavatör)

| Bileşen | Örnek | Bağlantı |
|---------|-------|----------|
| Takip cihazı | Teltonika FMB640 / FMC650 | Akü (+12/24V), kontak sinyali, CAN adaptörü |
| CAN adaptörü | LV‑CAN200 / ALL‑CAN300 | Makinenin CAN hattı |
| MDVR | 4 kanal 4G MDVR, SD/HDD yuvalı | Akü, 4G SIM, kameralar |
| Kamera 1 | **Kabin içi** | MDVR kanal 1 |
| Kamera 2 | Ön (çalışma sahası) | MDVR kanal 2 |
| Kamera 3 | Arka (manevra) | MDVR kanal 3 |
| Kamera 4 | Bom / kova | MDVR kanal 4 |

CAN'dan okunan veriler (doğrulanması gereken AVL ID'leriyle):

| Veri | Tipik AVL ID | Yazılımdaki alan |
|------|--------------|------------------|
| Kontak | 239 | `ignition` |
| Hareket | 240 | `movement` |
| Motor devri | 85 | `engineRpm` |
| Motor çalışma süresi | 102 (dakika) | `engineHoursSec` |
| Yakıt seviyesi (%) | 89 | `fuelLevelPct` |
| Yakıt seviyesi (lt) | 84 | `fuelLevelLiters` |
| Toplam yakıt tüketimi | 83 | `fuelUsedLiters` |
| Harici voltaj | 66 (mV) | `externalV` |
| Toplam kilometre | 16 (m) | `odometerM` |

> ⚠️ **AVL ID'ler firmware ve makine profiline göre değişir.** Devreye almada
> cihazın kendi AVL ID dokümanıyla doğrulayın. Yazılımda eşleme değiştirilebilir:
> `createTeltonikaDecoder({ ioMap: { 48: { field: 'fuelLevelPct' } } })`.

### 2.2 Operatör aracı (pickup)

| Bileşen | Bağlantı |
|---------|----------|
| GPS tracker (GT06N sınıfı) | Akü + kontak (ACC) kablosu |
| 2 kanal 4G MDVR | Ön kamera + kabin içi (isteğe bağlı) |

**Kontak kablosu şart.** Kontak bağlanmazsa çalışma saati harici voltaj/hareketten
tahmin edilir; hakediş için yeterince güvenilir değildir.

### 2.3 SIM ve veri planı

| Kalem | Öneri |
|-------|-------|
| Tracker veri tüketimi | ~20–60 MB/ay |
| MDVR (yalnızca kayıt + olay klibi) | ~150–400 MB/ay |
| MDVR (günde 10 dk canlı izleme, alt akış) | ~1.5–3 GB/ay |
| SIM tipi | M2M/IoT SIM, statik APN; sabit IP gerekmez (cihaz sunucuya bağlanır) |
| Öneri | Canlı izlemeyi **alt akış** (sub-stream) ile yapın: aynı görüntü ~4× daha az veri |

## 3. Kamera montajı ve açılar

KVKK açısından açılar **teknik değil hukuki** bir karardır. Ayrıntı:
[`kvkk/kamera-politikasi.md`](kvkk/kamera-politikasi.md).

| Kamera | Doğru açı | Yanlış açı |
|--------|-----------|------------|
| Kabin içi | Operatör koltuğu + ön cam görüş alanı | Telefon ekranı, kişisel eşya bölmesi, dinlenme alanı |
| Ön | Yol / çalışma sahası | Komşu parsel, konut pencereleri |
| Arka | Manevra alanı, yaya geçişi | Sokak genel gözetimi |
| Bom | Kova ve çalışma alanı | — |

**Montaj kuralları**

1. Kameralar **görünür** olacak, gizlenmeyecek.
2. Kabin içine ve araç dışına **bilgilendirme etiketi** yapıştırılacak.
3. Açı ayarı **operatör huzurunda** yapılacak ve tutanakla imzalanacak.
4. **Mikrofon devre dışı** bırakılacak (yazılım da ses için gerekçe ister).
5. Kabin kamerası yazılımda `position: 'cabin'` olarak tanımlanacak — bu, canlı
   izlemeyi otomatik olarak kapatır ve olay şartını devreye sokar.

## 4. Cihazın sisteme tanıtılması

```bash
# 1) Cihazı sunucuya yönlendirin (cihazın SMS/konfig aracıyla):
#    IP: <sunucu-ip>   PORT: 5027 (Teltonika) / 5023 (GT06) / 7611 (JT808)

# 2) Cihazı platforma kaydedin
curl -X POST http://localhost:8080/api/devices \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"assetId":"<varlik-id>","kind":"tracker","protocol":"teltonika",
       "ident":"356307042441013","simMsisdn":"+90532...","model":"FMB640"}'

# 3) Kameraları tanımlayın (kabin otomatik olarak yüksek mahremiyet sınıfına girer)
curl -X POST http://localhost:8080/api/devices/<device-id>/cameras \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"channelNo":1,"position":"cabin","label":"Kabin ici"}'
```

Tanımsız bir cihazdan veri gelirse sistem onu `unknown_devices` tablosuna yazar —
sahada yanlış IMEI girişini böyle yakalarsınız:

```sql
SELECT ident, protocol, hit_count, last_seen_at FROM unknown_devices ORDER BY last_seen_at DESC;
```

## 5. Devreye alma kontrol listesi

Her makine için:

- [ ] Kontak kablosu bağlandı, kontak açık/kapalı durumu doğru okunuyor
- [ ] CAN adaptörü takıldı, motor devri makul değer üretiyor (rölanti ~700–900)
- [ ] Motor saati cihazdan okunuyor ve makinenin saat göstergesiyle karşılaştırıldı
- [ ] `hour_meter_offset_sec` ile makinenin mevcut saati sisteme girildi
- [ ] Yakıt seviyesi %0–100 aralığında makul değer veriyor
- [ ] Depo hacmi (`fuelTankLiters`) sisteme girildi
- [ ] Kamera açıları operatör huzurunda ayarlandı, tutanak imzalandı
- [ ] Bilgilendirme etiketleri yapıştırıldı
- [ ] SD kart takılı, kayıt yapıyor, kapasite yeterli (≥ 128 GB / kanal başına ~1 hafta)
- [ ] Canlı yayın telefonda denendi (alt akış)
- [ ] Olay klibi denendi (sert fren simülasyonu)
- [ ] Şantiye geofence'i tanımlandı
- [ ] Operatör vardiya ataması yapıldı
- [ ] Operatör aydınlatma metnini teyit etti
- [ ] Tarife kartı atandı ve bir günlük hakediş kontrol edildi

## 6. Sık karşılaşılan sorunlar

| Belirti | Olası neden | Çözüm |
|---------|-------------|-------|
| Çalışma saati olması gerekenden fazla | Kontak kablosu sürekli akım alan hatta bağlı | Kontak hattına taşıyın; geçici olarak `idle_strategy: 'rpm'` |
| Ekskavatör "rölantide" görünüyor ama çalışıyor | Hız tabanlı rölanti stratejisi | `idle_strategy` = `rpm` (CAN varsa) veya `movement` |
| Duran makinede kilometre artıyor | GPS sapması | Yazılım çapa yöntemiyle eler; sapma 15 m'yi aşıyorsa anten konumunu değiştirin |
| Yakıt grafiği zıplıyor | Şamandıra gürültüsü | Kapasitif sonda; yazılımın medyan filtresi zaten uygular |
| Gece kayıt yok | MDVR kontakla birlikte kapanıyor | Sürekli besleme + düşük güç modu; akü koruma eşiğini ayarlayın |
| Canlı izleme açılmıyor | Cihaz çevrimdışı veya komut kanalı kapalı | `GET :8081/health` ile bağlı cihazları kontrol edin |
| JT808 zaman damgası 3 saat kaymış | Cihaz UTC+8 fabrika ayarında | `devices.utc_offset_minutes` alanını ayarlayın (480) |
