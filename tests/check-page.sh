#!/bin/bash
# Serves the site locally and runs the browser checks in headless Chrome.
# Usage: bash tests/check-page.sh [suite ...]   (default: all suites)
set -u
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=$((8100 + RANDOM % 800))
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
fail=0
dump() { "$CHROME" --headless=new --disable-gpu --virtual-time-budget=8000 --window-size=1100,1400 "$@" 2>/dev/null; }

for name in ${@:-covid pfs pfs-rm brca}; do
  suite=${name%-rm}; flags=()
  [ "$name" != "$suite" ] && flags=(--force-prefers-reduced-motion)
  out=$(dump ${flags[@]+"${flags[@]}"} --dump-dom "http://127.0.0.1:$PORT/tests/harness.html?suite=$suite" | python3 -I -c '
import sys, re, json, html
m = re.search(r"<pre id=\"results\">(.*?)</pre>", sys.stdin.read(), re.S)
res = json.loads(html.unescape(m.group(1))) if m and m.group(1).startswith("{") else {"results": "FAIL never written"}
bad = {k: v for k, v in res.items() if v != "ok"}
print(f"{len(res) - len(bad)}/{len(res)} ok")
for k, v in bad.items(): print(f"  {k}: {v}")
sys.exit(1 if bad else 0)')
  status=$?
  echo "[$name] $out"
  [ $status -eq 0 ] || fail=1
done
[ $fail -eq 0 ] && echo "ALL CHECKS PASSED" || { echo "CHECKS FAILED"; exit 1; }
