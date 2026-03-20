#!/bin/bash
# Azure App Service startup script
pip install -r requirements.txt --quiet
uvicorn main:app --host 0.0.0.0 --port 8000
