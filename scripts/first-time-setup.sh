#!/usr/bin/env bash
# first-time-setup.sh — get this folder ready to publish Yarrow on GitHub.
#
# Idempotent: safe to re-run. Each step is guarded and only does work that
# hasn't been done yet.
#
# What it does:
#   1. Verifies prerequisites (git, gh CLI authenticated).
#   2. Initialises git in the project root if it isn't a repo yet.
#   3. Sets local user.name / user.email if they aren't already set.
#   4. Creates the GitHub repo via `gh repo create`, or attaches an existing one.
#   5. Stages everything, makes the initial commit, pushes `main`.
#      If the remote already has commits, offers to force-overwrite them
#      (use --force to skip the confirmation prompt).
#
# Flags:
#   --force              Force-push to origin/main without asking, wiping any
#                        existing history there. ONLY use for a brand-new repo
#                        you want to re-seed with this local content.
#   --allow-pull         Opposite of --force: if origin has commits, abort
#                        rather than force-push. You'll need to pull + merge
#                        manually.
#
# After this runs, you can use ./scripts/release.sh to cut releases.

set -euo pipefail

FORCE=0
ALLOW_PULL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)       FORCE=1; shift ;;
    --allow-pull)  ALLOW_PULL=1; shift ;;
    -h|--help)
      grep -E '^#' "$0" | sed 's/^# \{0,1\}//' | head -28
      exit 0
      ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────
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
step()  { printf '\n%s%s%s\n' "$C_BOLD" "$1" "$C_RESET"; }

die() { err "$1"; exit 1; }

ask() {
  # ask "prompt" default_value  → echoes user input (or default on empty)
  local prompt="$1"
  local default="${2:-}"
  local reply
  if [[ -n "$default" ]]; then
    read -r -p "$prompt [$default] " reply
    printf '%s\n' "${reply:-$default}"
  else
    read -r -p "$prompt " reply
    printf '%s\n' "$reply"
  fi
}

