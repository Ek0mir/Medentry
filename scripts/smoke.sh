#!/usr/bin/env bash
# Uctan uca duman testi (smoke test).
#
# Calisan bir API'ye karsi temel akislari ve KVKK kisitlarini dogrular.
# Kullanim:  API=http://127.0.0.1:8080 ./scripts/smoke.sh
set -uo pipefail

API="${API:-http://127.0.0.1:8080}"
PASS="${SEED_PASSWORD:-Medentry2026!}"
FAILED=0

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; FAILED=$((FAILED+1)); }

login() {
  curl -s -X POST "$API/api/auth/login" -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" |
    python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))"
}

# Yanittaki alani okur:  get_field <json> <python-ifade>
field() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

say "1) Giris"
MANAGER=$(login yonetici@ornek-firma.com.tr)
OPERATOR=$(login operator1@ornek-firma.com.tr)
DPO=$(login kvkk@ornek-firma.com.tr)
[ -n "$MANAGER" ] && ok "yonetici girisi" || bad "yonetici girisi"
[ -n "$OPERATOR" ] && ok "operator girisi" || bad "operator girisi"

WRONG=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"yonetici@ornek-firma.com.tr","password":"yanlis-parola"}')
[ "$WRONG" = "401" ] && ok "yanlis parola reddedildi" || bad "yanlis parola kabul edildi ($WRONG)"

say "2) Tek ekran (dashboard)"
DASH=$(curl -s "$API/api/dashboard" -H "authorization: Bearer $MANAGER")
COUNT=$(echo "$DASH" | field "len(d['assets'])")
[ "$COUNT" -ge 4 ] && ok "$COUNT varlik listelendi" || bad "varlik listesi bos"
ASSET_ID=$(echo "$DASH" | field "[a['id'] for a in d['assets'] if a['code']=='EKS-01'][0]")
echo "$DASH" | field "'  kod/ durum/ operator: ' + ', '.join(f\"{a['code']}={a['status']}({(a['operator'] or {}).get('name','-')})\" for a in d['assets'])"

say "3) Kamera politikasi (KVKK)"
CAMS=$(curl -s "$API/api/assets/$ASSET_ID/cameras" -H "authorization: Bearer $MANAGER")
CABIN=$(echo "$CAMS" | field "[c['id'] for c in d if c['position']=='cabin'][0]")
FRONT=$(echo "$CAMS" | field "[c['id'] for c in d if c['position']=='front'][0]")

# 3a) Dis kamera + gecerli amac + gerekce -> izin
R=$(curl -s -o /tmp/r.json -w '%{http_code}' -X POST "$API/api/media/live" \
  -H "authorization: Bearer $MANAGER" -H 'content-type: application/json' \
  -d "{\"cameraId\":\"$FRONT\",\"purpose\":\"is_guvenligi\",\"reason\":\"Santiye giris yolunda yaya yaklasma ihbari inceleniyor\"}")
if [ "$R" = "200" ]; then ok "dis kamera canli izleme acildi"; else bad "dis kamera acilmadi ($R: $(cat /tmp/r.json))"; fi
SESSION_ID=$(python3 -c "import json;print(json.load(open('/tmp/r.json')).get('sessionId',''))" 2>/dev/null)

# 3b) Kabin kamerasi canli -> yasak
R=$(curl -s -o /tmp/r.json -w '%{http_code}' -X POST "$API/api/media/live" \
  -H "authorization: Bearer $MANAGER" -H 'content-type: application/json' \
  -d "{\"cameraId\":\"$CABIN\",\"purpose\":\"kaza_inceleme\",\"reason\":\"Kaza incelemesi kapsaminda kabin goruntusu talep ediliyor\"}")
CODE=$(python3 -c "import json;print(json.load(open('/tmp/r.json')).get('code',''))")
[ "$R" = "403" ] && [ "$CODE" = "CABIN_LIVE_FORBIDDEN" ] && ok "kabin canli izleme reddedildi ($CODE)" || bad "kabin canli izleme engellenmedi ($R/$CODE)"

# 3c) Gerekcesiz erisim -> reddedilir
R=$(curl -s -o /tmp/r.json -w '%{http_code}' -X POST "$API/api/media/live" \
  -H "authorization: Bearer $MANAGER" -H 'content-type: application/json' \
  -d "{\"cameraId\":\"$FRONT\",\"purpose\":\"is_guvenligi\",\"reason\":\"kontrol\"}")
