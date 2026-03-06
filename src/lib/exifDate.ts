/**
 * Extract the date a photo was taken from EXIF data.
 * Returns YYYY-MM-DD string or null if not found.
 * Works with JPEG/TIFF files that contain EXIF.
 */
export async function extractDateFromFile(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;

  try {
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer(); // read first 128KB
    const view = new DataView(buffer);

    // Check JPEG SOI marker
    if (view.getUint16(0) !== 0xffd8) return null;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if (marker === 0xffe1) {
        // APP1 — EXIF
        const length = view.getUint16(offset + 2);
        return parseExifSegment(view, offset + 4, length - 2);
      }
      // Skip to next marker
      const segLen = view.getUint16(offset + 2);
      offset += 2 + segLen;
    }
  } catch {
    // Silently fail — EXIF parsing is best-effort
  }

  return null;
}

function parseExifSegment(
  view: DataView,
  start: number,
  length: number
): string | null {
  // Check "Exif\0\0" header
  const exifHeader =
    view.getUint32(start) === 0x45786966 && view.getUint16(start + 4) === 0x0000;
  if (!exifHeader) return null;

  const tiffStart = start + 6;
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949; // "II"

  const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + ifdOffset;

  // Search IFD0 for DateTimeOriginal (0x9003) or DateTime (0x0132)
  // IFD0 may point to ExifIFD which has DateTimeOriginal
  const date = searchIfdForDate(view, ifdStart, tiffStart, littleEndian, length);
  return date;
}

function searchIfdForDate(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  le: boolean,
  maxLen: number
): string | null {
  if (ifdStart + 2 > view.byteLength) return null;

  const entryCount = view.getUint16(ifdStart, le);
  let exifIfdPointer: number | null = null;

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, le);

    // Tag 0x8769 = ExifIFD pointer
    if (tag === 0x8769) {
      exifIfdPointer = view.getUint32(entryOffset + 8, le);
    }

    // Tag 0x0132 = DateTime (fallback)
    if (tag === 0x0132) {
      const dateStr = readExifString(view, entryOffset, tiffStart, le);
      if (dateStr) {
        const parsed = parseExifDateString(dateStr);
        if (parsed) return parsed;
      }
    }
  }

  // Search ExifIFD for DateTimeOriginal (0x9003) or DateTimeDigitized (0x9004)
  if (exifIfdPointer !== null) {
    const exifIfdStart = tiffStart + exifIfdPointer;
    if (exifIfdStart + 2 > view.byteLength) return null;

    const count = view.getUint16(exifIfdStart, le);
    for (let i = 0; i < count; i++) {
      const entryOffset = exifIfdStart + 2 + i * 12;
      if (entryOffset + 12 > view.byteLength) break;

      const tag = view.getUint16(entryOffset, le);
      if (tag === 0x9003 || tag === 0x9004) {
        const dateStr = readExifString(view, entryOffset, tiffStart, le);
        if (dateStr) {
          const parsed = parseExifDateString(dateStr);
          if (parsed) return parsed;
        }
      }
    }
  }

  return null;
}

function readExifString(
  view: DataView,
  entryOffset: number,
  tiffStart: number,
  le: boolean
): string | null {
  const count = view.getUint32(entryOffset + 4, le);
  let strOffset: number;

  if (count <= 4) {
    strOffset = entryOffset + 8;
  } else {
    strOffset = tiffStart + view.getUint32(entryOffset + 8, le);
  }

  if (strOffset + count > view.byteLength) return null;

  let str = "";
  for (let j = 0; j < count - 1; j++) {
    str += String.fromCharCode(view.getUint8(strOffset + j));
  }
  return str;
}

/** Parse "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD" */
function parseExifDateString(s: string): string | null {
  const match = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  // Sanity check
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31)
    return null;
  return `${y}-${m}-${d}`;
}
