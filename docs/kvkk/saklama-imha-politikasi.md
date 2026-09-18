# Kişisel Veri Saklama ve İmha Politikası (Filo Takip Sistemi)

**Sürüm:** 1.0 · **Tarih:** [TARİH] · **Sorumlu:** KVKK irtibat kişisi

## 1. Amaç

KVKK m.7 ve Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale
Getirilmesi Hakkında Yönetmelik uyarınca, filo takip sisteminde tutulan
verilerin saklama sürelerini ve imha yöntemlerini belirler.

## 2. Saklama süreleri

| Veri türü | Sistem adı | Süre | İşlem | Dayanak |
|-----------|-----------|------|-------|---------|
| Rutin kamera kaydı | `camera_recording` | 30 gün | Sil | Amaçla sınırlılık |
| Olay klibi (dış kamera) | `camera_event_clip` | 180 gün | Sil | Kaza/sigorta süreci |
| Kabin içi olay klibi | `cabin_event_clip` | 90 gün | Sil | Ölçülülük — en kısa süre |
| Ham konum izi | `position` | 1 yıl | Sil | Operasyonel inceleme |
| Çalışma oturumu (puantaj) | `work_session` | 5 yıl | Sil / anonimleştir | İş hukuku zamanaşımı |
| Hakediş kaydı | `billing` | 10 yıl | Sakla | VUK m.253, TTK m.82 |
| Denetim kaydı | `audit_log` | 2 yıl | Sil | Hesap verebilirlik |
| Yakıt olayı | `fuel_event` | 2 yıl | Sil | Maliyet analizi |
| Cihaz olayı/alarm | `device_event` | 2 yıl | Sil | Bakım ve güvenlik |

**Anonimleştirme seçeneği:** `work_session` için `action = 'anonymize'`
seçildiğinde süre bilgisi korunur, operatör bağlantısı koparılır. Böylece
geçmiş verimlilik analizi yapılabilirken kişisel veri niteliği ortadan kalkar.

## 3. İmha yöntemi

- **Veritabanı kayıtları:** `DELETE` ile silinir; yedeklerdeki kopyalar yedek
  rotasyon süresi (30 gün) sonunda kendiliğinden düşer.
- **Video dosyaları:** Dosya sistemi üzerinden silinir (`unlink`), veritabanı
  kaydı `deleted_at` ile işaretlenir.
- **SD kart:** Cihaz döngüsel kayıt yapar; kapasite dolunca en eski kayıt
  üzerine yazılır. Araç satışı/hurdaya ayrılması hâlinde SD kart **fiziksel
  olarak imha edilir** ve tutanak tutulur.
- **Cihaz sökümü:** Cihaz başka araca takılmadan önce fabrika ayarlarına
  döndürülür.

## 4. İmhanın işletilmesi

- Otomatik imha işi **6 saatte bir** çalışır (`runRetention`).
- Her çalışma `retention_policies.last_run_at` ve `last_run_deleted` alanlarına
  yazılır — "imha yükümlülüğü yerine getirildi mi?" sorusu belgelenebilir.
- Periyodik imha süresi **6 ayı geçemez** (Yönetmelik m.11); sistemimizde bu
  süre 6 saattir.

## 5. İmhanın durdurulması (legal hold)

Devam eden bir dava, sigorta süreci veya resmi makam talebi varsa ilgili kayıt
`legal_hold = true` ile işaretlenir ve otomatik imha bu kaydı atlar. Kilit,
sürecin bitiminde KVKK irtibat kişisi tarafından kaldırılır ve kayıt normal
imha akışına girer.

## 6. Sorumluluklar

| Görev | Sorumlu |
|-------|---------|
| Politikanın güncellenmesi | KVKK irtibat kişisi |
| Otomatik imha işinin izlenmesi | Sistem yöneticisi |
| Legal hold kararı | KVKK irtibat kişisi + hukuk |
| SD kart fiziksel imhası | Saha/filo sorumlusu |
| Yıllık gözden geçirme | KVKK irtibat kişisi |

## 7. Kontrol listesi (aylık)

- [ ] İmha işi son 24 saatte çalıştı mı?
- [ ] İmha bekleyen (`retention_until` geçmiş) kayıt birikti mi?
- [ ] Legal hold'daki kayıtların gerekçesi hâlâ geçerli mi?
- [ ] Süresi geçmiş ilgili kişi başvurusu var mı?
- [ ] Ses kaydı açık kamera var mı?

Bu kontroller `GET /api/kvkk/compliance` uç noktasından otomatik üretilir.
