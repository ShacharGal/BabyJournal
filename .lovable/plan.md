

## Diagnosis

I've traced the full flow and found the root cause.

**The problem:** Your edge function dynamically determines the `redirect_uri` from the request's `Origin` header. When you browse via the Lovable editor, the preview loads at `https://6702f4cb-498b-4d9e-80be-b9cdeecfd235.lovableproject.com`, so the function sends that as the redirect URI to Google. But your Google Cloud Console screenshot shows only the `.lovable.app` domain is configured as an authorized redirect URI.

Even though you said you added the `.lovableproject.com` domain, Google's 403 "you do not have access to this page" error (rather than a `redirect_uri_mismatch`) specifically suggests one of two things:
1. The redirect URI is still not matching exactly (e.g., trailing slash, typo, or it wasn't saved)
2. The test user addition hasn't propagated yet (can take a few minutes)

**The fix has two parts:**

### Part 1 — Verify Google Cloud Console (manual)
In your Google Cloud Console credentials, ensure **both** of these are present as **Authorized redirect URIs** (no trailing slash):
- `https://id-preview--6702f4cb-498b-4d9e-80be-b9cdeecfd235.lovable.app`
- `https://6702f4cb-498b-4d9e-80be-b9cdeecfd235.lovableproject.com`

And **both** as **Authorized JavaScript origins** too.

Also double check under OAuth consent screen → Test users that your Gmail address is listed. Try removing and re-adding it.

### Part 2 — Code fix: make redirect URI explicit
Instead of relying on the `Origin` header (which changes depending on where you access the app), update `drive-auth/index.ts` to accept the redirect URI from the frontend, so it always matches exactly what the browser URL is.

**Changes:**
- `src/components/GoogleDriveConnect.tsx`: Pass `window.location.origin` as `redirectUri` in the `get-auth-url` and `exchange-code` calls
- `src/hooks/useGoogleDrive.ts`: Accept and forward `redirectUri` parameter in both `useInitiateGoogleAuth` and `useExchangeGoogleCode`
- `supabase/functions/drive-auth/index.ts`: Read `redirectUri` from the request body instead of deriving it from the `Origin` header

This ensures the redirect URI sent to Google always matches the actual browser URL, regardless of which domain variant is being used.

### Technical detail
```text
Current flow:
  Browser (lovableproject.com) → edge fn reads Origin header → sends redirect_uri to Google
  Google checks: "Is lovableproject.com in authorized URIs?" → 403

Fixed flow:
  Browser sends window.location.origin → edge fn forwards it as redirect_uri
  Same URI used for both auth URL generation AND code exchange → consistent match
```

