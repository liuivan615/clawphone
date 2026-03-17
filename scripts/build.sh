#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies"
npm install

echo "==> Building frontend"
npm run build:web

echo "==> Building server"
npm run build:server

echo "==> Build complete"
echo "Run: npm run start"
