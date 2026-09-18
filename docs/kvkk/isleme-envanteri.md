# Kişisel Veri İşleme Envanteri (Filo Takip)

VERBİS bildirimi ve hesap verebilirlik için kullanılır. Sistemdeki
`PURPOSE_CATALOG` ve `PURPOSE_DATA_MATRIX` tanımlarıyla birebir tutarlıdır.

**Veri sorumlusu:** [ŞİRKET UNVANI] · **VERBİS No:** [____] · **Güncelleme:** [TARİH]

## 1. Veri kategorileri ve ilgili kişi grupları

| Veri kategorisi | Örnek alanlar | İlgili kişi grubu |
|-----------------|---------------|-------------------|
| Kimlik | Ad soyad, sicil no | Çalışan (operatör, şoför) |
| İletişim | Telefon, e-posta | Çalışan |
| Konum | Enlem/boylam, hız, yön, güzergâh | Çalışan |
| Çalışma bilgisi | Kontak saatleri, çalışma/rölanti süresi, vardiya | Çalışan |
| Görsel kayıt | Dış kamera görüntüsü, kabin olay klibi | Çalışan, üçüncü kişiler (yaya, diğer sürücü) |
| İşlem güvenliği | IP, oturum kaydı, denetim logu | Çalışan, yönetici |
| Finans | Hakediş tutarı, yakıt maliyeti | — (kuruma ait) |

> **Not:** Dışa bakan kamera, kaçınılmaz olarak **üçüncü kişileri** de kaydeder.
> Bu kişiler için aydınlatma, araç üzerindeki görünür etiketle sağlanır.

## 2. İşleme amaçları ve hukuki sebepler

| Amaç (sistem kodu) | Açıklama | Hukuki sebep | Saklama |
|--------------------|----------|--------------|---------|
| `is_guvenligi` | İSG, kaza önleme | m.5/2-ç, m.5/2-f; 6331 m.4 | 180 gün (klip) |
| `operasyon_yonetimi` | Sevk, planlama, puantaj | m.5/2-ç, m.5/2-f | 1 yıl (konum) |
| `hakedis_faturalama` | Müşteri hakedişi | m.5/2-ç, m.5/2-a | 10 yıl |
| `varlik_guvenligi` | Hırsızlık, yakıt kaybı | m.5/2-f | 2 yıl |
| `kaza_inceleme` | Kaza/sigorta | m.5/2-e | Süreç + 180 gün |
| `bakim_arizalar` | Periyodik bakım | m.5/2-f | 2 yıl |
| `hukuki_talep` | Resmi makam, dava | m.5/2-a, m.5/2-e | Süreç boyunca |

## 3. Alıcı grupları

| Alıcı | Ne aktarılır | Sıfat | Dayanak |
|-------|--------------|-------|---------|
| Sunucu/barındırma sağlayıcı | Tüm sistem verisi (teknik erişim) | Veri işleyen | Veri işleyen sözleşmesi |
| GSM operatörü | Cihaz bağlantı verisi | Veri işleyen | Abonelik sözleşmesi |
| Sigorta şirketi / eksper | Kaza klibi, olay telemetrisi | Veri sorumlusu | m.5/2-e |
| Mahkeme / kolluk | Talep edilen kayıt | — | m.5/2-a |
| Müşteri | Hakediş saati özeti (güzergâh **değil**) | Veri sorumlusu | m.5/2-ç |
| Muhasebe / mali müşavir | Hakediş ve fatura | Veri işleyen | m.5/2-a |

**Yurt dışına aktarım:** Yapılmamaktadır. Sunucular Türkiye'dedir. (Bulut
sağlayıcı değişirse m.9 kapsamında yeniden değerlendirilmelidir.)

## 4. Teknik ve idari tedbirler (KVKK m.12)

### Teknik
- Rol bazlı erişim (6 rol), amaç bazlı yetkilendirme matrisi
- Parolalar `scrypt` ile özetlenir; düz metin parola tutulmaz
- Oturum jetonu HS256 JWT, 12 saat; **yayın jetonu 120 saniye**
- Tüm trafikte TLS; cihaz bağlantılarında paylaşılan anahtar
- Denetim kaydı: izin verilen ve reddedilen tüm erişimler
- Otomatik imha işi (6 saatte bir)
- Mahremiyet bölgesi ve mahremiyet penceresi maskelemesi
- Veritabanı yedeklerinde 30 gün rotasyon

### İdari
- Kamera politikası ve personel bilgilendirme tutanağı
- Gizlilik taahhütnameleri (yönetici ve şantiye şefleri)
- Yılda bir KVKK farkındalık eğitimi
- Erişim yetkilerinin 6 ayda bir gözden geçirilmesi
- İhlal müdahale prosedürü (72 saat)
- Veri işleyenlerle yazılı sözleşme

## 5. İlgili kişi başvuru kanalı

- Uygulama içi "KVKK Başvurusu" ekranı
- E-posta: [E-POSTA]
- KEP: [KEP ADRESİ]
- Yazılı başvuru: [ADRES]

Yanıt süresi: **en geç 30 gün** (KVKK m.13/2). Sistem, süresi geçen başvuruları
uyum panosunda kırmızı olarak gösterir.
