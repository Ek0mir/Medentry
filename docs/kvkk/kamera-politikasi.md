# Araç İçi Kamera Politikası

**Sürüm:** 1.0 · **Onay:** [YÖNETİM] · **Tarih:** [TARİH]

Bu politika, iş makinesi ve araçlara takılan kamera sistemlerinin kurulum,
kullanım, erişim ve imha kurallarını belirler. Politikaya aykırı kullanım
disiplin işlemine ve KVKK m.12 kapsamında veri güvenliği ihlali bildirimine
konu olur.

## 1. Kamera yerleşimi ve açıları

| Kamera | Kabul edilen açı | Yasak açı |
|--------|------------------|-----------|
| Ön (dış) | Yol / çalışma sahası | Komşu parsel içi, konut pencereleri |
| Arka / yan | Manevra alanı, yaya geçiş bölgesi | Sokak/kaldırım genel gözetimi |
| Bom / kova | Çalışma alanı | — |
| Kabin içi | Operatör koltuğu ve ön cam görüş alanı | Klozet/dinlenme alanı, kişisel eşya bölmesi, telefon ekranı |

**Kural:** Kabin kamerası, operatörün telefon ekranını veya kişisel eşyalarını
çerçeveleyecek şekilde konumlandırılamaz. Montaj sonrası açı, operatör
huzurunda kontrol edilir ve `montaj-tutanagi` ile imza altına alınır.

## 2. Ses

**Ses kaydı varsayılan olarak kapalıdır ve açılmaz.** Kurul, araç içi ses
kaydını çoğu senaryoda ölçüsüz bulmaktadır. Sistemde ses ancak yazılı gerekçe
girilerek açılabilir (`AUDIO_JUSTIFICATION_REQUIRED`) ve uyum panosunda kırmızı
uyarı olarak görünür.

## 3. Kayıt rejimi

| Kamera | Kayıt | Canlı izleme |
|--------|-------|--------------|
| Dışa bakan | SD karta sürekli döngüsel kayıt | İzinli (gerekçeli, mesai içi) |
| Kabin içi | **Yalnızca olay klibi** (olay ±30 sn) | **Yasak** |

Olay klibi üreten tetikleyiciler: çarpma, sert fren, sert hızlanma, sert
viraj, acil durum (SOS), çekilme/kurcalama alarmı.

## 4. Erişim kuralları

1. Her erişim bir **işleme amacına** bağlanır; amaç dışı erişim reddedilir.
2. Kamera erişiminde **en az 15 karakterlik yazılı gerekçe** zorunludur.
3. Kabin görüntüsü için **olay kaydı referansı** ve **ikinci yetkili onayı**
   gerekir.
4. Mola ve vardiya dışı saatlerde erişim kapalıdır.
5. Erişim, ilgili operatöre otomatik bildirilir.
6. Görüntü indirme/dışa aktarma yalnızca kaza incelemesi ve hukuki talep
   amaçlarıyla, KVKK irtibat kişisi bilgisiyle yapılır.

## 5. Bilgilendirme etiketleri

Her araçta aşağıdaki etiketler bulunur:

**Kabin içi (operatörün göz hizasında):**
> 📷 **BU ARAÇTA KAMERA SİSTEMİ BULUNMAKTADIR**
> Kabin kamerası canlı izlenmez; yalnızca kaza/ani olay anında kayıt incelenir.
> Ses kaydı yapılmaz. Ayrıntı: aydınlatma metni — [E-POSTA]
> Veri sorumlusu: [ŞİRKET]

**Araç dışı (kapı/arka):**
> 📷 KAMERALI ARAÇ — İş güvenliği amacıyla kayıt yapılmaktadır. [ŞİRKET]

Etiketi sökülen/okunmaz hâle gelen araçta kamera kullanımı durdurulur ve etiket
yenilenene kadar sistemde kamera pasife alınır.

## 6. Saklama ve imha

Bkz. `saklama-imha-politikasi.md`. Özet: rutin kayıt 30 gün, olay klibi 180 gün,
kabin olay klibi 90 gün. Hukuki süreç varsa `legal_hold` ile imha durdurulur.

## 7. Yasak kullanımlar

- Performans değerlendirmesi veya disiplin soruşturması için görüntü **toplamak**
  (olaya bağlı inceleme hariç).
- Görüntüyü mesajlaşma uygulamalarında veya sosyal medyada paylaşmak.
- Görüntüyü üçüncü kişilere (müşteri dâhil) hukuki dayanak olmadan göstermek.
- Kamerayı operatörden habersiz konumlandırmak veya gizlemek.
- Ses kaydını gerekçesiz açmak.

## 8. İhlal hâlinde

1. Erişim derhâl kapatılır, denetim kaydı incelenir.
2. KVKK irtibat kişisi 72 saat içinde değerlendirme yapar.
3. Veri ihlali niteliğindeyse Kurul'a ve ilgili kişiye bildirim yapılır
   (KVKK m.12/5).
4. Disiplin süreci işletilir.
