import React from "react";

/**
 * Parses @mentions in text and highlights known nicknames.
 * Handles nicknames with spaces/parens like "Shachar (Dad)".
 * Looks for @ followed by any known nickname (case-insensitive).
 */
export function parseMentions(
  text: string,
  knownNicknames: string[]
): React.ReactNode[] {
  if (!text || knownNicknames.length === 0) {
    return [text];
  }

  // Sort by length descending so longer nicknames match first
  const sorted = [...knownNicknames].sort((a, b) => b.length - a.length);

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the next @ symbol
    const atIndex = remaining.indexOf("@");
    if (atIndex === -1) {
      parts.push(remaining);
      break;
    }

    // Add text before @
    if (atIndex > 0) {
      parts.push(remaining.slice(0, atIndex));
    }

    // Check if any known nickname follows the @
    const afterAt = remaining.slice(atIndex + 1);
    let matched = false;

    for (const nickname of sorted) {
      if (afterAt.toLowerCase().startsWith(nickname.toLowerCase())) {
        // Check that the character after the nickname is a word boundary
        // (end of string, space, punctuation, newline, etc.)
        const charAfter = afterAt[nickname.length];
        const isWordBoundary = !charAfter || /[\s.,!?;:\n\r)(\]}]/.test(charAfter);
        if (!isWordBoundary) continue;

        parts.push(
          <span
            key={`mention-${key++}`}
            className="bg-blue-100 text-blue-700 rounded px-1 font-medium"
          >
            @{afterAt.slice(0, nickname.length)}
          </span>
        );
        remaining = remaining.slice(atIndex + 1 + nickname.length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Not a known mention — keep the @ as plain text
      parts.push("@");
      remaining = remaining.slice(atIndex + 1);
    }
  }

  return parts;
}
