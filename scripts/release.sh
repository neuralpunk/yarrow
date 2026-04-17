#!/usr/bin/env bash
# release.sh — cut a Yarrow release.
#
# Usage:  ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.2.0
#
# What it does:
#   1. Verifies the working tree is clean and you're on `main`.
#   2. Syncs the version in package.json, src-tauri/Cargo.toml, and
#      src-tauri/tauri.conf.json to <version>.
#   3. Commits that bump if any file actually changed.
#   4. Creates an annotated tag v<version>.
#   5. Pushes main + the tag. That triggers .github/workflows/release.yml,
#      which builds on macOS, Ubuntu, and Windows runners in parallel and
#      attaches the bundles to a GitHub Release.
#
# Flags:
#   --dry-run        Do everything except commit, tag, and push.
#   --allow-dirty    Skip the clean-working-tree check (use sparingly).
#   --no-bump        Don't edit version files; fail if they don't already match.

set -euo pipefail

C_RESET=$'\033[0m'
C_DIM=$'\033[2m'
C_BOLD=$'\033[1m'
C_OK=$'\033[32m'
C_WARN=$'\033[33m'
C_ERR=$'\033[31m'
C_INFO=$'\033[36m'

log()   { printf '%s→%s %s\n' "$C_INFO" "$C_RESET" "$1"; }
ok()    { printf '%s✓%s %s\n' "$C_OK"   "$C_RESET" "$1"; }
warn()  { printf '%s!%s %s\n' "$C_WARN" "$C_RESET" "$1"; }
err()   { printf '%s✗%s %s\n' "$C_ERR"  "$C_RESET" "$1" >&2; }
die()   { err "$1"; exit 1; }

# ── Parse arguments ──────────────────────────────────────────────────────
DRY_RUN=0
ALLOW_DIRTY=0
NO_BUMP=0
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)     DRY_RUN=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --no-bump)     NO_BUMP=1; shift ;;
    -h|--help)
      grep -E '^#' "$0" | sed 's/^# \{0,1\}//' | head -30
      exit 0
      ;;
    -*)
      die "Unknown flag: $1"
      ;;
    *)
      if [[ -n "$VERSION" ]]; then
        die "Extra argument: $1 (version already set to $VERSION)"
      fi
      VERSION="$1"; shift ;;
  esac
done

[[ -z "$VERSION" ]] && die "Usage: $(basename "$0") <version>   (e.g. 0.2.0)"

# Strict semver-ish match. Allow pre-release suffixes like 0.2.0-rc1.
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?$ ]]; then
  die "Version must look like MAJOR.MINOR.PATCH (optionally -PRERELEASE). Got: $VERSION"
fi

TAG="v${VERSION}"

# ── Move to project root ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo "${C_BOLD}Releasing Yarrow ${VERSION}${C_RESET}"
echo "${C_DIM}Project root: $ROOT${C_RESET}"
[[ $DRY_RUN -eq 1 ]] && warn "DRY RUN — no commits, tags, or pushes will happen"

# ── Sanity: git repo + gh cli ───────────────────────────────────────────
[[ -d .git ]] || die "Not a git repo. Run ./scripts/first-time-setup.sh first."

if ! git remote get-url origin >/dev/null 2>&1; then
  die "No 'origin' remote configured. Run ./scripts/first-time-setup.sh."
fi

command -v gh >/dev/null 2>&1 || warn "gh CLI not found — won't be able to watch the release workflow."

