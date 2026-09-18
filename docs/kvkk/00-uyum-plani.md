# KVKK ve İş Hukuku Uyum Planı

> **Uyarı:** Bu klasördeki belgeler, sistemin teknik tasarımıyla tutarlı **taslak
> şablonlardır**. Hukuki görüş değildir. Yayımlamadan önce şirketin avukatı ve/veya
> KVKK danışmanı tarafından gözden geçirilmeli, şirketin gerçek unvanı, adresi,
> VERBİS bilgileri ve süreçleri ile doldurulmalıdır.

Araç ve iş makinesi takibi, çalışanın konumunu, çalışma saatini ve görüntüsünü
işlediği için **kişisel veri işleme faaliyetidir**. Makineyi izliyor gibi görünse
de, makineyi kullanan kişiyi izlemiş olursunuz. Bu nedenle sistemin teknik
kurulumu ile hukuki kurulumu **aynı anda** yapılmalıdır.

## Temel ilke: gizli izleme yok

Kurul kararları ve Yargıtay içtihadı istikrarlı biçimde şunu söyler: çalışanın
bilgisi dışında yapılan izleme hukuka aykırıdır ve bu yolla elde edilen kayıt
delil olarak kullanılamaz — hatta işveren aleyhine sonuç doğurur. Bu sistem
bilerek şu şekilde kurgulanmıştır:

- Kameralar **görünür** şekilde monte edilir, araç içine ve dışına **bilgilendirme
  etiketi** yapıştırılır.
- Personel, işe başlamadan önce **aydınlatma metnini okur ve teyit eder**.
  Teyit kaydı yoksa yazılım kamera görüntüsüne erişimi **reddeder**
  (`NOTICE_NOT_ACKNOWLEDGED`).
- Her görüntüleme **denetim kaydına** yazılır ve ilgili operatöre **bildirim**
  düşer ("görüntünüz şu kişi tarafından şu gerekçeyle izlendi").
- Kabin içi kamera **canlı izlenemez**; yalnızca kaza/sert fren/alarm gibi bir
  **olaya bağlı**, olay anının ±30 saniyesi kadar kayıt açılabilir.
- Mola ve vardiya dışı saatlerde kamera erişimi **kapalıdır**.

## Devreye almadan önce tamamlanacaklar

| # | Adım | Sorumlu | Belge |
|---|------|---------|-------|
| 1 | Veri sorumlusu bilgilerinin doldurulması, VERBİS kaydının güncellenmesi | KVKK irtibat kişisi | `isleme-envanteri.md` |
| 2 | Kamera ve konum aydınlatma metinlerinin onaylanması | Avukat + İK | `aydinlatma-kamera.md`, `aydinlatma-konum.md` |
| 3 | Kamera politikasının kabulü (açı, ses, saklama) | Yönetim | `kamera-politikasi.md` |
| 4 | Kabin kamerası için etki değerlendirmesi | KVKK irtibat kişisi | `etki-degerlendirmesi.md` |
| 5 | Personel bilgilendirme toplantısı + ıslak imzalı tutanak | İK | `personel-bilgilendirme-tutanagi.md` |
| 6 | İş sözleşmesi / yönetmelik ekinin tebliği | İK | `is-sozlesmesi-eki.md` |
| 7 | Araçlara bilgilendirme etiketlerinin yapıştırılması | Saha | `kamera-politikasi.md` §5 |
| 8 | Saklama ve imha politikasının sisteme girilmesi | KVKK irtibat kişisi | `saklama-imha-politikasi.md` |
| 9 | Yazılımda rol atamaları ve mahremiyet pencerelerinin tanımlanması | Yönetici | — |
| 10 | Başvuru kanalının (e-posta/KEP) açılması ve duyurulması | KVKK irtibat kişisi | `ilgili-kisi-basvuru-formu.md` |

**5. adım tamamlanmadan kamera sistemi kayda alınmamalıdır.** Yazılım bunu
teknik olarak da zorlar: teyit kaydı olmayan operatörün aracında kamera erişimi
reddedilir.

## Hangi veri, hangi hukuki sebeple?

