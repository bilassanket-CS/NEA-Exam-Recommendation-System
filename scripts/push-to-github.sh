#!/usr/bin/env bash
# Usage: bash scripts/push-to-github.sh <github-username> [repo-name]
# Creates the remote, sets main as the default branch and pushes.
# Prerequisite: create an EMPTY repo on GitHub first (no README/licence),
# or install the GitHub CLI (gh) and this script can create it for you.
set -e
USER="${1:?Provide your GitHub username}"
REPO="${2:-exam-question-recommendation-system}"

if command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI found - creating repo and pushing..."
  gh repo create "$USER/$REPO" --public --source=. --remote=origin --push
else
  echo "Setting remote and pushing (create the empty repo on github.com first)..."
  git remote add origin "https://github.com/$USER/$REPO.git" 2>/dev/null || \
    git remote set-url origin "https://github.com/$USER/$REPO.git"
  git branch -M main
  git push -u origin main
fi
echo "Done."
