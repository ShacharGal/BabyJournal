import React from "react";
import { parseMentions } from "@/lib/mentionParser";

/**
 * Parses dialogue/quote text for Hebrew RTL strings containing colons.
 * Only used when post_type === "dialogue".
 *
 * For each line: text before the first colon -> bold (speaker),
 * text after the first colon -> italic (quote).
 * Lines without colons are rendered as-is.
 *
 * If knownNicknames is provided, @mentions within the text are highlighted.
 */
export function parseDialogueText(
  text: string,
  knownNicknames?: string[]
): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];

  const renderText = (str: string, key: string) => {
    if (knownNicknames && knownNicknames.length > 0) {
      return <React.Fragment key={key}>{parseMentions(str, knownNicknames)}</React.Fragment>;
    }
    return <React.Fragment key={key}>{str}</React.Fragment>;
  };

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) result.push(<br key={`br-${i}`} />);

    const line = lines[i];
    const colonIndex = line.indexOf(":");

    // Only parse if colon exists, speaker part is short-ish (< 30 chars),
    // and there's actual text after the colon
    if (colonIndex > 0 && colonIndex < 30 && line.length > colonIndex + 1) {
      const speaker = line.slice(0, colonIndex);
      const quote = line.slice(colonIndex + 1);
      result.push(
        <React.Fragment key={`line-${i}`}>
          <span className="font-bold text-[#353326]">{speaker}:</span>
          <span className="text-[#57534e]">
            {knownNicknames && knownNicknames.length > 0
              ? parseMentions(quote, knownNicknames)
              : quote}
          </span>
        </React.Fragment>
      );
    } else {
      result.push(renderText(line, `line-${i}`));
    }
  }

  return result;
}
