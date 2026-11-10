import logging
import sys
import traceback
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "website" / "backend"

for path_str in (str(ROOT_DIR), str(BACKEND_DIR)):
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


def _load_app():
    try:
        from app.main import app as fastapi_app

        return fastapi_app
    except Exception as exc:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse

        err_type = type(exc).__name__
        err_detail = str(exc)
        tb = traceback.format_exc()
        logging.error("Failed to import app.main: %s\n%s", exc, tb)
        print(f"STARTUP_IMPORT_ERROR: {exc}\n{tb}", file=sys.stderr, flush=True)

        fallback = FastAPI()

        @fallback.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
        def startup_error(full_path: str = ""):
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Backend failed to initialize",
                    "type": err_type,
                    "detail": err_detail,
                },
            )

        return fallback


app = _load_app()
