#!/usr/bin/env bash
# Build usado no deploy da Vercel: clona o repo público, compila e monta a Build Output API v3.
# (A integração Vercel↔GitHub não estava conectada; com ela, basta o build padrão do Vite + pasta api/.)
set -euo pipefail
REF="${REPO_REF:-claude/new-session-pjg7nv}"
rm -rf _src && git clone --depth 1 -b "$REF" https://github.com/djkramuandrehotmailcomkramu-rgb/Haras-olhos-d-gua-.git _src
cd _src
git log --oneline -1
npm install --no-audit --no-fund
npm run build
OUT="$(cd .. && pwd)/.vercel/output"
rm -rf "$OUT" && mkdir -p "$OUT/static" "$OUT/functions/api"
cp -r dist/. "$OUT/static/"
for f in api/*.ts; do
  n=$(basename "$f" .ts)
  case "$n" in _*) continue;; esac
  d="$OUT/functions/api/$n.func"
  mkdir -p "$d"
  npx esbuild "$f" --bundle --platform=node --target=node22 --format=cjs --outfile="$d/index.js" --footer:js='module.exports=module.exports.default||module.exports;' --log-level=warning
  echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs","shouldAddHelpers":true,"maxDuration":60}' > "$d/.vc-config.json"
done
cat > "$OUT/config.json" <<'EOC'
{"version":3,"routes":[{"src":"/sw.js","headers":{"cache-control":"no-cache"},"continue":true},{"handle":"filesystem"},{"src":"/api/(.*)","status":404},{"src":"/(.*)","dest":"/index.html"}],"crons":[{"path":"/api/cron","schedule":"0 9 * * *"}]}
EOC
ls "$OUT/functions/api"
