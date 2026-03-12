import React from "react";

/**
 * Parses @mentions in text and highlights known nicknames.
 * Returns an array of React nodes with styled spans for known mentions.
 */
export function parseMentions(
  text: string,
  knownNicknames: string[]
): React.ReactNode[] {
  if (!text || knownNicknames.length === 0) {
    return [text];
  }

  const lowerNicknames = new Set(knownNicknames.map((n) => n.toLowerCase()));
  const parts: React.ReactNode[] = [];
  const regex = /@(\w+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    const nickname = match[1];
    if (!lowerNicknames.has(nickname.toLowerCase())) continue;

    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(
      <span
        key={`mention-${key++}`}
        className="bg-blue-100 text-blue-700 rounded px-1 font-medium"
      >
        @{nickname}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
