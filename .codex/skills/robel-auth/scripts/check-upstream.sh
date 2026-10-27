#!/usr/bin/env bash
set -euo pipefail

echo "robel-auth upstream check"
echo "timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo

echo "1) main README"
curl -fsSL "https://raw.githubusercontent.com/robelest/convex-auth/main/README.md" >/tmp/robel-auth-main-readme.md
echo "   saved: /tmp/robel-auth-main-readme.md"

echo "2) release README"
curl -fsSL "https://raw.githubusercontent.com/robelest/convex-auth/release/README.md" >/tmp/robel-auth-release-readme.md
echo "   saved: /tmp/robel-auth-release-readme.md"

echo "3) self-hosting integration guide"
curl -fsSL "https://raw.githubusercontent.com/convex/static-hosting/main/INTEGRATION.md" >/tmp/self-hosting-integration.md
echo "   saved: /tmp/self-hosting-integration.md"

echo "4) package availability check"
if npm view @robelest/convex-auth version >/tmp/robel-auth-npm-version.txt 2>/tmp/robel-auth-npm-error.txt; then
  echo "   npm package found: $(cat /tmp/robel-auth-npm-version.txt)"
else
  echo "   npm package not available or blocked in this environment"
  echo "   see: /tmp/robel-auth-npm-error.txt"
fi

echo
echo "done"
