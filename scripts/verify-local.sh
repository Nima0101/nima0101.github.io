#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
(cd .github/check && npm ci --ignore-scripts --no-audit --no-fund && npx playwright install chromium)
python3 - <<'PY'
import os
import pathlib
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
server = ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
env = os.environ.copy()
env['SITE_URL'] = f'http://127.0.0.1:{server.server_port}/'
env['SITE_ARTIFACTS'] = str(pathlib.Path('site-artifacts/local').resolve())
try:
    subprocess.run(['node', '.github/check/site.cjs'], env=env, check=True)
finally:
    server.shutdown()
    server.server_close()
PY
