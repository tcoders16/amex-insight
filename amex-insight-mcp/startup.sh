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
# Always run — pip skips already-installed packages so this is fast.
# Avoids stale venv when new packages (python-docx, python-pptx, etc.) are added.
log "Installing requirements.txt..."
$PIP install -r /home/site/wwwroot/requirements.txt --quiet
FA_VER=$($PYTHON -c "import fastapi; print(fastapi.__version__)" 2>/dev/null || echo "unknown")
log "fastapi $FA_VER ready"

# ── Sentence Transformers check ───────────────────────────────────────────────
if $PYTHON -c "from sentence_transformers import CrossEncoder" 2>/dev/null; then
  ST_VER=$($PYTHON -c "import sentence_transformers; print(sentence_transformers.__version__)")
  log "sentence_transformers $ST_VER ready"
else
  log "WARNING: sentence_transformers missing after install — check requirements.txt"
fi

# ── Document generation check ─────────────────────────────────────────────────
if $PYTHON -c "import docx; import pptx" 2>/dev/null; then
  log "python-docx and python-pptx ready"
else
  log "WARNING: python-docx or python-pptx missing — document generation will fail"
fi

# ── Launch ────────────────────────────────────────────────────────────────────
log "All packages verified — launching uvicorn on port 8000..."
cd /home/site/wwwroot
exec $VENV/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
