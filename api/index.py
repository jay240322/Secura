import logging
import sys
import traceback
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "website" / "backend"

for path_str in (str(ROOT_DIR), str(BACKEND_DIR)):
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

try:
    from app.main import app  # noqa: E402, F401
except Exception as exc:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    tb = traceback.format_exc()
    logging.error("Failed to import app.main: %s\n%s", exc, tb)
    print(f"STARTUP_IMPORT_ERROR: {exc}\n{tb}", file=sys.stderr, flush=True)

    app = FastAPI()

    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    def startup_error(full_path: str = ""):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend failed to initialize",
                "type": type(exc).__name__,
                "detail": str(exc),
            },
        )
