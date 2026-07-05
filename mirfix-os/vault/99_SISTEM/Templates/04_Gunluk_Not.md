---
tip: kayit/gunluk
kod: 
durum: onaylandi
tarih: <% tp.date.now("YYYY-MM-DD") %>
sahip: <% tp.system.prompt("Kim? (Ahmet/Mehmet)") %>
gun: <% tp.date.now("dddd") %>
guven: 3
iliskiler:
  - "[[99_SISTEM/Dashboards/Gunluk_Panel]]"
  - "[[<% tp.date.now("YYYY-MM-DD", -1) %>]]"
  - "[[<% tp.date.now("YYYY-MM-DD", 1) %>]]"
etiketler:
  - tip/gunluk
---

# Günlük — <% tp.date.now("YYYY-MM-DD") %> (<% tp.date.now("dddd") %>)

## Sabah 5 dk (08:30)
Bugünün 3 önceliği:
1. 
2. 
3. 

Panele bak: [[99_SISTEM/Dashboards/Gunluk_Panel]]

## Gün içi log

## Akşam 5 dk (18:00)
- **Ne oldu:**
- **Ne kaldı (yarına devir):**
- **INBOX'a düşenler işlendi mi:** hayir

## Bugünün görevleri
- [ ] 📅 <% tp.date.now("YYYY-MM-DD") %> ⏫ #gorev/genel @<% tp.file.title %>
