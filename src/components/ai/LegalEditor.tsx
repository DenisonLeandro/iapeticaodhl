// =============================================================================
// LegalEditor — Rich text editor using TipTap for legal documents
// Story 2.3 — Legal Document Editor
// =============================================================================

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import EditorToolbar from "./EditorToolbar";

interface LegalEditorProps {
  initialContent: string;
  onUpdate: (html: string) => void;
}

export default function LegalEditor({
  initialContent,
  onUpdate,
}: LegalEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "justify",
      }),
      Placeholder.configure({
        placeholder: "Comece a editar o documento...",
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      onUpdate(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "legal-editor prose prose-invert max-w-none min-h-[500px] px-8 py-6 focus:outline-none",
      },
    },
  });

  // Sync external content changes (e.g., when document loads after initial render)
  useEffect(() => {
    if (editor && initialContent && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <EditorToolbar editor={editor} />
      <div className="bg-[hsl(222,47%,8%)] text-foreground">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
