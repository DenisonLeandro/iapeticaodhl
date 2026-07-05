import { renderWithHighlights } from "@/lib/drafts/pending-markers";

interface Props { content: string; className?: string; }

/**
 * Read-only preview of the draft with pending markers visually highlighted.
 * Does NOT mutate the source text — the raw string is used for save/copy.
 */
export default function DraftContentPreview({ content, className }: Props) {
  return (
    <div
      className={
        "whitespace-pre-wrap break-words rounded-md border bg-background/40 p-4 text-sm leading-relaxed " +
        (className ?? "")
      }
    >
      {renderWithHighlights(content)}
    </div>
  );
}
