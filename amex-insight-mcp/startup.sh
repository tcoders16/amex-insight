#!/bin/bash
set -e

VENV=/home/venv
PIP=$VENV/bin/pip
PYTHON=$VENV/bin/python

log() { echo "[startup] $(date -u '+%H:%M:%S') $*"; }

# ── Venv ─────────────────────────────────────────────────────────────────────
if [ ! -f "$VENV/bin/python" ]; then
  log "Creating venv at $VENV..."
  python3 -m venv $VENV
  log "Venv created OK"
else
  log "Venv already exists — skipping create"
fi

# ── Torch CPU ─────────────────────────────────────────────────────────────────
if ! $PYTHON -c "import torch" 2>/dev/null; then
  log "torch not found — downloading CPU-only wheel (~200MB)..."
  $PIP install torch --index-url https://download.pytorch.org/whl/cpu --quiet
  TORCH_VER=$($PYTHON -c "import torch; print(torch.__version__)")
  log "torch $TORCH_VER installed OK"
else
  TORCH_VER=$($PYTHON -c "import torch; print(torch.__version__)")
  log "torch $TORCH_VER already installed — skipping"
fi

# ── Requirements ──────────────────────────────────────────────────────────────
if ! $PYTHON -c "import fastapi" 2>/dev/null; then
  log "fastapi not found — installing requirements.txt..."
  $PIP install -r /home/site/wwwroot/requirements.txt --quiet
  log "requirements.txt installed OK"
else
  FA_VER=$($PYTHON -c "import fastapi; print(fastapi.__version__)")
  log "fastapi $FA_VER already installed — skipping"
fi

# ── Sentence Transformers check ───────────────────────────────────────────────
if $PYTHON -c "from sentence_transformers import CrossEncoder" 2>/dev/null; then
  ST_VER=$($PYTHON -c "import sentence_transformers; print(sentence_transformers.__version__)")
  log "sentence_transformers $ST_VER ready"
else
  log "WARNING: sentence_transformers missing — reinstalling requirements..."
  $PIP install -r /home/site/wwwroot/requirements.txt --quiet
  log "Reinstall done"
fi

# ── Launch ────────────────────────────────────────────────────────────────────
log "All packages verified — launching uvicorn on port 8000..."
cd /home/site/wwwroot
exec $VENV/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
