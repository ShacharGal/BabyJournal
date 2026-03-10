# Setting Up Your Own BabyJournal

Welcome! This guide will walk you through setting up your very own BabyJournal app — a beautiful, private place to save your baby's memories (photos, videos, audio recordings, and text notes).

**You don't need any programming experience.** Just follow the steps below, one at a time. If you get stuck at any point, see the "Get Help from AI" section — you can paste a prompt into ChatGPT or Claude and it will guide you through whatever step you're on.

The whole setup takes about 30-45 minutes. You'll be creating free accounts on three services:

| Service | What it does | Cost |
|---------|-------------|------|
| **Vercel** | Hosts your app (the website) | Free |
| **Supabase** | Your database (stores data securely) | Free |
| **Google Cloud** | Lets the app save files to your Google Drive | Free |

When you're done, you'll have your own private app at a URL like `https://your-baby-journal.vercel.app` that only you and your family can use.

---

## Get Help from AI

If you get stuck at ANY point during setup, copy the prompt below and paste it into [Claude](https://claude.ai) or [ChatGPT](https://chat.openai.com). Tell the AI which step you're on, and it will help you through it.

<details>
<summary><strong>Click here to copy the AI Setup Assistant prompt</strong></summary>

```
I'm setting up a self-hosted web app called BabyJournal. It's a React+Vite app
that uses Supabase for database/auth and Google Drive for file storage, hosted
on Vercel. I need your help walking me through the setup.

Here's the architecture:
- Frontend: React + TypeScript + Vite, deployed on Vercel
- Backend: Supabase (PostgreSQL database, storage buckets, edge functions)
- File storage: Google Drive via OAuth 2.0
- Edge functions (Deno): drive-auth, drive-upload, drive-delete, drive-folder,
  drive-stream, photos-list, login, manage-users

The setup has 4 phases:
1. Deploy to Vercel (fork repo + deploy)
2. Set up Supabase (create project, run SQL, deploy edge functions)
3. Set up Google OAuth (create Google Cloud project, OAuth consent screen,
   credentials)
4. Connect everything (set env vars in Vercel, set secrets in Supabase)

Environment variables needed in Vercel:
- VITE_SUPABASE_URL = https://<project-ref>.supabase.co
- VITE_SUPABASE_PUBLISHABLE_KEY = the anon/public key from Supabase

Secrets needed in Supabase edge functions:
- GOOGLE_CLIENT_ID = from Google Cloud Console
- GOOGLE_CLIENT_SECRET = from Google Cloud Console

The Google OAuth consent screen should be set to "External" but kept in
"Testing" mode (no need to publish). The user just adds their own email as a
test user. Required scopes: drive.file, drive.metadata.readonly,
photoslibrary.readonly.

The authorized redirect URI in Google Cloud must match the deployed Vercel URL
(e.g., https://your-app.vercel.app).

The Supabase project needs:
- A SQL script run in the SQL Editor (provided in setup/database-setup.sql)
- Storage buckets: "thumbnails" (public) and "audio" (public) — created by the SQL
- 8 edge functions deployed via Supabase CLI

I'm currently on step: [TELL THE AI WHICH STEP YOU'RE ON]
My issue is: [DESCRIBE WHAT'S HAPPENING]

Please help me through this step by step. Be very specific — tell me exactly
what to click, what to type, and what I should see. If I share a screenshot or
error message, help me diagnose the problem.
```

</details>

---

## Phase 1: Deploy the App to Vercel

In this phase, you'll get the app running on the internet. It won't be fully functional yet (no database), but you'll be able to see it.

### Step 1.1 — Create a GitHub Account

GitHub is where the app's code lives. You need an account so Vercel can copy the code.

1. Go to [github.com/signup](https://github.com/signup)
2. Enter your email address
3. Create a password
4. Choose a username (anything you like — it won't be visible to your family)
5. Complete the verification puzzle
6. Click **Create account**
7. Check your email and enter the verification code

That's it — you now have a GitHub account. You won't need to use GitHub again after the initial setup.

### Step 1.2 — Deploy to Vercel

Click the button below. It will create your own copy of BabyJournal and deploy it automatically.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FShacharGal%2FBabyJournal&env=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY&envDescription=You%20will%20get%20these%20values%20from%20Supabase%20in%20Phase%202.%20Enter%20placeholder%20values%20for%20now%20and%20update%20later.&envLink=https%3A%2F%2Fgithub.com%2FShacharGal%2FBabyJournal%2Fblob%2Fmain%2FSETUP.md%23step-42--set-vercel-environment-variables&project-name=baby-journal&repository-name=baby-journal)

Here's what will happen:

1. **Vercel will ask you to sign up or log in.** Choose **"Continue with GitHub"** and log in with the GitHub account you just created.
2. **Vercel will ask you to install the Vercel GitHub integration.** Click **"Install"**. This lets Vercel access the code.
3. **Vercel will ask you to name the project.** Leave it as `baby-journal` or change it to whatever you like.
4. **Vercel will ask for environment variables.** You'll see two fields:
   - `VITE_SUPABASE_URL` — type `placeholder` for now
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — type `placeholder` for now
   - (We'll fill in the real values after setting up Supabase)
5. Click **Deploy**

Wait about 1 minute. Vercel will show you a "Congratulations!" screen with a link to your app. The app won't work yet (you'll see errors) — that's expected! We need to set up the database first.

**Write down your Vercel app URL** — it'll look something like:
```
https://baby-journal-abc123.vercel.app
```

You'll need this URL in Phase 3.

---

## Phase 2: Set Up Supabase (Your Database)

Supabase is your app's database — it stores all the metadata about your memories, user accounts, and settings.

### Step 2.1 — Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project** (or **Sign Up**)
3. Choose **Continue with GitHub** (use the GitHub account you just created)
4. Authorize Supabase to access your GitHub account

### Step 2.2 — Create a New Project

1. Once logged in, you'll see the Supabase dashboard
2. Click **New Project**
3. Fill in:
   - **Name**: `baby-journal` (or whatever you like)
   - **Database Password**: Click **Generate a password** and **save this password somewhere safe** (you might need it later)
   - **Region**: Choose the region closest to you
4. Click **Create new project**
5. Wait 1-2 minutes while Supabase sets up your project

### Step 2.3 — Run the Database Setup Script

This step creates all the tables and settings your app needs.

1. In the Supabase dashboard, look at the left sidebar
2. Click **SQL Editor** (it has an icon that looks like a terminal/code bracket)
3. Click **New query** (top right area)
4. Open the file `setup/database-setup.sql` from the BabyJournal code:
   - You can find it here on GitHub: go to your repository (the one Vercel created for you), navigate to `setup/database-setup.sql`, and click the **Raw** button to see the plain text
   - Or open the file from wherever you downloaded the code
5. **Copy the ENTIRE contents** of that file
6. **Paste it** into the SQL Editor in Supabase
7. Click the **Run** button (or press Ctrl+Enter / Cmd+Enter)
8. You should see a message like "Success. No rows returned" — that means it worked!

If you see any errors, copy the error message and paste it into the AI assistant prompt above. The AI can help you fix it.

### Step 2.4 — Copy Your Supabase Credentials

You'll need two values from Supabase. Here's where to find them:

1. In the Supabase dashboard, click **Project Settings** in the left sidebar (the gear icon at the bottom)
2. Click **API** in the settings menu
3. You'll see a section called **Project URL**:
   - Copy the URL — it looks like `https://abcdefghijk.supabase.co`
   - **Save this as your `VITE_SUPABASE_URL`**
4. Below that, you'll see **Project API Keys**:
   - Find the key labeled **anon / public**
   - Copy that key (it's a long string starting with `eyJ...`)
   - **Save this as your `VITE_SUPABASE_PUBLISHABLE_KEY`**
5. Also copy the **Project Reference ID** — it's in the URL of your Supabase dashboard:
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_REF
   ```
   The part after `/project/` is your project ref (looks like `abcdefghijklmnop`).
   - **Save this — you'll need it for deploying edge functions**

### Step 2.5 — Deploy Edge Functions

Edge functions are small pieces of server-side code that handle things like Google Drive uploads, user login, and user management. You need to deploy them to your Supabase project.

This is the most technical step, but just follow along:

1. **Install Node.js** (if you don't already have it):
   - Go to [nodejs.org](https://nodejs.org)
   - Download the **LTS** version (the big green button)
   - Install it (just click Next/Continue through the installer)

2. **Install the Supabase CLI**:
   - Open your computer's terminal / command prompt:
     - **Mac**: Open the app called "Terminal" (search for it in Spotlight with Cmd+Space)
     - **Windows**: Open "Command Prompt" or "PowerShell" (search for it in the Start menu)
   - Type this command and press Enter:
     ```
     npm install -g supabase
     ```
   - Wait for it to finish. You might see some warnings — that's OK.

3. **Log in to Supabase CLI**:
   - In the same terminal, type:
     ```
     npx supabase login
     ```
   - It will open a browser window. Click **Authorize** to log in.

4. **Download the code**:
   - Go to your GitHub repository (the one Vercel created for you)
   - Click the green **Code** button
   - Click **Download ZIP**
   - Unzip the downloaded file somewhere on your computer
   - In the terminal, navigate to that folder:
     ```
     cd path/to/baby-journal
     ```
     (Replace `path/to/baby-journal` with the actual path where you unzipped the files. On Mac, you can drag the folder onto the terminal window to paste its path.)

5. **Deploy all edge functions**:
   - In the terminal, run each of these commands one at a time (replace `YOUR_PROJECT_REF` with the project reference you saved in Step 2.4):
     ```
     npx supabase functions deploy drive-auth --project-ref YOUR_PROJECT_REF
     npx supabase functions deploy drive-upload --project-ref YOUR_PROJECT_REF
     npx supabase functions deploy drive-delete --project-ref YOUR_PROJECT_REF
     npx supabase functions deploy drive-folder --project-ref YOUR_PROJECT_REF
     npx supabase functions deploy drive-stream --project-ref YOUR_PROJECT_REF --no-verify-jwt
     npx supabase functions deploy photos-list --project-ref YOUR_PROJECT_REF
     npx supabase functions deploy login --project-ref YOUR_PROJECT_REF
     npx supabase functions deploy manage-users --project-ref YOUR_PROJECT_REF
     ```
   - Each command should say something like "Deployed function drive-auth". If any command fails, try running it again.

6. **Verify the functions deployed**:
   - In your browser, visit this URL (replace `YOUR_PROJECT_REF`):
     ```
     https://YOUR_PROJECT_REF.supabase.co/functions/v1/login
     ```
   - If you see anything other than a "404 Not Found" page, the functions are deployed! (You might see "unauthorized" or a JSON error — that's fine, it just means the function exists and is responding.)

---

## Phase 3: Set Up Google Drive (File Storage)

Google Drive is where your photos and videos will be stored. This step creates the connection between your app and your Google Drive account.

### Step 3.1 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your Google account (the same account whose Google Drive you want to use)
3. At the top of the page, click the project dropdown (it might say "Select a project" or show an existing project name)
4. In the popup, click **New Project** (top right of the popup)
5. Enter:
   - **Project name**: `BabyJournal` (or anything you like)
   - Leave Organization as is
6. Click **Create**
7. Wait a few seconds, then make sure your new project is selected in the dropdown at the top

### Step 3.2 — Enable the Required APIs

You need to turn on two Google APIs that the app uses.

1. In the Google Cloud Console, click the hamburger menu (the three horizontal lines, top left)
2. Go to **APIs & Services** > **Library**
3. In the search bar, type **Google Drive API**
4. Click on **Google Drive API** in the results
5. Click **Enable**
6. Go back to the Library (click the back arrow or navigate to APIs & Services > Library again)
7. Search for **Google Photos Library API**
8. Click on **Google Photos Library API**
9. Click **Enable**

### Step 3.3 — Set Up the OAuth Consent Screen

This tells Google what your app is and what it wants to access. Don't worry — this is just for your personal use.

1. In the left sidebar, go to **APIs & Services** > **OAuth consent screen**
2. Click **Get started** (or **Configure Consent Screen**)
3. Fill in:
   - **App name**: `BabyJournal`
   - **User support email**: Select your email from the dropdown
   - **Developer contact email**: Enter your email
4. Click **Next** (or **Save and Continue**)
5. On the **Scopes** screen:
   - Click **Add or remove scopes**
   - In the search/filter box, search for and check these three scopes:
     - `Google Drive API — .../auth/drive.file`
     - `Google Drive API — .../auth/drive.metadata.readonly`
     - `Photos Library API — .../auth/photoslibrary.readonly`
   - If you can't find them by searching, you can manually enter them at the bottom of the page under "Manually add scopes":
     ```
     https://www.googleapis.com/auth/drive.file
     https://www.googleapis.com/auth/drive.metadata.readonly
     https://www.googleapis.com/auth/photoslibrary.readonly
     ```
   - Click **Update** then **Save and Continue**
6. On the **Test users** screen:
   - Click **Add users**
   - Enter **your own email address** (the Google account you want to use for storing files)
   - Click **Add** then **Save and Continue**
7. Click **Back to Dashboard**

**Important**: Leave the app in **Testing** mode. Do NOT click "Publish". Testing mode is perfect for personal use — you just added yourself as a test user, so it works for you and your family.

### Step 3.4 — Create OAuth Credentials

1. In the left sidebar, go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** (top of the page)
3. Select **OAuth client ID**
4. For **Application type**, select **Web application**
5. Give it a name like `BabyJournal Web`
6. Under **Authorized redirect URIs**:
   - Click **Add URI**
   - Enter your Vercel app URL (the one from Step 1.2), for example:
     ```
     https://baby-journal-abc123.vercel.app
     ```
   - **Important**: Make sure there's NO trailing slash at the end!
7. Click **Create**
8. A popup will show your credentials:
   - **Client ID** — copy and save this (looks like `123456789-abcdefgh.apps.googleusercontent.com`)
   - **Client Secret** — copy and save this (looks like `GOCSPX-abcdefgh12345`)

**Keep these values safe — you'll need them in the next phase.**

---

## Phase 4: Connect Everything Together

Almost done! Now we connect all three services.

### Step 4.1 — Set Supabase Secrets

The edge functions need your Google credentials to work.

1. Open your terminal again (the same one from Phase 2)
2. Run these commands (replace the values with your actual credentials from Step 3.4):
   ```
   npx supabase secrets set GOOGLE_CLIENT_ID=your-client-id-here --project-ref YOUR_PROJECT_REF
   npx supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret-here --project-ref YOUR_PROJECT_REF
   ```
   (Replace `YOUR_PROJECT_REF` with your Supabase project reference from Step 2.4)

### Step 4.2 — Set Vercel Environment Variables

Now update those placeholder values you entered during deployment.

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your **baby-journal** project
3. Go to **Settings** (tab at the top)
4. Click **Environment Variables** in the left sidebar
5. You'll see the two variables you created earlier. For each one:
   - Click the three dots menu (⋯) next to the variable
   - Click **Edit**
   - Replace `placeholder` with the actual value:
     - `VITE_SUPABASE_URL` → your Supabase URL (e.g., `https://abcdefghijk.supabase.co`)
     - `VITE_SUPABASE_PUBLISHABLE_KEY` → your Supabase anon key (the long `eyJ...` string)
   - Click **Save**
6. **Redeploy the app** so it picks up the new values:
   - Go to the **Deployments** tab
   - Find the latest deployment
   - Click the three dots menu (⋯) next to it
   - Click **Redeploy**
   - Click **Redeploy** again to confirm

Wait about 1 minute for the deployment to finish.

---

## Phase 5: First Login

Your app is now live! Let's make sure everything works.

### Step 5.1 — Open Your App

1. Go to your Vercel app URL (e.g., `https://baby-journal-abc123.vercel.app`)
2. You should see a login screen

### Step 5.2 — Create Your First Admin User

The very first user needs to be created directly in the database:

1. Go to your Supabase dashboard
2. Click **Table Editor** in the left sidebar
3. Click on the **app_users** table
4. Click **Insert** > **Insert row**
5. Fill in:
   - **nickname**: Your name (e.g., "Mom" or "Dad")
   - **password**: Choose a password
   - **permission**: Type `full` (this gives you admin access)
6. Click **Save**

### Step 5.3 — Log In and Set Up

1. Go back to your app
2. Enter the nickname and password you just created
3. You should be logged in!

### Step 5.4 — Connect Google Drive

1. Once logged in, look for the **menu icon** (top right — three lines or gear icon)
2. Find the **Google Drive** section
3. Click **Connect Google Drive**
4. Google will ask you to choose an account — select the Google account you used in Phase 3
5. You may see a warning "This app isn't verified" — that's normal for personal apps:
   - Click **Advanced**
   - Click **Go to BabyJournal (unsafe)** — don't worry, this is YOUR app!
6. Click **Allow** to grant the permissions
7. You should be redirected back to your app with Google Drive connected (look for a green indicator)

### Step 5.5 — Add Your First Baby

1. Go to the menu/settings area
2. Add a baby — enter their name and (optionally) their date of birth
3. The app will automatically create a folder in your Google Drive called `BabyJournal/<baby name>`

You're all set! Try adding your first memory using the **+** button.

---

## Troubleshooting

### "Something went wrong" or blank page
- Make sure the Vercel environment variables are set correctly (Phase 4.2)
- Make sure you redeployed after changing the variables
- Open your browser's developer tools (F12 or Cmd+Option+J on Mac) and check the Console tab for error messages

### Google Drive connection fails
- Make sure the Authorized Redirect URI in Google Cloud (Step 3.4) matches your Vercel URL exactly (no trailing slash)
- Make sure you added yourself as a test user (Step 3.3, point 6)
- Make sure the Supabase secrets are set correctly (Step 4.1)

### Edge functions return errors
- Try redeploying the failing function (Step 2.5)
- Make sure the Google secrets are set (Step 4.1)

### Can't log in
- Make sure you created a user in the app_users table with `full` permission (Step 5.2)
- Password is case-sensitive — make sure it matches exactly

### Still stuck?
Copy the AI assistant prompt from the top of this guide, paste it into [Claude](https://claude.ai) or [ChatGPT](https://chat.openai.com), and describe your issue. Include any error messages you see.

---

## What Can BabyJournal Do?

Once you're set up, here's everything your app can do:

### Memory Types

You can save four types of memories:

| Type | Description |
|------|------------|
| **Photo** | Upload a photo from your phone or computer. The app reads the date from the photo's metadata automatically. You can add up to 4 additional photos to any memory. |
| **Video** | Upload a video. The app generates a thumbnail and supports streaming playback. Large files use resumable uploads so they won't fail halfway. |
| **Audio** | Record audio directly in the app (tap the microphone icon) or upload a pre-recorded audio file. Great for capturing first words, funny sounds, or lullabies. |
| **Text** | Write a text-only memory — a funny quote, a milestone description, or anything you want to remember. No file needed. |

### Special Entry Styles

- **Standard**: Normal memory with description and optional media
- **Dialogue / Quote**: For capturing conversations or funny things your kid said. Write each line as `Speaker: What they said` and it formats beautifully with bold names and italic quotes

### Tags

Tag your memories to find them later. The app comes with these default tags:

| Tag | Color | Suggested use |
|-----|-------|-------------- |
| milestone | Green | First steps, first tooth, etc. |
| first time | Amber | First time at the beach, first haircut, etc. |
| funny | Pink | Hilarious moments |
| family | Purple | Family gatherings, visits |
| outdoors | Cyan | Park visits, nature outings |

You can also **create your own tags** by typing a new name in the tag selector.

### Search and Filters

Find memories easily with powerful filtering:

- **Text search** — search by description, tag name, or who added the memory
- **Date range** — filter by start and end date
- **Media type** — show only photos, videos, audio, or text entries
- **Tags** — filter by one or more tags
- **Entry style** — filter standard vs. dialogue entries
- **Contributor** — filter by who added the memory (useful if multiple family members contribute)

### Timeline Navigation

The feed shows memories grouped by month, with the newest first. Use the **calendar grid** at the top to jump to any month — it highlights months that have memories.

Each memory card shows:
- The date and your baby's age at that time (calculated automatically from their date of birth)
- A thumbnail preview for photos/videos
- The description text (expandable)
- Who added it and which tags are attached

### Multiple Children

You can track memories for **multiple children** in the same app. Each child gets:
- Their own Google Drive folder
- An age badge calculated from their date of birth
- A dropdown filter to view one child's memories or all children together

### User Accounts and Permissions

Share the app with family members! There are three permission levels:

| Permission | What they can do |
|-----------|-----------------|
| **Full access** | Everything — add, edit, delete memories, manage users, manage children, connect Google Drive. This is the admin level. |
| **Can add** | Add new memories and edit their own. Cannot delete, manage users, or change settings. Perfect for grandparents or a nanny. |
| **View only** | Browse and search memories. Cannot add, edit, or delete anything. Perfect for extended family who just want to see the updates. |

To add family members:
1. Log in with a "Full access" account
2. Go to settings/menu
3. Find **User Management**
4. Create a new user with a nickname, password, and permission level
5. Share the nickname and password with that family member — they can log in from any device using your app URL

### Google Photos Import

The app can also browse your **Google Photos Library**, making it easy to pull in photos you've already taken without manually downloading and re-uploading them.

---

## Cost Summary

All three services have generous free tiers:

| Service | Free tier | What would use it up |
|---------|-----------|---------------------|
| **Vercel** | Unlimited for personal projects | Nothing to worry about |
| **Supabase** | 500 MB database, 1 GB storage, 500K edge function calls/month | Thumbnails and audio use storage; 1 GB is plenty for years of use |
| **Google Drive** | 15 GB | Your photos and videos; 15 GB = thousands of photos or hours of video |

For a typical family, **you will never hit these limits**. The app is designed to stay well within free tiers.

---

Enjoy documenting your baby's journey!
