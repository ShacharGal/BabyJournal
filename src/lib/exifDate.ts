/**
 * Extract the date a photo/video was taken.
 *
 * Strategy (in priority order):
 * 1. JPEG EXIF DateTimeOriginal / DateTimeDigitized / DateTime
 * 2. HEIC/HEIF EXIF (via embedded EXIF in iloc/meta boxes)
 * 3. Video creation date from MP4/MOV metadata (mvhd atom)
 * 4. File.lastModified (camera roll preserves date taken on iOS/Android)
 *
 * Returns YYYY-MM-DD string or null.
 */
export async function extractDateFromFile(file: File): Promise<string | null> {
  try {
    // Try format-specific extraction first
    if (file.type.startsWith("image/")) {
      const exifDate = await extractImageDate(file);
      if (exifDate) {
        console.log("[ExifDate] Got date from image metadata:", exifDate);
        return exifDate;
      }
    }

    if (file.type.startsWith("video/")) {
      const videoDate = await extractMp4Date(file);
      if (videoDate) {
        console.log("[ExifDate] Got date from video metadata:", videoDate);
        return videoDate;
      }
    }

    // Fallback: file.lastModified
    // On mobile camera rolls, this is typically the date the photo/video was taken.
    // Skip if it looks like "right now" (within 60s of Date.now()), which means
    // the browser didn't preserve the original timestamp.
    if (file.lastModified && Math.abs(Date.now() - file.lastModified) > 60_000) {
      const d = new Date(file.lastModified);
      const dateStr = formatDate(d);
      if (dateStr) {
        console.log("[ExifDate] Got date from file.lastModified:", dateStr);
        return dateStr;
      }
    }
  } catch (e) {
    console.warn("[ExifDate] Extraction failed:", e);
  }

  return null;
}

function formatDate(d: Date): string | null {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (y < 1900 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ──────────────────────────────────────────────
// Image EXIF extraction (JPEG + HEIC)
// ──────────────────────────────────────────────

async function extractImageDate(file: File): Promise<string | null> {
  // Read more data to handle large thumbnails or HEIC container headers
  const buffer = await file.slice(0, 512 * 1024).arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Try JPEG
  if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) {
    return extractJpegExifDate(view);
  }

  // Try HEIC/HEIF (ISOBMFF container — ftyp box starts with size + "ftyp")
  if (view.byteLength >= 8) {
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp === "ftyp") {
      return extractHeicDate(bytes);
    }
  }

  // Try brute-force: scan for EXIF header anywhere in the buffer
  return scanForExifDate(view, bytes);
}

function extractJpegExifDate(view: DataView): string | null {
  let offset = 2;
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset);

    // SOS marker — stop scanning (image data starts)
    if (marker === 0xffda) break;

    // Not a valid marker — bail
    if ((marker & 0xff00) !== 0xff00) break;

    const segLen = view.getUint16(offset + 2);

    // APP1 = 0xFFE1 (EXIF)
    if (marker === 0xffe1) {
      const result = parseExifSegment(view, offset + 4, segLen - 2);
      if (result) return result;
    }

    offset += 2 + segLen;
  }
  return null;
}

function extractHeicDate(bytes: Uint8Array): string | null {
  // HEIC stores EXIF in an "Exif" item inside the meta box.
  // Strategy: scan for the "Exif\0\0" + TIFF header pattern in the raw bytes.
  return scanForExifPattern(bytes);
}

/** Scan raw bytes for "Exif\0\0" followed by TIFF header, then parse */
function scanForExifPattern(bytes: Uint8Array): string | null {
  const len = bytes.length;
  for (let i = 0; i < len - 20; i++) {
    // Look for "Exif\0\0" (0x45 0x78 0x69 0x66 0x00 0x00)
    if (
      bytes[i] === 0x45 && bytes[i + 1] === 0x78 &&
      bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66 &&
      bytes[i + 4] === 0x00 && bytes[i + 5] === 0x00
    ) {
      // TIFF header starts at i+6
      const tiffStart = i + 6;
      if (tiffStart + 8 > len) continue;

      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const byteOrder = view.getUint16(tiffStart);
      const le = byteOrder === 0x4949;

      // Verify TIFF magic 42
      if (view.getUint16(tiffStart + 2, le) !== 42) continue;

      const ifdOffset = view.getUint32(tiffStart + 4, le);
      const ifdStart = tiffStart + ifdOffset;

      const date = searchIfdForDate(view, ifdStart, tiffStart, le);
      if (date) return date;
    }
  }
  return null;
}

function scanForExifDate(view: DataView, bytes: Uint8Array): string | null {
  return scanForExifPattern(bytes);
}

function parseExifSegment(
  view: DataView,
  start: number,
  length: number
): string | null {
  if (start + 6 > view.byteLength) return null;

  // Check "Exif\0\0" header
  const exifHeader =
    view.getUint32(start) === 0x45786966 && view.getUint16(start + 4) === 0x0000;
  if (!exifHeader) return null;

  const tiffStart = start + 6;
  if (tiffStart + 8 > view.byteLength) return null;

  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949;

  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return null;

  const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + ifdOffset;

  return searchIfdForDate(view, ifdStart, tiffStart, littleEndian);
}