| Veri | Amaç | KVKK m.5 dayanağı | Açık rıza gerekir mi? |
|------|------|-------------------|----------------------|
| Konum (mesai içi) | Operasyon yönetimi, hakediş | m.5/2-c sözleşmenin ifası, m.5/2-f meşru menfaat | Hayır |
| Kontak / çalışma saati | Puantaj, hakediş, bakım | m.5/2-c, m.5/2-a (VUK kayıt düzeni) | Hayır |
| Dışa bakan kamera | İş güvenliği, kaza incelemesi, varlık güvenliği | m.5/2-f, 6331 s.K. m.4 | Hayır |
| Kabin içi kamera (olay bazlı) | İş güvenliği, kaza incelemesi | m.5/2-f + ölçülülük testi | Hayır — ancak ölçülülük şart |
| Yakıt verisi | Maliyet, hırsızlık tespiti | m.5/2-f | Hayır |
| Ses kaydı | — | — | **Kullanılmıyor** (ölçülülük) |
| Mesai dışı konum | — | — | **İşlenmiyor** (mahremiyet penceresi) |

> **Neden açık rıza değil?** İş ilişkisinde çalışan ile işveren arasında
> bağımlılık vardır; Kurul, çalışandan alınan rızayı "özgür iradeyle verilmiş"
> saymamaktadır. Bu nedenle sistem rızaya değil, **meşru menfaat ve iş güvenliği
> yükümlülüğüne** dayandırılmıştır. Rıza alınması gerekmez; **aydınlatma yapılması
> zorunludur.** Ayrıntı: `acik-riza-ne-zaman.md`.

## Ölçülülük testi (her kamera için tekrarlanır)

1. **Amaç meşru mu?** (iş güvenliği, kaza incelemesi → evet)
2. **Bu veri amaç için elverişli mi?** (kabin görüntüsü kaza anını aydınlatır → evet)
3. **Daha az müdahaleci bir yol var mı?** (sürekli izleme yerine **olay bazlı kayıt**
   → evet, bu yüzden kabin kamerası olay bazlıdır)
4. **Çalışanın mahremiyeti ile işverenin menfaati dengeli mi?**
   (mola/vardiya dışı karartma, ses kapalı, canlı izleme yok → dengelenmiştir)

Bu testin sonucu `etki-degerlendirmesi.md` belgesinde kayıt altındadır.

## Yazılımın uyguladığı teknik kısıtlar

Bu kurallar belge değil, **çalışan koddur** (`packages/domain/src/privacy.ts`):

| Kural | Kod karşılığı |
|-------|---------------|
| Amaçla sınırlılık | `PURPOSE_DATA_MATRIX` — hakediş amacıyla kamera açılamaz |
| Kabin canlı izleme yasağı | `CABIN_LIVE_FORBIDDEN` |
| Kabin için olay şartı | `CABIN_EVENT_REQUIRED` |
| Aydınlatma teyidi şartı | `NOTICE_NOT_ACKNOWLEDGED` |
| Gerekçe zorunluluğu | `REASON_REQUIRED` (en az 15 karakter) |
| Mola / vardiya dışı karartma | `PRIVACY_WINDOW` |
| Ses kapalı | `no_audio` yükümlülüğü |
| Operatöre bildirim | `notify_operator` yükümlülüğü |
| Saklama süresi | `DEFAULT_RETENTION_DAYS` + gece çalışan imha işi |
| Mahremiyet bölgesi (ör. ev adresi) | `privacy_zone` geofence — konum hiç gönderilmez |

## Denetim ve hesap verebilirlik

- **Denetim kaydı** (`data_access_log`): izin verilen *ve reddedilen* her erişim.
- **İzleme oturumları** (`media_sessions`): kim, hangi kamerayı, ne kadar süre,
  hangi gerekçeyle izledi.
- **Uyum panosu** (`GET /api/kvkk/compliance`): teyit oranı, ses kaydı açık kamera
  sayısı, imha bekleyen kayıt, süresi geçen başvuru.
- **İlgili kişi hakkı** (`GET /api/kvkk/my-access-log`): operatör kendi verisine
  kimin eriştiğini uygulamadan görür. Bu, m.11 hakkının fiilen kullanılmasıdır.

## Sık yapılan hatalar (kaçınılacaklar)

- ❌ Kamerayı "denemek için" bilgilendirme yapmadan açmak.
- ❌ Kabin kamerasını gün boyu canlı izlemek.
- ❌ Ses kaydı açmak (Kurul ses kaydını ölçüsüz bulmaktadır).
- ❌ Mesai dışında ve hafta sonunda aracı izlemeye devam etmek.
- ❌ Görüntüyü WhatsApp grubunda paylaşmak (yetkisiz aktarım).
- ❌ Kayıtları "ne olur ne olmaz" diye süresiz saklamak.
- ❌ Performans/disiplin amacıyla görüntü toplamak (amaç dışı kullanım).
