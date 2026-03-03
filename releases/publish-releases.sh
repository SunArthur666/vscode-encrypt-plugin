#!/usr/bin/env bash
# Publish all VSIX in releases/ to GitHub Releases (oldest first so newest appears on top).
# Requires: gh (GitHub CLI), run from repo root after: gh auth login

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

get_commit() {
  case "$1" in
    1.1.0) echo "d56abec0700fb8d268668936f35173cd5d45565a" ;;
    1.2.0) echo "494447a030fd6c44d5df7be2a6f18da72bfee167" ;;
    2.0.0) echo "57943f33643147cee0855375758abe022129bbec" ;;
    *) echo "" ;;
  esac
}

# Ask whether to overwrite existing releases
echo "Overwrite existing GitHub Releases if they already exist? [y/N] "
read -r answer
case "$answer" in
  [yY][eE][sS]|[yY]) FORCE=1 ;;
  *) FORCE=0 ;;
esac
echo ""

# Versions in ascending order so newest (2.0.0) is created last and appears on top
VERSIONS=(1.1.0 1.2.0 2.0.0)

for ver in "${VERSIONS[@]}"; do
  dir="releases/v${ver}"
  vsix="${dir}/vscode-encrypt-${ver}.vsix"
  notes="${dir}/vscode-encrypt-${ver}.vsix.md"
  commit="$(get_commit "$ver")"

  if [[ ! -f "$vsix" ]]; then
    echo "Skip: $vsix not found"
    continue
  fi
  if [[ ! -f "$notes" ]]; then
    echo "Skip: $notes not found"
    continue
  fi

  # Check if release already exists
  if gh release view "v${ver}" &>/dev/null; then
    if [[ "$FORCE" -eq 1 ]]; then
      echo "Deleting existing release and tag v${ver}..."
      gh release delete "v${ver}" --yes
      # Also delete the remote tag so --target can recreate it correctly
      git push origin ":refs/tags/v${ver}" 2>/dev/null || true
    else
      echo "Skip: release v${ver} already exists"
      continue
    fi
  fi

  # Ensure local tag points to the correct commit, then push
  git tag -f "v${ver}" "$commit"
  git push origin "v${ver}" --force

  echo "Creating release v${ver} (commit: ${commit:0:7})..."
  gh release create "v${ver}" "$vsix" \
    --title "v${ver}" \
    --notes-file "$notes"
  echo "Done v${ver}."
done

echo ""
echo "All releases published."
