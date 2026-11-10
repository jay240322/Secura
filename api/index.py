import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "website" / "backend"

for path_str in (str(ROOT_DIR), str(BACKEND_DIR)):
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

from app.main import app  # noqa: E402, F401

