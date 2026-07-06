---
tip: kayit/sikayet
kod: SKY-<% tp.date.now("YYYY") %>-
durum: acik # acik | inceleme | cozum | kapandi
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip: Kalite
musteri: "[[]]"
urun: "[[]]"
kok_neden: # uretim | ambalaj | nakliye | kullanim | recete
guven: 2
iliskiler: ["[[60_URETIM_KALITE_MOC]]", "[[]]", "[[]]"]
etiketler: [tip/sikayet, durum/acik]
---
# Şikâyet — <% tp.date.now("YYYY-MM-DD") %>

**Müşteri:** · **Ürün:** 

## Konu

## Kök Neden Analizi (Kalite Agent 4.9)

## Görevler
- [ ] Kök nedeni belirle ⏫ 📅 <% tp.date.now("YYYY-MM-DD", 2) %> #gorev/kalite @Kalite [[<% tp.file.title %>]]
