# BabyJournal

A beautiful, private baby memory journal app. Save photos, videos, audio recordings, and text memories for your little ones — all stored securely on your own Google Drive.

## Deploy Your Own

Want your own BabyJournal for your family? No programming needed!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FShacharGal%2FBabyJournal&env=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY&envDescription=You%20will%20get%20these%20values%20from%20Supabase%20in%20Phase%202.%20Enter%20placeholder%20values%20for%20now%20and%20update%20later.&envLink=https%3A%2F%2Fgithub.com%2FShacharGal%2FBabyJournal%2Fblob%2Fmain%2FSETUP.md%23step-42--set-vercel-environment-variables&project-name=baby-journal&repository-name=baby-journal)

**[Follow the full setup guide here (SETUP.md)](SETUP.md)** — step-by-step instructions with an AI assistant prompt to help you through any part.

## Features

- **4 memory types**: Photos, videos, audio recordings (record in-app!), and text notes
- **Google Drive storage**: Files stored in your own Google Drive (15 GB free)
- **Multiple children**: Track memories for more than one baby
- **Tags and search**: Tag memories and filter by text, date, media type, or contributor
- **Favorites**: Heart your favorite memories — each family member has their own favorites list
- **Family sharing**: Add family members with 3 permission levels (full, add, view-only)
- **Timeline view**: Browse memories grouped by month with automatic age calculation
- **Dialogue mode**: Special formatting for funny quotes and conversations
- **Works on any device**: Mobile-friendly design, accessible from any browser

## Tech Stack

- React + TypeScript + Vite
- shadcn/ui + Radix UI + Tailwind CSS
- Supabase (database, storage, edge functions)
- Google Drive API (file storage via OAuth 2.0)
- Vercel (hosting)

## Development

```bash
npm install          # Install dependencies
npm run dev          # Local dev server
npm run build        # Production build
npm run lint         # ESLint
```
