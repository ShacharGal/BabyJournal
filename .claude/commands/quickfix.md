---
description: Quick bug fix — fix and deploy in one shot.
allowed-tools: Bash(npm run build:*), Bash(git:*), Read, Edit, Write, Grep, Glob
---

# Quick Fix

The user described a bug: $ARGUMENTS

## Steps
1. Investigate the bug — read relevant files, understand the issue
2. Fix it with minimal changes
3. Run `npm run build` — must pass
4. Increment the build version in `src/main.tsx`
5. Commit with message: "Fix: $ARGUMENTS"
6. Push to main: `git push origin main`
7. Report: "Fixed and pushed. Vercel deploying. Check Build vN in console after hard-refresh."
