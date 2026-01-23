import { useEffect, useState } from "react";
import { marked } from "marked";
import { MarkdownSegment } from "@types";

// Centralized markdown renderer used for blog content and log bodies.
marked.setOptions({
  gfm: true,
  breaks: true,
});

export function MarkdownBlock({ segment }: { segment: MarkdownSegment }) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const result = marked.parse(segment.markdown);
    Promise.resolve(result).then((value) => {
      if (!cancelled) setHtml(value || "");
    });
    return () => {
      cancelled = true;
    };
  }, [segment.markdown]);

  return (
    <div className="t-markdown">
      {segment.title ? <h3 className="t-markdownTitle">{segment.title}</h3> : null}
      <div
        className="t-markdownBody"
        // content originates from local markdown files we author
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
