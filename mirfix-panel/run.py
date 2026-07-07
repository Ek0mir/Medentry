"""MIRFIX Panel entry point.

Usage:
    python run.py              # train once if DB missing, then serve
    python run.py --retrain    # force full re-ingest, then serve
    python run.py --etl-only   # ingest only, no server
"""
import os
import sys

import uvicorn

from src.config import DB_PATH, APP_NAME, vault_path
from src.etl.pipeline import run_all


def main() -> None:
    force = "--retrain" in sys.argv
    etl_only = "--etl-only" in sys.argv

    if force or etl_only or not DB_PATH.exists():
        print(f"[{APP_NAME}] Veri kaynakları okunuyor (kendini eğitme turu)...")
        summary = run_all()
        for s in summary["sources"]:
            print("  -", s)
        print(f"[{APP_NAME}] Eğitim tamamlandı: {summary['finished']}")
    if etl_only:
        return

    vault = vault_path()
    print(f"[{APP_NAME}] Obsidian vault: {vault or 'ayarlanmadı (panel 09. sekmeden girilebilir)'}")
    host = os.environ.get("MIRFIX_HOST", "127.0.0.1")
    port = int(os.environ.get("MIRFIX_PORT", "8000"))
    print(f"[{APP_NAME}] Panel: http://{host}:{port}")
    uvicorn.run("src.api:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
