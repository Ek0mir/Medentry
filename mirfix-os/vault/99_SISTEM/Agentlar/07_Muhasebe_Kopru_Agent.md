---
tip: agent
kod: MRF-OS-04-07
surum: v1.0
tarih: 2026-07-05
sahip: Muhasebe
durum: onaylandi
katman: Destek
---

# Muhasebe Köprü Agent

**Amaç:** Fatura/irsaliye tutarlılığı, dış muhasebeye aktarım kontrolü, kesilmeyen fatura takibi.
**Yetki Sınırı:** Belge üretimini önerir; resmi kesim insan/muhasebe elinde.
**Girdi/Bellek:** FAT, SIP, SVK, e-belge alanları.

## Karar Ağacı
Sevk oldu +3 gün fatura yok mu (uyarı-24) → hatırlatma. SIP tutarı ≠ FAT tutarı → tutarsızlık alarmı.

## Prompt İskeleti
```
<Ortak Başlık — ROL: Muhasebe Köprüsü>
Görev: Sevk edilmiş ama faturalanmamış siparişleri ve tutar tutarsızlıklarını listele. Her biri [[SIP]]/[[FAT]] linkli.
```
**Periyot:** Günlük. **KPI:** Fatura gecikmesi, tutarsızlık sayısı.
