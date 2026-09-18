# İlgili Kişi Başvuru Formu (KVKK m.11 / m.13)

**Veri sorumlusu:** [ŞİRKET UNVANI]
**Başvuru kanalları:** Uygulama içi "KVKK Başvurusu" ekranı · [E-POSTA] · KEP: [KEP] · [ADRES]

---

## 1. Başvuru sahibinin bilgileri

| Alan | Bilgi |
|------|-------|
| Ad Soyad | |
| T.C. Kimlik No (yabancılar için pasaport no) | |
| Sicil / personel no | |
| Şirketle ilişkisi | ☐ Çalışan ☐ Eski çalışan ☐ Alt yüklenici ☐ Üçüncü kişi |
| Tebligata esas adres | |
| Telefon | |
| E-posta | |
| Yanıtın iletilmesini istediğiniz kanal | ☐ E-posta ☐ Posta ☐ Elden ☐ KEP |

## 2. Talep konusu

☐ Kişisel verimin işlenip işlenmediğini öğrenmek istiyorum
☐ İşlenmişse buna ilişkin bilgi talep ediyorum
☐ İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenmek istiyorum
☐ Yurt içinde/yurt dışında verilerimin aktarıldığı üçüncü kişileri bilmek istiyorum
☐ Eksik/yanlış işlenmişse **düzeltilmesini** istiyorum
☐ Silinmesini / yok edilmesini istiyorum
☐ Düzeltme/silme işleminin aktarıldığı üçüncü kişilere bildirilmesini istiyorum
☐ Otomatik sistemlerle analiz sonucu aleyhime çıkan sonuca **itiraz ediyorum**
☐ Kanuna aykırı işleme nedeniyle **zararımın giderilmesini** talep ediyorum

## 3. Talebin ayrıntısı

Lütfen talebinizi, ilgili tarih aralığı ve araç/makine bilgisiyle birlikte
açıklayınız:

```
(örnek: 01.09.2026 - 15.09.2026 tarihleri arasında EKS-01 makinesinde
kayıtlı çalışma saatlerimin dökümünü ve bu döneme ait kamera görüntüsüne
kimlerin eriştiğini talep ediyorum.)




```

## 4. Ekler

☐ Kimlik fotokopisi  ☐ Vekâletname  ☐ Diğer: ____________________

## 5. Beyan

> Yukarıdaki bilgilerin doğru ve güncel olduğunu, talebimin KVKK m.11 kapsamında
> olduğunu beyan ederim. Şirketinizin, kimliğimi doğrulamak amacıyla ek belge
> talep edebileceğini biliyorum.

Tarih: ____/____/______  İmza: ______________________

---

## Şirket tarafından doldurulur

| Alan | Bilgi |
|------|-------|
| Başvuru no | |
| Kayıt tarihi | |
| Yasal yanıt tarihi (kayıt + 30 gün) | |
| Sistemdeki kayıt (`dsr_requests.id`) | |
| İnceleyen | |
| Sonuç | ☐ Kabul ☐ Kısmen kabul ☐ Ret |
| Ret gerekçesi | |
| Yanıt tarihi ve kanalı | |

**Not:** Başvurular sisteme `POST /api/kvkk/dsr` ile kaydedilir ve 30 günlük
süre otomatik hesaplanır. Süresi yaklaşan/geçen başvurular uyum panosunda
görünür. Talebin reddi hâlinde ilgili kişinin 30 gün içinde Kurul'a şikâyet
hakkı bulunduğu yanıtta belirtilir.
