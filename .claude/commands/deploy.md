---
description: Deploy changes to production. Run after making code changes.
allowed-tools: Bash(npm run build:*), Bash(git:*), Bash(grep:*), Read, Edit
---

# Deploy to Production

Follow these steps exactly. Stop and report if any step fails.

## Step 1: Build check
Run `npm run build`. If this fails, fix the errors and retry. Do NOT proceed with a broken build.

## Step 2: Increment build version
Read src/main.tsx. Find the line containing `[BabyJournal] Build v` and increment the number by 1. Save the file.

## Step 3: Check for edge function changes
Run: `git diff --name-only HEAD | grep "supabase/functions/"`.
Save the list of changed function names. You will report these to the user at the end.

## Step 4: Commit and push to main
```bash
git add -A
git commit -m "COMMIT_MESSAGE"
git push origin main
```
If $ARGUMENTS was provided, use it as the commit message. Otherwise, write a short descriptive message based on the changes.

## Step 5: Report to user
Tell the user clearly:

- "Pushed to main. Vercel deploying now (about 1 min)."
- "This is Build vN." (state the version number you set in step 2)
- If edge functions changed in step 3, list each one with the exact command to deploy it:
  `npx supabase functions deploy FUNCTION_NAME --project-ref mcbhiwqtzdjkwqbljjdq`
  And tell the user to verify with:
  `curl -s -o /dev/null -w "%{http_code}" https://mcbhiwqtzdjkwqbljjdq.supabase.co/functions/v1/FUNCTION_NAME`
  (Any non-404 response means it is live.)
- "To verify frontend: hard-refresh (Cmd+Shift+R), open console (Cmd+Option+J), look for Build vN."
