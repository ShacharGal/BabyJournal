

## Blueprint: Transforming Family Journal into a feed-based app

Here is the recommended implementation order, reasoning, and what each phase involves.

---

### Phase 1: Layout overhaul — Feed + navigation + "Add memory" dialog
**Why first**: This is the foundation everything else builds on. Editing, thumbnails, and photo viewing all depend on the new card/feed layout existing first.

**What changes**:
- Replace the current 3-column grid layout with a single-column, vertically scrollable **memory feed** (centered, max-width ~600px, Instagram-style)
- Add a **top navigation bar** with:
  - Child selector/toggle (dropdown or tabs to switch between children)
  - Hamburger/settings menu (sheet or dropdown) containing: Google Drive connection, manage users (admin only), logout
  - Search icon that expands into a search input
- Add a **floating "+" button** (bottom center, fixed position) that opens a **Dialog** with the full "Add Memory" form
  - Pre-fill the child field with whichever child is currently selected in the nav
- Move `AddChildForm` into the settings menu/sheet (it's a one-time action, doesn't belong on the main screen)

**Components affected**: `Index.tsx` (full rewrite of layout), `UploadEntryForm` (move into a Dialog), `EntryList` (restyle as feed cards), new `AppNavBar` component, `ChildList` (becomes a dropdown/popover in nav)

---

### Phase 2: Edit memories
**Why second**: Now that we have the feed with individual memory cards and the "Add Memory" dialog, we reuse the same dialog for editing.

**What changes**:
- Add a pencil icon button on each memory card (visible to editors)
- Clicking it opens the same Add Memory dialog, but pre-populated with the existing memory's data (description, date, tags, child, file info)
- Add an `useUpdateEntry` mutation in `useEntries.ts` that updates the entry and re-syncs tags
- The dialog gets a mode prop: `"create"` vs `"edit"` — in edit mode it calls update instead of insert

---

### Phase 3: Thumbnails — discuss and implement
**Why third**: With the feed looking good, we can enhance it visually. This is a discussion + implementation step.

**Discussion points**:
- Google Drive's `thumbnailLink` requires an authenticated request — it's not a public URL, so it won't render in an `<img>` tag directly
- **Options**:
  - (A) Use the Drive API to generate a **public shareable link** for each photo and store that — simplest but makes photos semi-public
  - (B) Create a backend function that **proxies** the thumbnail: the app calls your edge function, which fetches from Drive with the stored access token and returns the image — keeps photos private but adds latency
  - (C) Store a **small thumbnail copy** in your own storage bucket at upload time — fastest loading, fully private, small storage cost
- Recommendation: Option C (store thumbnails in a storage bucket) gives the best UX and works offline from Drive

---

### Phase 4: Seamless photo viewing in feed
**Why fourth**: Depends on the thumbnail/photo strategy from Phase 3.

**What changes**:
- When a memory has a photo, show it directly in the feed card (not behind a link)
- Clicking the photo opens a **full-screen lightbox** (Dialog with the full-res image)
- The image source depends on Phase 3's decision:
  - If proxied: an edge function endpoint that streams the image using the stored Google token
  - If stored thumbnails: direct URL from storage bucket for the card, proxy for full-res
- Remove the current "open in Drive" link as the primary action (keep as secondary option)

---

### Phase 5: Add photos from Google Photos
**Why last**: This is a new integration (Google Photos API is separate from Drive API) and depends on the upload/display pipeline being solid.

**What changes**:
- Google Photos API requires the `photoslibrary.readonly` scope — needs to be added to the OAuth flow
- New edge function `google-photos` that:
  - Lists the user's recent Google Photos
  - Returns photo metadata + thumbnail URLs
- In the Add Memory dialog, add a "Pick from Google Photos" button that opens a picker showing recent photos
  - User selects a photo → the app copies it to Drive (into the child's folder) and creates the entry
- Alternative simpler approach: use Google Photos' sharing mechanism to get a direct URL without copying

---

### Summary: Implementation order

```text
Phase 1: Layout (feed + nav + floating add button)     ← do now
Phase 2: Edit memories                                  ← quick win after layout
Phase 3: Thumbnail strategy (discuss → implement)       ← enhances the feed
Phase 4: Seamless photo viewing                         ← depends on Phase 3
Phase 5: Google Photos integration                      ← new API scope + picker
```

Each phase is testable independently. I recommend we start with Phase 1 — the layout overhaul. Shall I proceed?