CODE=$(python3 -c "import json;print(json.load(open('/tmp/r.json')).get('code',''))")
[ "$R" = "403" ] || [ "$R" = "400" ] && ok "gerekcesiz erisim reddedildi ($CODE)" || bad "gerekcesiz erisim kabul edildi ($R)"

# 3d) Amac disi erisim -> reddedilir
R=$(curl -s -o /tmp/r.json -w '%{http_code}' -X POST "$API/api/media/live" \
  -H "authorization: Bearer $MANAGER" -H 'content-type: application/json' \
  -d "{\"cameraId\":\"$FRONT\",\"purpose\":\"hakedis_faturalama\",\"reason\":\"Hakedis kontrolu icin goruntu isteniyor\"}")
CODE=$(python3 -c "import json;print(json.load(open('/tmp/r.json')).get('code',''))")
[ "$CODE" = "PURPOSE_MISMATCH" ] && ok "amac disi erisim reddedildi ($CODE)" || bad "amacla sinirlilik uygulanmadi ($R/$CODE)"

# 3e) Operator rolu kamera izleyemez
R=$(curl -s -o /tmp/r.json -w '%{http_code}' -X POST "$API/api/media/live" \
  -H "authorization: Bearer $OPERATOR" -H 'content-type: application/json' \
  -d "{\"cameraId\":\"$FRONT\",\"purpose\":\"is_guvenligi\",\"reason\":\"Merak ettigim icin goruntuye bakmak istiyorum\"}")
CODE=$(python3 -c "import json;print(json.load(open('/tmp/r.json')).get('code',''))")
[ "$CODE" = "ROLE_FORBIDDEN" ] && ok "operator kamera erisimi reddedildi" || bad "rol kisiti uygulanmadi ($R/$CODE)"

if [ -n "$SESSION_ID" ]; then
  curl -s -X POST "$API/api/media/$SESSION_ID/stop" -H "authorization: Bearer $MANAGER" > /dev/null
  ok "izleme oturumu kapatildi"
fi

say "4) Seffaflik: operatore bildirim ve erisim gecmisi"
NOTIF=$(curl -s "$API/api/notifications" -H "authorization: Bearer $OPERATOR" | field "len(d)")
[ "$NOTIF" -ge 1 ] && ok "operatore $NOTIF bildirim dustu" || bad "operatore bildirim gitmedi"
MYLOG=$(curl -s "$API/api/kvkk/my-access-log" -H "authorization: Bearer $OPERATOR" | field "len(d)")
[ "$MYLOG" -ge 1 ] && ok "operator kendi erisim gecmisini gordu ($MYLOG kayit)" || bad "erisim gecmisi bos"

say "5) Denetim kaydi"
AUDIT=$(curl -s "$API/api/kvkk/audit?limit=500" -H "authorization: Bearer $DPO")
ALLOW=$(echo "$AUDIT" | field "sum(1 for r in d if r['result']=='allow')")
DENY=$(echo "$AUDIT" | field "sum(1 for r in d if r['result']=='deny')")
[ "$DENY" -ge 3 ] && ok "reddedilen erisimler kayda gecti (izin: $ALLOW, red: $DENY)" || bad "red kayitlari eksik ($DENY)"

say "6) Hakedis"
BILL=$(curl -s "$API/api/billing?from=2026-09-01&to=2026-12-31" -H "authorization: Bearer $MANAGER")
ROWS=$(echo "$BILL" | field "len(d['rows'])")
[ "$ROWS" -ge 1 ] && ok "$ROWS gunluk hakedis satiri" || bad "hakedis uretilmedi"
echo "$BILL" | field "'\n'.join('  %-12s %-8s %5.2f saat  %10.2f TL' % (r['date'], r['assetCode'], r['billableHours'], r['amountTotal']) for r in d['rows'][:6])"

say "7) KVKK uyum panosu"
COMP=$(curl -s "$API/api/kvkk/compliance" -H "authorization: Bearer $DPO")
SCORE=$(echo "$COMP" | field "d['score']")
echo "$COMP" | field "'\n'.join(('  ' + ('OK ' if c['ok'] else 'EKSIK ') + c['label'] + ' - ' + c['detail']) for c in d['checks'])"
[ "$SCORE" -ge 50 ] && ok "uyum skoru: %$SCORE" || bad "uyum skoru dusuk: %$SCORE"

say "SONUC"
if [ "$FAILED" -eq 0 ]; then
  printf '  \033[32mTum kontroller gecti.\033[0m\n'
else
  printf '  \033[31m%d kontrol basarisiz.\033[0m\n' "$FAILED"
  exit 1
fi
