#!/bin/bash
# BabyJournal deploy helper
# One-stop script: pull changes, deploy edge functions, merge PR, deploy frontend

set -e

REPO="ShacharGal/BabyJournal"
SUPABASE_PROJECT="mcbhiwqtzdjkwqbljjdq"

# 1. Find the Claude branch
echo "=== Step 1: Finding Claude branch ==="
BRANCH=$(git branch -r | grep 'origin/claude/' | tail -1 | sed 's|origin/||' | xargs)

if [ -z "$BRANCH" ]; then
  echo "No claude/ branch found on remote. Fetching..."
  git fetch origin
  BRANCH=$(git branch -r | grep 'origin/claude/' | tail -1 | sed 's|origin/||' | xargs)
fi

if [ -z "$BRANCH" ]; then
  echo "No claude/ branch found. Nothing to deploy."
  exit 1
fi

echo "Found branch: $BRANCH"

# 2. Ensure branch is up to date with main (prevents merge conflicts)
echo ""
echo "=== Step 2: Syncing with main ==="
git fetch origin main
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull origin "$BRANCH" --rebase 2>/dev/null || true

# Rebase onto latest main to avoid merge conflicts
if ! git rebase origin/main; then
  echo "ERROR: Rebase conflict. Run 'git rebase --abort' and resolve manually."
  exit 1
fi

# Force-push the rebased branch
git push origin "$BRANCH" --force-with-lease

# 3. Deploy Supabase edge functions (if any exist)
echo ""
echo "=== Step 3: Deploying Supabase edge functions ==="
if [ -d "supabase/functions" ]; then
  for func_dir in supabase/functions/*/; do
    func_name=$(basename "$func_dir")
    if [ -f "$func_dir/index.ts" ]; then
      echo "Deploying function: $func_name"
      npx supabase functions deploy "$func_name" --project-ref "$SUPABASE_PROJECT"
    fi
  done
  echo "All edge functions deployed."
else
  echo "No supabase/functions directory found, skipping."
fi

# 4. Create PR if one doesn't exist
echo ""
echo "=== Step 4: Creating/finding PR ==="
PR=$(gh pr list --repo "$REPO" --json number,headRefName --jq "[.[] | select(.headRefName | startswith(\"claude/\"))][0].number")

if [ -z "$PR" ] || [ "$PR" = "null" ]; then
  echo "No PR found. Creating one..."
  PR_URL=$(gh pr create --repo "$REPO" --base main --head "$BRANCH" \
    --title "Deploy: $(git log --oneline -1 | cut -d' ' -f2-)" \
    --body "Auto-deploy from $BRANCH")
  echo "Created: $PR_URL"
  PR=$(echo "$PR_URL" | grep -o '[0-9]*$')
fi

echo "Using PR #$PR"

# 5. Merge PR
echo ""
echo "=== Step 5: Merging PR #$PR ==="
gh pr merge "$PR" --repo "$REPO" --squash --delete-branch

echo ""
echo "=== Done! ==="
echo "Vercel is now deploying from main."
echo "Track deployment: https://vercel.com/dashboard"
echo "Your app: https://babyjournal.vercel.app"
