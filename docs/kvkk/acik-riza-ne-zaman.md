# Açık Rıza mı, Meşru Menfaat mi?

Bu not, "çalışandan imza alalım, iş biter" yanılgısını önlemek için yazılmıştır.

## 1. Çalışandan alınan rıza neden yeterli değil?

KVKK m.3'e göre açık rıza **"özgür iradeyle açıklanan"** olmalıdır. İş
ilişkisinde çalışan ile işveren arasında **bağımlılık ilişkisi** vardır:
çalışan "hayır" derse işini kaybedeceğini düşünür. Kurul bu nedenle iş
ilişkisinde alınan rızayı kural olarak geçerli saymamaktadır.

Sonuç:

- Rızaya dayandırılan bir izleme, rıza geçersiz sayıldığında **hukuki dayanaksız**
  kalır → tüm işleme hukuka aykırı hâle gelir.
- Çalışan rızasını **her zaman geri alabilir**; geri aldığında sistemi kapatmanız
  gerekir. Filonun yarısında takip çalışıp yarısında çalışmaması işletilebilir
  değildir.

## 2. Doğru yaklaşım

| Veri | Dayanak | Neden |
|------|---------|-------|
| Konum, kontak, çalışma saati | m.5/2-ç (sözleşmenin ifası) + m.5/2-f (meşru menfaat) | Ücret/hakediş hesabı ve iş organizasyonu için zorunlu |
| Dış kamera | m.5/2-f + 6331 s.K. m.4 | İSG yükümlülüğü |
| Kabin kamerası (olay bazlı) | m.5/2-f + ölçülülük testi | Kaza incelemesi |
| Hakediş/fatura | m.5/2-a (kanunda öngörülme: VUK/TTK) | Yasal saklama |

**Rıza alınmaz; aydınlatma yapılır.** Aydınlatma yükümlülüğü (m.10) rızadan
bağımsızdır ve her hâlükârda zorunludur.

## 3. Açık rızanın gerektiği istisnai hâller

| Durum | Neden rıza gerekir |
|-------|--------------------|
| Aracın **özel kullanımda** konumunun izlenmesi | İş amacı dışında; meşru menfaat kalmaz. Çözüm: rıza yerine **mahremiyet penceresi** kurup hiç izlememek daha güvenlidir |
| Görüntünün **tanıtım/eğitim** amacıyla kullanılması | Orijinal amaç dışı |
| **Biyometrik** veri (yüz tanıma ile operatör kimliği) | Özel nitelikli veri — m.6; güvenli alternatif: iButton/kart |
| Görüntünün **müşteriyle** paylaşılması | Aktarım; sözleşmesel zorunluluk yoksa rıza gerekir |

Bu sistemde yukarıdakilerin hiçbiri varsayılan olarak **yapılmamaktadır**.

## 4. Sistemdeki karşılığı

`notice_acknowledgements` tablosunda iki tür kayıt tutulur:

- `kind = 'ack'` → **aydınlatma teyidi**. Zorunludur; geri alınamaz (bir metni
  okuduğunuz gerçeği geri alınamaz).
- `kind = 'consent'` → **açık rıza**. Yalnızca yukarıdaki istisnai hâller için
  kullanılır ve **her zaman geri alınabilir** (`/api/kvkk/notices/:id/withdraw`).

Rıza geri alındığında sistem, rızaya dayalı işlemeyi durdurur; meşru menfaate
dayalı konum ve çalışma saati kaydı devam eder ve bu durum kullanıcıya açıkça
bildirilir.

## 5. Pratik kural

> Bir özelliği kurarken kendinize sorun: **"Çalışan 'hayır' derse bu özelliği
> kapatabilir miyim?"**
> - Cevap "hayır, işletme duramaz" ise → rızaya dayandırmayın, meşru menfaat +
>   ölçülülük ile kurgulayın.
> - Cevap "evet, kapatabilirim" ise → gerçekten rıza alın ve geri alınabilir
>   yapın.
