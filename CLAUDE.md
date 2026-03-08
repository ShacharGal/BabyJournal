# BabyJournal

## What This Is
A personal baby memory journal app. Users add memories (photos, videos, audio recordings, text) with dates, and browse them in a feed. Files are stored on Google Drive; metadata and thumbnails live in Supabase.

## Stack
- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn/ui + Radix UI + Tailwind
- **Backend**: Supabase (auth, database, storage, edge functions)
- **File storage**: Google Drive (OAuth via Supabase edge function)
- **Hosting**: Vercel (auto-deploys from `main` branch)

## Key Directories
- `src/components/` -- React components (AddMemoryDialog, MemoryFeed, AppNavBar, etc.)
- `src/hooks/` -- Custom hooks (useEntries, useGoogleDrive, useGooglePhotos, useAudioRecorder)
- `src/lib/` -- Utilities (audioUpload, thumbnails, exifDate)
- `src/integrations/supabase/` -- Supabase client and DB types
- `supabase/functions/` -- Supabase Edge Functions (drive-auth, drive-upload, drive-delete, drive-folder, photos-list, login, manage-users)

## Commands
```bash
npm run dev          # Local dev server
npm run build        # Production build (also validates TypeScript)
npm run lint         # ESLint
```

## Git and Deployment Workflow

**CRITICAL: Read this carefully. This is the number 1 source of friction.**

### Rules
1. **Always push directly to main.** Do NOT create feature branches or PRs. The user is the sole developer. Vercel auto-deploys from main.
2. **Always run npm run build before committing.** If the build fails, fix it before pushing.
3. **Every commit must include a build version marker.** The app has a version marker in src/main.tsx that logs to console on load. Increment the build number in every commit so the user can verify deployment.
4. **Supabase edge functions require separate deployment.** After modifying any file in supabase/functions/, tell the user exactly which functions to deploy and how to verify them (see After Pushing below).
5. **Never batch unrelated changes.** One logical change per commit. If fixing a bug AND adding a feature, make two commits.
6. **Add console.log debugging to new features.** Prefix logs with a tag like [DriveUpload] or [AudioRec] so they are easy to filter in browser DevTools.

### Commit and Push
```bash
npm run build                    # MUST pass
git add -A
git commit -m "Short description of change"
git push origin main             # Vercel auto-deploys
```

### After Pushing
Always tell the user ALL of the following:

1. Pushed to main. Vercel will deploy in about 1 minute.

2. If ANY edge functions were modified, list each one and give the exact deploy command:
   ```
   npx supabase functions deploy FUNCTION_NAME --project-ref mcbhiwqtzdjkwqbljjdq
   ```
   Then tell the user how to verify the edge function is live:
   ```
   curl -s -o /dev/null -w "%{http_code}" https://mcbhiwqtzdjkwqbljjdq.supabase.co/functions/v1/FUNCTION_NAME
   ```
   Any response other than 404 means the function deployed successfully.

3. Tell user to verify frontend: hard-refresh the app (Cmd+Shift+R), open browser console (Cmd+Option+J in Chrome), and look for [BabyJournal] Build vN where N matches the version just pushed.

## Supabase Details
- Project ref: mcbhiwqtzdjkwqbljjdq
- Edge functions are in supabase/functions/. Each has its own directory with an index.ts.
- The google_tokens table has RLS enabled. Client-side code CANNOT read it directly. Always use edge functions (which use the service role key) to access tokens.
- Supabase URL and keys are in src/integrations/supabase/client.ts.

## Google Drive Integration
- OAuth flow handled by drive-auth edge function
- Files upload via drive-upload edge function (supports resumable uploads for large files)
- Each baby has a drive_folder_id in the babies table
- Access tokens are stored in google_tokens (RLS-protected, use edge functions to read)
- The Google OAuth scopes include drive.file and photoslibrary.readonly

## How the User Likes to Work
- Iterative and fast: make a change, push, see it live
- Minimal friction: do not ask too many questions, just implement
- Short answers: no long explanations unless asked
- Trust the agent: make reasonable decisions without over-asking
- Voice-to-text sometimes: interpret charitably if phrasing is odd
- Not proficient with git: never ask the user to rebase, cherry-pick, or resolve merge conflicts
