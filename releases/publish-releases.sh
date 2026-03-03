#!/usr/bin/env bash
# Publish all VSIX in releases/ to GitHub Releases (version descending: newest first).
# Requires: gh (GitHub CLI), run from repo root after: gh auth login

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Versions in ascending order
VERSIONS=(1.1.0 1.2.0 2.0.0)

for ver in "${VERSIONS[@]}"; do
  dir="releases/v${ver}"
  vsix="${dir}/vscode-encrypt-${ver}.vsix"
  notes="${dir}/vscode-encrypt-${ver}.vsix.md"
  if [[ ! -f "$vsix" ]]; then
    echo "Skip: $vsix not found"
    continue
  fi
  if [[ ! -f "$notes" ]]; then
    echo "Skip: $notes not found"
    continue
  fi
  echo "Creating release v${ver}..."
  gh release create "v${ver}" "$vsix" --title "v${ver}" --notes-file "$notes"
  echo "Done v${ver}."
done

echo "All releases published."
