

## Audio Support for Memories

### Architecture Decision: Where to Store Audio

Two options exist for audio storage:

1. **Google Drive** (like photos/videos) -- requires a proxy edge function for streaming since Drive files are private, adding complexity and latency.
2. **Supabase storage bucket** (like thumbnails) -- gives direct public URLs that work natively with `<audio src="...">`. Audio clips for baby moments are typically short (seconds to a couple minutes), making file sizes very manageable.

**Recommendation: Supabase storage bucket called `audio`**. This gives native inline playback with zero auth complexity. No redirects, no proxies, just a URL in an `<audio>` tag.

### Data Model Change

A memory can have **both** a photo/video (on Drive) **and** an audio clip. This requires new columns on `entries`:

```text
entries table (new columns):
  audio_storage_path  text     -- path in the "audio" Supabase bucket
  audio_url           text     -- public URL for inline playback
  audio_file_name     text     -- original file name
  audio_file_size     integer  -- bytes
```

The existing `drive_file_id`, `file_name`, `type` columns continue to handle photo/video files. Audio becomes a separate, optional attachment on any memory.

The `type` column semantics shift slightly: it describes the *primary* media (photo/video/text). An audio clip can exist on any type.

### Storage Setup

- Create a Supabase storage bucket `audio` (public, so URLs work in `<audio>` tags).

### Upload Flow (AddMemoryDialog)

- Add a second file picker row: "Audio (optional)" accepting `audio/*`.
- On submit, if an audio file is selected, upload it to the `audio` bucket with path `{entryId}.webm` (or original extension), then save the public URL to `audio_url`.
- In edit mode: show Replace/Delete controls for audio, same pattern as the main file.

### Feed Presentation (MemoryFeed)

- If `entry.audio_url` exists, render an inline `<audio controls>` element below the description.
- Styled compactly: small play bar with the filename shown.
- If the memory has a photo thumbnail AND audio, both display: the photo card as usual, plus the audio player underneath.
- If audio-only (no photo), show a styled banner with a Mic icon and waveform visual hint, plus the audio player.

### Files to Change

1. **Database migration**: Add `audio_storage_path`, `audio_url`, `audio_file_name`, `audio_file_size` columns to `entries`. Create `audio` storage bucket (public).
2. **`src/components/AddMemoryDialog.tsx`**: Add audio file picker, upload to Supabase storage on submit, handle audio replace/delete in edit mode.
3. **`src/components/MemoryFeed.tsx`**: Render `<audio controls src={entry.audio_url}>` when present. Show Mic icon banner for audio-only entries (no thumbnail).
4. **`src/lib/audioUpload.ts`** (new): Helper to upload/delete audio files in the `audio` storage bucket.
5. **`src/hooks/useEntries.ts`**: No changes needed (select * picks up new columns automatically).

### Feed Card Variants

```text
Photo + Audio:    [thumbnail image]
                  [description, tags...]
                  [▶ ━━━━━━━━━━━ 0:42]

Audio only:       [gradient banner + 🎤 icon]
                  [description, tags...]
                  [▶ ━━━━━━━━━━━ 0:42]

Photo only:       [thumbnail image]        (unchanged)
                  [description, tags...]

Text only:        [description, tags...]   (unchanged)
```

