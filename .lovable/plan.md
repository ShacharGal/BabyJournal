

## Baby Journal App - Phase 1: Foundation & Google Drive Prototype

### 🎯 Goal
Build a working prototype that proves the Google Drive integration works, with a solid database structure that supports all future features. **Single-user app** - no authentication needed.

---

### 📊 Database Structure (Supabase)

**Simplified tables (no user auth):**

| Table | Purpose |
|-------|---------|
| `babies` | One record per baby, stores name + Drive folder ID |
| `entries` | All memories - links to Drive files + metadata |
| `tags` | Reusable tags (e.g., "first smile", "milestone") |
| `entry_tags` | Many-to-many relationship for flexible tagging |
| `google_tokens` | Store OAuth refresh token (single row) |

**Entry fields:** type (photo/video/audio/text), description, date, drive_file_id, thumbnail_url, duration (for audio/video)

---

### 🔗 Google Drive Integration

**One-time setup you'll do:**
1. Create a Google Cloud project
2. Enable Drive API
3. Set up OAuth consent screen (just for yourself)
4. Create OAuth credentials
5. Add client ID/secret to Supabase secrets

**App behavior:**
- Connect once with your Google account
- Store refresh token in database
- Auto-create "BabyJournal/{BabyName}" folders
- Upload media directly to Drive
- Store file references in Supabase

---

### 🖥️ Prototype UI (Functional, not fancy)

1. **Google Drive Connect** - One-click OAuth, shows connection status
2. **Add Baby** - Name input → creates folder in Drive
3. **Upload Entry** - Select file + add description/tags → uploads to Drive + saves metadata
4. **Simple List View** - Shows all entries with thumbnails/previews
5. **Basic Search** - Filter by text, tags, or date range

---

### 🧱 Modular Edge Functions

| Function | Purpose |
|----------|---------|
| `drive-auth` | OAuth flow + token refresh |
| `drive-upload` | Upload files to correct baby folder |
| `drive-folder` | Create/manage folders |
| `entries-crud` | Create, read, update, delete entries |
| `search` | Query entries (future: add AI semantic search) |

Each function is independent and can be upgraded without affecting others.

---

### 🚀 For Your Friend Later

When duplicating for a friend:
1. Fork the repository
2. Create new Supabase project
3. Run database migrations
4. Set up their own Google Cloud credentials
5. They connect their own Google Drive

Each instance is completely independent!