function searchIfdForDate(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  le: boolean
): string | null {
  if (ifdStart + 2 > view.byteLength) return null;

  const entryCount = view.getUint16(ifdStart, le);
  let exifIfdPointer: number | null = null;
  let dateTimeFallback: string | null = null;

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, le);

    // 0x8769 = ExifIFD pointer
    if (tag === 0x8769) {
      exifIfdPointer = view.getUint32(entryOffset + 8, le);
    }

    // 0x0132 = DateTime (fallback — this is the file modification date, not capture date)
    if (tag === 0x0132) {
      const dateStr = readExifString(view, entryOffset, tiffStart, le);
      if (dateStr) {
        dateTimeFallback = parseExifDateString(dateStr);
      }
    }
  }

  // Search ExifIFD for DateTimeOriginal (0x9003) or DateTimeDigitized (0x9004)
  if (exifIfdPointer !== null) {
    const exifIfdStart = tiffStart + exifIfdPointer;
    if (exifIfdStart + 2 <= view.byteLength) {
      const count = view.getUint16(exifIfdStart, le);
      for (let i = 0; i < count; i++) {
        const entryOffset = exifIfdStart + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) break;

        const tag = view.getUint16(entryOffset, le);
        // Prefer DateTimeOriginal (0x9003), then DateTimeDigitized (0x9004)
        if (tag === 0x9003 || tag === 0x9004) {
          const dateStr = readExifString(view, entryOffset, tiffStart, le);
          if (dateStr) {
            const parsed = parseExifDateString(dateStr);
            if (parsed) return parsed;
          }
        }
      }
    }
  }

  return dateTimeFallback;
}

function readExifString(
  view: DataView,
  entryOffset: number,
  tiffStart: number,
  le: boolean
): string | null {
  const count = view.getUint32(entryOffset + 4, le);
  if (count > 100) return null; // sanity: date strings are ~20 chars

  let strOffset: number;
  if (count <= 4) {
    strOffset = entryOffset + 8;
  } else {
    strOffset = tiffStart + view.getUint32(entryOffset + 8, le);
  }

  if (strOffset < 0 || strOffset + count > view.byteLength) return null;

  let str = "";
  for (let j = 0; j < count - 1; j++) {
    str += String.fromCharCode(view.getUint8(strOffset + j));
  }
  return str;
}

/** Parse "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD" */
function parseExifDateString(s: string): string | null {
  const match = s.match(/(\d{4}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31)
    return null;
  return `${y}-${m}-${d}`;
}

// ──────────────────────────────────────────────
// Video date extraction (MP4/MOV — mvhd atom)
// ──────────────────────────────────────────────

async function extractMp4Date(file: File): Promise<string | null> {
  try {
    // MP4/MOV store creation date in the 'mvhd' atom inside the 'moov' atom.
    // We need to find moov → mvhd → creation_time (seconds since 1904-01-01)
    const buffer = await file.slice(0, 512 * 1024).arrayBuffer();
    const view = new DataView(buffer);

    // Scan top-level atoms for 'moov'
    let offset = 0;
    while (offset + 8 <= view.byteLength) {
      const size = view.getUint32(offset);
      const type = String.fromCharCode(
        view.getUint8(offset + 4), view.getUint8(offset + 5),
        view.getUint8(offset + 6), view.getUint8(offset + 7)
      );

      if (size < 8) break; // invalid

      if (type === "moov") {
        // Search inside moov for mvhd
        const moovEnd = Math.min(offset + size, view.byteLength);
        let inner = offset + 8;
        while (inner + 8 <= moovEnd) {
          const innerSize = view.getUint32(inner);
          const innerType = String.fromCharCode(
            view.getUint8(inner + 4), view.getUint8(inner + 5),
            view.getUint8(inner + 6), view.getUint8(inner + 7)
          );

          if (innerSize < 8) break;

          if (innerType === "mvhd") {
            // mvhd: version (1 byte) + flags (3 bytes) + creation_time
            if (inner + 16 > view.byteLength) break;
            const version = view.getUint8(inner + 8);
            let creationTime: number;

            if (version === 0) {
              // 32-bit creation time
              creationTime = view.getUint32(inner + 12);
            } else {
              // 64-bit creation time (read upper 32 bits is usually 0 for dates before 2038)
              if (inner + 20 > view.byteLength) break;
              creationTime = view.getUint32(inner + 16); // low 32 bits
            }

            if (creationTime > 0) {
              // MP4 epoch: 1904-01-01 00:00:00 UTC
              // Unix epoch offset: 2082844800 seconds
              const unixTimestamp = creationTime - 2082844800;
              if (unixTimestamp > 0 && unixTimestamp < 4102444800) { // sanity: 1970-2100
                const d = new Date(unixTimestamp * 1000);
                return formatDate(d);
              }
            }
          }

          inner += innerSize;
        }
      }

      offset += size;
    }
  } catch (e) {
    console.warn("[ExifDate] MP4 date extraction failed:", e);
  }

  return null;
}
