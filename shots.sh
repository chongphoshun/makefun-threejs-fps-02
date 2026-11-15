#!/bin/bash
# Capture the 4 dossier screenshots with headless Chrome (real WebGL renders of
# this repo's game code) and convert them to JPEG < 256 KiB each.
# Usage: bash shots.sh   (serves game/ on :8080 if it is not already up)
set -e
cd "$(dirname "$0")"
CH=~/workspace/x-session/chrome-extracted/opt/google/chrome/chrome
if ! curl -s -o /dev/null http://127.0.0.1:8080/index.html; then
  (node serve.ts --port 8080 > /tmp/serve.log 2>&1 &)
  sleep 2
fi
rm -f screenshots/1-start.jpg screenshots/2-play.jpg screenshots/3-buy.jpg screenshots/4-end.jpg
python3 - <<'EOF'
import json, subprocess, os
from PIL import Image
shots = json.load(open('shots.json'))
for shot in shots:
    name = shot['name']
    url = 'http://127.0.0.1:8080/index.html' + shot['query']
    png = '/tmp/shot-' + name + '.png'
    subprocess.run([
        os.path.expanduser('~/workspace/x-session/chrome-extracted/opt/google/chrome/chrome'),
        '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--no-proxy-server', '--user-data-dir=/tmp/chrome-shot-profile',
        '--window-size=1280,720', '--hide-scrollbars',
        '--virtual-time-budget=20000', '--screenshot=' + png, url,
    ], check=True, capture_output=True, timeout=180)
    img = Image.open(png).convert('RGB')
    out = 'screenshots/' + name
    img.save(out, 'JPEG', quality=85, optimize=True)
    print(name, os.path.getsize(out), 'bytes', img.size)
EOF
ls -la screenshots/
