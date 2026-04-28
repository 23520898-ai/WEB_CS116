"""Single entrypoint for hosting the full website.

Run:
    python main.py

Update network settings in the AppConfig class below.
"""

from __future__ import annotations

import os
import platform
import subprocess
from dataclasses import dataclass
from pathlib import Path

import uvicorn


@dataclass(frozen=True)
class AppConfig:
    # Network settings (edit these values in one place).
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True

    # Frontend build settings.
    auto_build_frontend: bool = True
    force_rebuild_frontend: bool = False


ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"


def _npm_command() -> str:
    if platform.system().lower().startswith("win"):
        return "npm.cmd"
    return "npm"


def _run_command(command: list[str], cwd: Path) -> None:
    process = subprocess.run(command, cwd=str(cwd), check=False)
    if process.returncode != 0:
        raise RuntimeError(f"Command failed ({' '.join(command)}) in {cwd}")


def ensure_frontend_build(config: AppConfig) -> None:
    if not config.auto_build_frontend:
        return

    build_required = config.force_rebuild_frontend or not (FRONTEND_DIST_DIR / "index.html").exists()
    if not build_required:
        return

    npm = _npm_command()
    print("[launcher] Installing frontend dependencies...")
    _run_command([npm, "install"], FRONTEND_DIR)

    print("[launcher] Building frontend bundle...")
    _run_command([npm, "run", "build"], FRONTEND_DIR)


def run() -> None:
    config = AppConfig()

    os.environ.setdefault("PYTHONUNBUFFERED", "1")

    ensure_frontend_build(config)

    print(f"[launcher] Starting server at http://{config.host}:{config.port}")
    uvicorn.run(
        "backend.main:app",
        host=config.host,
        port=config.port,
        reload=config.reload,
        reload_dirs=[str(ROOT_DIR / "backend")],
    )


if __name__ == "__main__":
    run()
