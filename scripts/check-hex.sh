#!/usr/bin/env bash
# Anti-regression : aucun hex code en dur dans /app ou /components.
# Le design system est defini dans tailwind.config.js et lib/theme.ts.
# Si tu vois un hit ici, deplace la couleur dans theme.ts (et tailwind
# si reutilisable) et utilise le token.
#
# Exit 1 si au moins une occurrence trouvee.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HITS=0

for dir in app components; do
  if [ -d "$ROOT/$dir" ]; then
    while IFS= read -r line; do
      HITS=$((HITS + 1))
      echo "$line"
    done < <(grep -RInE "#[0-9a-fA-F]{6}\b" "$ROOT/$dir" \
      --include='*.ts' --include='*.tsx' \
      --exclude-dir=node_modules \
      || true)
  fi
done

if [ "$HITS" -gt 0 ]; then
  echo ""
  echo "Found $HITS hex code(s) in app/ or components/."
  echo "Move them to lib/theme.ts and use a token instead."
  exit 1
fi

echo "OK — no hex codes in app/ or components/."
