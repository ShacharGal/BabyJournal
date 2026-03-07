#!/bin/bash
# BabyJournal deploy helper
# Usage: ./deploy.sh              (auto-finds latest claude/ branch)
#        ./deploy.sh branch-name  (deploy a specific branch)

set -e

REPO="ShacharGal/BabyJournal"
SUPABASE_PROJECT="mcbhiwqtzdjkwqbljjdq"

# 1. Find the Claude branch (use argument, or find the one with actual new commits)
echo "=== Step 1: Finding branch to deploy ==="
git fetch origin

if [ -n "$1" ]; then
  BRANCH="$1"
  echo "Using specified branch: $BRANCH"
else
  # Find claude/ branches that have commits ahead of main
  BRANCH=""
  for b in $(git branch -r | grep 'origin/claude/' | sed 's|origin/||' | xargs); do
    AHEAD=$(git rev-list --count "origin/main..origin/$b" 2>/dev/null || echo "0")
    if [ "$AHEAD" -gt 0 ]; then
      BRANCH="$b"
      echo "Found branch with $AHEAD new commit(s): $b"
      break
    fi
  done
fi

if [ -z "$BRANCH" ]; then
  echo "No deployable claude/ branch found (all are already merged)."
  exit 1
fi

# 2. Sync branch with main (prevents merge conflicts)
echo ""
echo "=== Step 2: Syncing $BRANCH with main ==="
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull origin "$BRANCH" --rebase 2>/dev/null || true

if ! git rebase origin/main; then
  echo "ERROR: Rebase conflict. Run 'git rebase --abort' and resolve manually."
  exit 1
fi

git push origin "$BRANCH" --force-with-lease

# 3. Deploy Supabase edge functions (if any changed)
echo ""
echo "=== Step 3: Deploying Supabase edge functions ==="
if [ -d "supabase/functions" ]; then
  CHANGED_FUNCS=$(git diff --name-only origin/main..."origin/$BRANCH" -- supabase/functions/ 2>/dev/null | grep -o 'supabase/functions/[^/]*' | sort -u)
  if [ -n "$CHANGED_FUNCS" ]; then
    for func_path in $CHANGED_FUNCS; do
      func_name=$(basename "$func_path")
      echo "Deploying changed function: $func_name"
      npx supabase functions deploy "$func_name" --project-ref "$SUPABASE_PROJECT"
    done
  else
    echo "No edge function changes, skipping."
  fi
else
  echo "No supabase/functions directory, skipping."
fi

# 4. Create PR if needed
echo ""
echo "=== Step 4: Creating/finding PR ==="
PR=$(gh pr list --repo "$REPO" --head "$BRANCH" --json number --jq '.[0].number')

if [ -z "$PR" ] || [ "$PR" = "null" ]; then
  echo "Creating PR..."
  PR_URL=$(gh pr create --repo "$REPO" --base main --head "$BRANCH" \
    --title "$(git log --oneline -1 origin/main..HEAD | cut -d' ' -f2-)" \
    --body "Auto-deploy from $BRANCH")
  echo "Created: $PR_URL"
  PR=$(echo "$PR_URL" | grep -o '[0-9]*$')
else
  echo "Found existing PR #$PR"
fi

# 5. Merge PR
echo ""
echo "=== Step 5: Merging PR #$PR ==="
gh pr merge "$PR" --repo "$REPO" --squash --delete-branch

# 6. Switch back to main
git checkout main
git pull origin main

echo ""
echo "=== Done! ==="
echo "Vercel is now deploying from main."
echo "Your app: https://babyjournal.vercel.app"
