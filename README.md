# BabyJournal

A text-first family journal for capturing the stories, moments, and milestones from your kids' childhood — before they slip away. Write down what happened, tag which kid it's about, and optionally attach a photo, video, or voice recording to bring the memory to life. Later, search through everything by text, tags, date, or who added it.

**Your files stay yours.** Photos and videos are stored in your own Google Drive (15 GB free). The app just keeps a lightweight index in a free Supabase database so you can search, filter, and browse everything instantly. The whole thing runs on free tiers — no subscriptions, no cloud bills.

## Deploy Your Own

Want your own BabyJournal for your family? No programming needed!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FShacharGal%2FBabyJournal&env=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY&envDescription=You%20will%20get%20these%20values%20from%20Supabase%20in%20Phase%202.%20Enter%20placeholder%20values%20for%20now%20and%20update%20later.&envLink=https%3A%2F%2Fgithub.com%2FShacharGal%2FBabyJournal%2Fblob%2Fmain%2FSETUP.md%23step-42--set-vercel-environment-variables&project-name=baby-journal&repository-name=baby-journal)

**[Follow the full setup guide here (SETUP.md)](SETUP.md)** — step-by-step instructions with an AI assistant prompt to help you through any part.

### Setup TL;DR

You'll create free accounts on three services (~30 min total):

1. **Vercel** — click the deploy button above, it hosts your app
2. **Supabase** — create a project, paste a SQL script, deploy 8 edge functions
3. **Google Cloud** — create an OAuth app so BabyJournal can save files to your Drive
4. **Wire them together** — paste a few keys into Vercel and Supabase

That's it. You'll have a private app at `https://your-baby-journal.vercel.app` that only your family can access.

## Features

**Writing & media**
- Text-first entries — write the story, optionally attach media
- Photo upload with automatic date extraction from EXIF metadata
- Video upload with resumable uploads for large files and streaming playback
- Record audio directly in the app (first words, funny sounds, lullabies) or upload a file
- Up to 4 additional photos per memory
- Dialogue/quote mode — format conversations and funny things your kid said

**Organization**
- Tag memories with built-in or custom tags (milestone, first time, funny, family, outdoors…)
- Track multiple children — each gets their own Drive folder and age calculation
- Timeline view grouped by month, with a calendar picker to jump to any month
- Heart your favorites — each family member gets their own favorites list

**Search**
- Full-text search across descriptions, tags, and contributors
- Filter by media type, date range, tags, entry style, or who added it
- Combine multiple filters and clear them all at once

**Family sharing**
- Three permission levels: full access, can add, view-only
- Invite family members with a simple nickname + password — they log in from any browser
- Every memory shows who added it

**Storage & privacy**
- Photos and videos stored in your own Google Drive
- Audio stored in Supabase storage
- Thumbnails auto-generated and cached
- All data stays in your own accounts — nothing shared with third parties
- Works on any device with a browser — mobile-friendly design

## Development

```bash
npm install          # Install dependencies
npm run dev          # Local dev server
npm run build        # Production build
npm run lint         # ESLint
```
