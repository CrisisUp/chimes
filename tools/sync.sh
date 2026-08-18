#!/usr/bin/env bash
# Mirror src/ → dist/ and docs/ (GitHub Pages). Run after every change to src/.
set -euo pipefail

cd "$(dirname "$0")/.."

rsync -a --delete src/ dist/
rsync -a --delete src/ docs/
touch docs/.nojekyll

# Verify: every file in src/ must be byte-identical in dist/ and docs/.
fail=0
while IFS= read -r f; do
  for target in dist docs; do
    if ! cmp -s "src/$f" "$target/$f"; then
      echo "DIFFERS: $target/$f"
      fail=1
    fi
  done
done < <(cd src && find . -type f -not -name ".*")

# Extra files in the mirrors that src/ lacks (besides .nojekyll) are fine; flag them.
for target in dist docs; do
  while IFS= read -r f; do
    [ "$f" = ".nojekyll" ] && continue
    [ -e "src/$f" ] || echo "EXTRA in $target: $f"
  done < <(cd "$target" && find . -type f -not -name ".*")
done

if [ "$fail" -eq 0 ]; then
  echo "sync OK: dist/ and docs/ are byte-identical to src/ (plus .nojekyll in docs/)."
else
  echo "sync FAILED — see DIFFERS above."
  exit 1
fi
