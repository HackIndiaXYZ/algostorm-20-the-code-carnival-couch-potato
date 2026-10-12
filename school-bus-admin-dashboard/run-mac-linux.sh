#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js 20+ from https://nodejs.org/ then rerun this script."
  exit 1
fi
if [ ! -d node_modules ]; then npm install; fi
npm run dev
