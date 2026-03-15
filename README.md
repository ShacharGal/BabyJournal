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

**Write it down, enrich it later**
- Text-first — jot down what happened, add photos or video when you have time
- Three entry styles: standard memories, dialogue/quotes (for the hilarious things kids say), and milestones (for the big firsts, shown with a star)
- Attach photos, videos, or voice recordings — record audio right in the app to capture first words and funny sounds
- Add up to 4 extra photos per memory

**Share straight from your phone**
- Install as an app (PWA) on your phone's home screen
- Share photos and videos directly from your gallery or camera into BabyJournal — no need to open the app first

**Stay in the loop**
- Push notifications when a family member adds a new memory
- Choose what you get notified about: everything, only when you're @mentioned, or nothing
- Per-device control — enable notifications on your phone but not your laptop

**Find anything**
- Full-text search across descriptions, tags, and who added it
- Filter by date range, media type, tags, entry style, or contributor
- Browse by month with a calendar picker — months with memories are highlighted
- Each memory shows your child's age at the time, calculated automatically

**Organize your way**
- Tag memories (milestone, first time, funny, family, outdoors — or create your own)
- Track multiple children in one journal, each with their own folder and age tracking
- Heart your favorites — every family member gets their own favorites list

**Built for families**
- Three permission levels: full access, can add, view-only
- Add family members with a simple nickname + password — they log in from any browser
- Every memory shows who contributed it

**Your data, your accounts**
- Photos and videos live in your own Google Drive (15 GB free)
- Everything else runs on Supabase's free tier
- Nothing is shared with third parties — you own all of it
