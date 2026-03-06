#!/bin/bash
# BabyJournal deploy helper
# Run this after Claude pushes a branch to merge it to main and deploy

set -e

REPO="ShacharGal/BabyJournal"

# Find the latest claude/ PR
echo "Finding latest Claude PR..."
PR=$(gh pr list --repo "$REPO" --head "$(git branch -r | grep 'claude/' | tail -1 | xargs)" --json number --jq '.[0].number' 2>/dev/null || \
     gh pr list --repo "$REPO" --author "app/claude" --json number,headRefName --jq '.[0].number' 2>/dev/null || \
     gh pr list --repo "$REPO" --json number,headRefName --jq '[.[] | select(.headRefName | startswith("claude/"))][0].number')

if [ -z "$PR" ] || [ "$PR" = "null" ]; then
  echo "No Claude PR found. Listing open PRs:"
  gh pr list --repo "$REPO"
  exit 1
fi

echo "Merging PR #$PR..."
gh pr merge "$PR" --repo "$REPO" --squash --delete-branch

echo ""
echo "Merged! Vercel is now deploying from main."
echo "Track deployment: https://vercel.com/dashboard"
echo "Your app: https://babyjournal.vercel.app"
