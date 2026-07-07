"""Turkish-aware text and number helpers.

Python's default str.lower() mishandles the dotted/dotless I pair
('İ'.lower() -> 'i̇'). All keyword matching in the ETL goes through
tr_lower() so 'SIVA', 'Sıva' and 'sıva' compare equal.
"""
from __future__ import annotations

import re

_TR_LOWER_MAP = str.maketrans({"İ": "i", "I": "ı"})
_TR_ASCII_MAP = str.maketrans({
    "ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "İ": "i",
    "ö": "o", "Ö": "o", "ş": "s", "Ş": "s", "ü": "u", "Ü": "u",
})

# Invisible direction marks WhatsApp sprinkles into exports.
_INVISIBLE = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]")


def tr_lower(text: str) -> str:
    """Locale-correct lowercase for Turkish."""
    return text.translate(_TR_LOWER_MAP).lower()


def tr_fold(text: str) -> str:
    """Lowercase + strip Turkish diacritics -> ascii; for fuzzy matching."""
    return tr_lower(text).translate(_TR_ASCII_MAP)


def strip_invisible(text: str) -> str:
    return _INVISIBLE.sub("", text)


# ------------------------------------------------------------- numbers
# Turkish format: '1.400,50' -> 1400.50 ; '742.300' -> 742300 ; '1,5' -> 1.5
_NUM_RE = re.compile(r"^\d{1,3}(?:\.\d{3})+(?:,\d+)?$|^\d+(?:,\d+)?$|^\d+(?:\.\d+)?$")


def parse_tr_number(raw: str) -> float | None:
    """Parse a Turkish-formatted number string. Returns None if not numeric."""
    s = raw.strip().replace("\u00a0", "")
    if not s or not _NUM_RE.match(s):
        return None
    if "," in s:                      # comma is the decimal separator
        s = s.replace(".", "").replace(",", ".")
    elif s.count(".") == 1 and len(s.split(".")[1]) != 3:
        pass                          # '1400.5' -> already a decimal point
    else:
        s = s.replace(".", "")        # dots are thousands separators
    try:
        return float(s)
    except ValueError:
        return None


# Amount-with-unit finder for free WhatsApp text.
# Captures '742.300', '1.400,50 TL', '260 bin', '1,5 milyon'.
_AMOUNT_RE = re.compile(
    r"(?<![\dA-Za-z.,])"
    r"(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)"
    r"\s*(tl|₺|try|bin|milyon)?",
    re.IGNORECASE,
)

_UNIT_MULT = {"bin": 1_000, "milyon": 1_000_000}


def find_amounts(text: str) -> list[float]:
    """Extract money-like amounts from free text.

    Conservative on purpose: a bare small integer without thousands
    separators or a unit ('Hamza 260 çekecekti' -> shorthand for 260K)
    is ambiguous, so it is skipped. Better a missing amount than a
    wrong one (canon: 'para alanında varsayım yasak').
    """
    out: list[float] = []
    for m in _AMOUNT_RE.finditer(text):
        num_raw, unit = m.group(1), (m.group(2) or "").lower()
        val = parse_tr_number(num_raw)
        if val is None:
            continue
        if unit in _UNIT_MULT:
            out.append(val * _UNIT_MULT[unit])
        elif unit in ("tl", "₺", "try"):
            out.append(val)
        elif "." in num_raw or ("," in num_raw and val >= 1000):
            out.append(val)           # formatted number, safe to trust
        # else: bare short integer -> ambiguous, skip
    return out
