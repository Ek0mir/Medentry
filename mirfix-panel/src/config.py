"""
MIRFIX Panel - configuration.

Architecture note (per PO rule + DATABASE-BIBLE alignment):
- All code, identifiers and schema names are ENGLISH.
- All business data, labels and UI copy remain TURKISH.
- This SQLite database is a DERIVED, REBUILDABLE read model (CQRS read side).
  The SSOT (vault + event log + canonical PostgreSQL schema) is untouched.
  DB-Bible explicitly allows SQLite exports for local analytics.
"""
import json
import os
from pathlib import Path

# ---------------------------------------------------------------- paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
DB_PATH = DATA_DIR / "mirfix.db"
WEB_DIR = PROJECT_ROOT / "web"
SETTINGS_PATH = DATA_DIR / "settings.json"

# --------------------------------------------------- runtime settings
def load_settings() -> dict:
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_settings(settings: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(settings, ensure_ascii=False, indent=2),
                             encoding="utf-8")


# ------------------------------------------------- Obsidian vault
# The vault is the user's SSOT. The panel reads extra source files from
# <vault>/MIRFIX/Gelen, keeps the user journal in <vault>/MIRFIX/Defter
# and writes markdown reports to <vault>/MIRFIX/Panel so every number is
# visible (and linkable) inside Obsidian.
VAULT_SUBDIR = "MIRFIX"
VAULT_INBOX_DIR = "Gelen"
VAULT_PANEL_DIR = "Panel"
VAULT_JOURNAL_DIR = "Defter"


def vault_path() -> Path | None:
    raw = os.environ.get("MIRFIX_VAULT") or load_settings().get("vault_path")
    if not raw:
        return None
    p = Path(raw).expanduser()
    return p if p.is_dir() else None


# ------------------------------------------------- raw file discovery
# Fuzzy fragments so the user can drop newer versions of the same files
# into data/raw (or the vault inbox) without renaming them.
CASH_WORKBOOK_HINT = "kasa_yonetim"          # Mirfix_Kasa_Yonetim_Raporu.xlsx
OLD_LEDGER_WORKBOOK_HINT = "eski_kasa"       # Eski_Kasa_Tahsilat_Analizi*.xlsx
CARI_WORKBOOK_HINT = "cari"                  # cari (current-account) balances
STOCK_WORKBOOK_HINT = "stok"                 # stock list
CHAT_GLOB = "_chat*.txt"                     # WhatsApp exports

# ------------------------------------------------- live WhatsApp agent
# Meta WhatsApp Business Cloud API webhook verification token (set the
# same value in the Meta developer console) and an optional shared
# secret for the generic bridge endpoint (X-Mirfix-Anahtar header).
WA_VERIFY_TOKEN = os.environ.get("MIRFIX_WA_VERIFY_TOKEN", "mirfix-panel")
WA_BRIDGE_TOKEN = os.environ.get("MIRFIX_WA_TOKEN")  # None => bridge open on localhost

# File watcher: auto-retrain when data/raw or the vault inbox changes.
WATCH_SECONDS = int(os.environ.get("MIRFIX_WATCH_SECONDS", "60"))

# ------------------------------------------------------- domain rules
# Action-plan (Mirfix_Eylem_Plani, 06.07.2026) hard limits used by the
# compliance engine. Amounts in TRY.
RULE_ADVANCE_MONTHLY_LIMIT = 10_000          # rule 4: personnel advance / person / month
RULE_KITCHEN_WEEKLY_BUDGET = 3_000           # rule 7: kitchen/market weekly budget
RULE_CASH_EOD_LIMIT = 100_000                # rule 3: end-of-day physical cash (data not available yet)
RULE_QUOTE_THRESHOLD = 50_000                # rule 5: >=50K purchases need 3 quotes (manual evidence)

# Related parties for rule 6 (partner <-> company flows must go through
# a partners' current account, not straight out of the till).
RELATED_PARTY_HINTS = ("ALİ ÖZDEMİR", "EKOMİR")

# Personal-card payment markers seen in the ledger descriptions (rule 2).
PERSONAL_CARD_HINTS = ("KUVEYT", "HAPPY", "VAKIF KART", "MAVİ-MOR", "MAVI-MOR",
                       "GRİ KART", "GRI KART", "ŞAHSİ KART", "SAHSI KART", "KREDİ KARTI", "KREDI KARTI")

# OKR-O1 / KR1 (BOS §6.2): recover >= 12M TRY from class-A old balances in Q3.
OKR_OLD_LEDGER_TARGET = 12_000_000

# WhatsApp signal window used on the overview cards (days).
SIGNAL_WINDOW_DAYS = 30

# Data considered stale after this many hours (Dashboard-Bible: gray is
# worse than red).
STALE_AFTER_HOURS = 26

APP_NAME = "MİRFİX Operasyon Paneli"
APP_CODE = "MRF-PNL-01"
APP_VERSION = "2.0"