# ── Clean working tree ──────────────────────────────────────────────────
if [[ $ALLOW_DIRTY -eq 0 ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    err "Working tree has uncommitted changes:"
    git status --short
    echo
    die "Commit or stash them first (or pass --allow-dirty)."
  fi
fi

# ── Must be on main ─────────────────────────────────────────────────────
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  warn "You're on '$BRANCH', not 'main'. Releases from non-main branches are unusual."
  read -r -p "Continue anyway? [y/N] " REPLY
  [[ "$REPLY" =~ ^[Yy]$ ]] || die "Aborted."
fi

# ── Tag collision ───────────────────────────────────────────────────────
if git rev-parse --verify "refs/tags/${TAG}" >/dev/null 2>&1; then
  die "Tag ${TAG} already exists locally. Delete it first: git tag -d ${TAG}"
fi

if git ls-remote --tags origin "${TAG}" | grep -q "${TAG}"; then
  die "Tag ${TAG} already exists on origin. Pick a new version."
fi

# ── Bump version strings ────────────────────────────────────────────────
bump_package_json() {
  # package.json — the "version": "..." line at top-level.
  local file="$1"
  if grep -q "\"version\": \"${VERSION}\"" "$file"; then
    ok "  $file already at $VERSION"
    return 0
  fi
  if [[ $NO_BUMP -eq 1 ]]; then
    die "$file is not at $VERSION and --no-bump was passed."
  fi
  log "  Updating $file"
  # Match the first "version" key only (they're the root-level key in npm packages).
  # Portable sed in-place: BSD sed (macOS) needs a backup suffix; GNU doesn't.
  if sed --version >/dev/null 2>&1; then
    sed -i -E "0,/\"version\":\s*\"[^\"]+\"/s//\"version\": \"${VERSION}\"/" "$file"
  else
    sed -i '' -E "1,/\"version\":[[:space:]]*\"[^\"]+\"/s//\"version\": \"${VERSION}\"/" "$file"
  fi
}

bump_cargo_toml() {
  local file="$1"
  if grep -q "^version = \"${VERSION}\"" "$file"; then
    ok "  $file already at $VERSION"
    return 0
  fi
  if [[ $NO_BUMP -eq 1 ]]; then
    die "$file is not at $VERSION and --no-bump was passed."
  fi
  log "  Updating $file"
  # Only the [package] version — bare `version = "x.y.z"` on its own line.
  if sed --version >/dev/null 2>&1; then
    sed -i -E "0,/^version = \"[^\"]+\"/s//version = \"${VERSION}\"/" "$file"
  else
    sed -i '' -E "1,/^version = \"[^\"]+\"/s//version = \"${VERSION}\"/" "$file"
  fi
}

bump_tauri_conf() {
  local file="$1"
  if grep -q "\"version\": \"${VERSION}\"" "$file"; then
    ok "  $file already at $VERSION"
    return 0
  fi
  if [[ $NO_BUMP -eq 1 ]]; then
    die "$file is not at $VERSION and --no-bump was passed."
  fi
  log "  Updating $file"
  if sed --version >/dev/null 2>&1; then
    sed -i -E "0,/\"version\":\s*\"[^\"]+\"/s//\"version\": \"${VERSION}\"/" "$file"
  else
    sed -i '' -E "1,/\"version\":[[:space:]]*\"[^\"]+\"/s//\"version\": \"${VERSION}\"/" "$file"
  fi
}

log "Syncing version to $VERSION..."
bump_package_json "package.json"
bump_cargo_toml   "src-tauri/Cargo.toml"
bump_tauri_conf   "src-tauri/tauri.conf.json"

# If we actually changed files, commit the bump.
if ! git diff --quiet package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json; then
  if [[ $DRY_RUN -eq 1 ]]; then
    log "(dry-run) would commit: 'chore: bump version to ${VERSION}'"
  else
    log "Committing version bump..."
    git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
    git commit -m "chore: bump version to ${VERSION}" >/dev/null
    ok "Version bump committed"
  fi
else
  ok "No version changes needed"
fi

# ── Tag ──────────────────────────────────────────────────────────────────
log "Tagging ${TAG}..."
if [[ $DRY_RUN -eq 1 ]]; then
  log "(dry-run) would create annotated tag ${TAG}"
else
  git tag -a "${TAG}" -m "Yarrow ${VERSION}"
  ok "Tag ${TAG} created"
fi

# ── Push ─────────────────────────────────────────────────────────────────
log "Pushing main and ${TAG} to origin..."
if [[ $DRY_RUN -eq 1 ]]; then
  log "(dry-run) would: git push origin main && git push origin ${TAG}"
else
  git push origin main
  git push origin "${TAG}"
  ok "Pushed"
fi

# ── Point at the workflow ───────────────────────────────────────────────
echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "${C_BOLD}(dry run)${C_RESET} — nothing actually changed."
  exit 0
fi

echo "${C_BOLD}${C_OK}✓ Release tagged and pushed.${C_RESET}"
echo "  GitHub Actions is now building macOS, Linux, and Windows bundles."
echo

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  RUN_URL="$(gh run list --workflow=release.yml --branch main --limit 1 --json url --jq '.[0].url' 2>/dev/null || true)"
  REPO_URL="$(gh repo view --json url --jq .url 2>/dev/null || true)"
  [[ -n "$RUN_URL" ]]  && echo "  Watch build: $RUN_URL"
  [[ -n "$REPO_URL" ]] && echo "  Release:     ${REPO_URL}/releases/tag/${TAG}"
  echo
  echo "${C_DIM}Tip: run 'gh run watch' to tail the build live.${C_RESET}"
else
  echo "  Check progress at: https://github.com/$(git remote get-url origin | sed -E 's|.*github.com[:/]([^/]+/[^/.]+).*|\1|')/actions"
fi
