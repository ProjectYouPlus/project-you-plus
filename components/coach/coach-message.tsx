import React, { Fragment } from "react";

// Render a deliberately small Markdown subset as React text, never raw HTML.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>
  );
}

export function CoachMessageContent({ content }: { content: string }) {
  return <div className="space-y-3 whitespace-normal break-words">
    {content.split(/\n\s*\n/).filter(Boolean).map((block, index) => {
      const lines = block.split("\n");
      return <div key={index} className="space-y-1.5">{lines.map((line, lineIndex) => {
        const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
        if (heading) return <p key={lineIndex} className="m-0 font-semibold text-text-1">{inline(heading[1])}</p>;
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) return <p key={lineIndex} className="m-0 flex gap-2"><span aria-hidden="true">•</span><span>{inline(bullet[1])}</span></p>;
        return <p key={lineIndex} className="m-0">{inline(line)}</p>;
      })}</div>;
    })}
  </div>;
}
