#!/bin/bash
# Azure App Service startup script
# Venv lives in /home (persisted across restarts, wiped on redeploy)
VENV=/home/venv

if [ ! -f "$VENV/bin/activate" ]; then
  echo "[startup] Creating venv..."
  python -m venv $VENV
fi

source $VENV/bin/activate

# Install torch CPU-only first (smaller, faster) then the rest
if ! python -c "import torch" 2>/dev/null; then
  echo "[startup] Installing torch CPU..."
  pip install torch --index-url https://download.pytorch.org/whl/cpu --quiet
fi

if ! python -c "import fastapi" 2>/dev/null; then
  echo "[startup] Installing requirements..."
  pip install -r requirements.txt --quiet
fi

echo "[startup] Starting uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