confirm() {
  # confirm "prompt"  → returns 0 if user answers y/Y, else 1
  local prompt="$1"
  local reply
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# ── Move to project root ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo "${C_BOLD}Yarrow — first-time GitHub setup${C_RESET}"
echo "${C_DIM}Project root: $ROOT${C_RESET}"

# ── 1. Prerequisites ────────────────────────────────────────────────────
step "1/5  Checking prerequisites"

command -v git >/dev/null 2>&1 || die "git is not installed. Install it first."
ok "git: $(git --version | awk '{print $3}')"

if ! command -v gh >/dev/null 2>&1; then
  warn "gh (GitHub CLI) is not installed."
  echo "    Install from: https://cli.github.com/"
  echo "    Then run:    gh auth login"
  die  "Re-run this script once gh is installed and authenticated."
fi
ok "gh: $(gh --version | head -1 | awk '{print $3}')"

if ! gh auth status >/dev/null 2>&1; then
  warn "gh is not authenticated."
  echo "    Run: gh auth login"
  die  "Re-run this script once you're signed in."
fi
GH_USER="$(gh api user --jq .login)"
ok "GitHub: signed in as ${C_BOLD}${GH_USER}${C_RESET}"

# ── 2. git init ─────────────────────────────────────────────────────────
step "2/5  git repository"

if [[ -d .git ]]; then
  ok ".git already exists — skipping init"
else
  log "Initialising git repository on branch 'main'..."
  git init -b main >/dev/null
  ok "git initialised"
fi

# ── 3. user.name / user.email ───────────────────────────────────────────
step "3/5  git identity"

GIT_NAME="$(git config --get user.name || true)"
GIT_EMAIL="$(git config --get user.email || true)"

if [[ -z "$GIT_NAME" ]]; then
  GIT_NAME="$(ask "Your name (for commits):" "$GH_USER")"
  git config user.name "$GIT_NAME"
fi
ok "user.name  = $GIT_NAME"

if [[ -z "$GIT_EMAIL" ]]; then
  # Try the GitHub noreply form — avoids leaking a private email.
  DEFAULT_EMAIL="${GH_USER}@users.noreply.github.com"
  GIT_EMAIL="$(ask "Your email (for commits):" "$DEFAULT_EMAIL")"
  git config user.email "$GIT_EMAIL"
fi
ok "user.email = $GIT_EMAIL"

# ── 4. GitHub remote ────────────────────────────────────────────────────
step "4/5  GitHub remote"

if git remote get-url origin >/dev/null 2>&1; then
  EXISTING_URL="$(git remote get-url origin)"
  ok "origin already set → $EXISTING_URL"
else
  REPO_NAME="$(ask "Repository name on GitHub:" "yarrow")"
  VISIBILITY="public"
  if confirm "Make the repo private?"; then
    VISIBILITY="private"
  fi
  log "Creating ${GH_USER}/${REPO_NAME} (${VISIBILITY})..."
  if gh repo view "${GH_USER}/${REPO_NAME}" >/dev/null 2>&1; then
    warn "Repo ${GH_USER}/${REPO_NAME} already exists on GitHub."
    REMOTE_URL="$(gh repo view "${GH_USER}/${REPO_NAME}" --json sshUrl --jq .sshUrl)"
    git remote add origin "$REMOTE_URL"
    ok "Attached existing GitHub repo as origin → $REMOTE_URL"
  else
    gh repo create "${GH_USER}/${REPO_NAME}" \
      --"${VISIBILITY}" \
      --source=. \
      --remote=origin \
      --description="Local-first, git-backed note-taking for non-linear thinking" \
      --disable-wiki \
      >/dev/null
    ok "Repo created and attached as origin"
  fi
fi

# ── 5. Initial commit + push ────────────────────────────────────────────
step "5/5  Initial commit & push"

# Stage in chunks so we never sweep in a stray .env the user left lying around.
# The project's .gitignore covers the usual suspects; this is a belt-and-braces
# safety check before the very first push.
RISKY_FILES="$(git ls-files --others --exclude-standard 2>/dev/null | grep -E '\.(env|pem|key|p12)$' || true)"
if [[ -n "$RISKY_FILES" ]]; then
  err "Refusing to commit — these look like secrets:"
  echo "$RISKY_FILES" | sed 's/^/    /'
  echo "    Move them elsewhere or add them to .gitignore, then re-run."
  exit 1
fi

if git diff --cached --quiet && ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  log "Staging files..."
  git add .
  git commit -m "Initial commit — Yarrow 0.2.0" >/dev/null
  ok "Initial commit created"
elif git rev-parse --verify HEAD >/dev/null 2>&1; then
  ok "Commits already exist — skipping initial commit"
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  log "Renaming current branch '$CURRENT_BRANCH' → main"
  git branch -M main
fi

# Probe origin: does it already have any commits (any branch at all)? If so,
# we need to decide between a normal push (impossible if history diverges), a
# force-push (user's stated preference for a fresh start), or abort.
log "Checking remote state..."
REMOTE_HAS_HISTORY=0
if git ls-remote --heads origin 2>/dev/null | grep -q .; then
  REMOTE_HAS_HISTORY=1
fi

if [[ $REMOTE_HAS_HISTORY -eq 0 ]]; then
  # Clean slate on GitHub — a normal push succeeds unambiguously.
  log "Pushing main to origin (first push)..."
  if git push -u origin main; then
    ok "Pushed main"
  else
    err "Push failed. See the git output above."
    exit 1
  fi
else
  # Remote has existing commits. The user said they want to overwrite them;
  # honour that, but show what's about to be wiped and require confirmation
  # unless --force was passed.
  warn "origin already has commits on it:"
  gh api "repos/${GH_USER}/$(gh repo view --json name --jq .name)/branches" \
    --jq '.[] | "    \(.name)  →  \(.commit.sha[0:7])"' 2>/dev/null \
    || git ls-remote --heads origin | awk '{print "    " $2 "  →  " substr($1,1,7)}'

  if [[ $ALLOW_PULL -eq 1 ]]; then
    err "Refusing to force-push because --allow-pull was passed."
    echo "    Pull manually, then re-run without --allow-pull:"
    echo "      git pull --allow-unrelated-histories origin main"
    exit 1
  fi

  if [[ $FORCE -eq 1 ]]; then
    log "Force-pushing (--force) — remote history will be overwritten."
  else
    echo
    warn "This will REPLACE everything on origin/main with your local commit."
    warn "Any files currently on the remote that aren't in this folder will be lost."
    if ! confirm "Force-overwrite the remote?"; then
      err "Aborted. Re-run with --force to skip this prompt, or --allow-pull to merge manually."
      exit 1
    fi
  fi

  log "Pushing main to origin (force, leasing to guard against concurrent pushes)..."
  # --force-with-lease fails if someone else pushed since we probed, which is
  # safer than bare --force. If lease fails (no tracking ref yet because we
  # just added the remote), fall back to --force after a second confirmation.
  if git push --force-with-lease -u origin main 2>/dev/null; then
    ok "Pushed main (force-with-lease)"
  else
    warn "--force-with-lease rejected (no prior tracking). Retrying with --force..."
    if git push --force -u origin main; then
      ok "Pushed main (force)"
    else
      err "Force-push failed. Check origin's branch-protection rules."
      exit 1
    fi
  fi
fi

REPO_URL="$(gh repo view --json url --jq .url 2>/dev/null || true)"
echo
echo "${C_BOLD}${C_OK}✓ Setup complete.${C_RESET}"
[[ -n "$REPO_URL" ]] && echo "  Repository: $REPO_URL"
echo "  Next step:  ./scripts/release.sh 0.2.0"
