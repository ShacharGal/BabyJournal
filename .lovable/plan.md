
# Simple Password Login System

## Overview

A minimal login system where you manually add users in the backend. Users enter a password to log in - no email, no signup, just password.

---

## How It Works

1. **You add users** in the backend table with: password, nickname, and permission level
2. **Users see a login screen** with just a password field
3. **On login**, the system finds the matching password and logs them in
4. **Permissions control access**:
   - `full` = can add babies, upload entries, connect Drive
   - `view_only` = can only browse content

---

## Database Changes

### New Table: `app_users`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Auto-generated ID |
| password | text | Login password (you set this) |
| nickname | text | Display name shown in app |
| permission | text | Either "full" or "view_only" |
| created_at | timestamp | When user was added |

You'll add users directly in the backend by inserting rows into this table.

---

## New Backend Function

### `login` Edge Function

- Receives a password from the frontend
- Looks up matching user in `app_users` table
- Returns user info (nickname, permission) if found
- Returns error if password not found

---

## Frontend Changes

### Login Screen

When not logged in, users see:
- App title and logo
- Single password input field
- "Enter" button
- Clean, simple design

### After Login

- User's nickname shown in header
- Logout button available
- Components hidden based on permission:
  - `view_only` users don't see Add Baby, Upload Entry, or Connect Drive forms
  - `view_only` users see a "View only" badge

### Session Storage

- Login state stored in browser's localStorage
- Persists across page refreshes
- Cleared on logout

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/login/index.ts` | Verifies password and returns user |
| `src/pages/Login.tsx` | Password input screen |
| `src/hooks/useAuth.ts` | Manages login state and user info |
| `src/components/UserHeader.tsx` | Shows nickname and logout button |

### Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add Login route, check auth state |
| `src/pages/Index.tsx` | Hide edit components for view_only users |
| `src/components/AddBabyForm.tsx` | Hide if view_only |
| `src/components/UploadEntryForm.tsx` | Hide if view_only |
| `src/components/GoogleDriveConnect.tsx` | Hide if view_only |

---

## Implementation Steps

1. **Create `app_users` table** in database with password, nickname, permission columns
2. **Create `login` edge function** to verify passwords
3. **Build Login page** with password field
4. **Create useAuth hook** to manage session state
5. **Add UserHeader component** showing nickname + logout
6. **Update App.tsx** to route based on login state
7. **Update Index.tsx** to check permissions and hide components

---

## Setting Up Users

After implementation, you'll add users by inserting rows in the backend:

```text
Example users you might add:
- password: "parent123", nickname: "Mom", permission: "full"
- password: "parent456", nickname: "Dad", permission: "full"  
- password: "grandma", nickname: "Grandma", permission: "view_only"
```

---

## Technical Notes

- Passwords are stored as plain text in the database (simple approach since you control access)
- The edge function uses the service role key to query the table
- RLS policy allows only the edge function (via service role) to read the passwords
- Frontend stores only nickname and permission in localStorage (never the password)
- No signup flow - all user management is done by you in the backend
