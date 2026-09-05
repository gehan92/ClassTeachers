"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useTranslations } from "next-intl";
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(active && "bg-muted text-foreground")}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("richTextEditor");

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-input bg-secondary/30 px-1.5 py-1">
      <ToolbarButton
        label={t("bold")}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("italic")}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("underline")}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="size-3.5" />
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        label={t("bulletList")}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("orderedList")}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        label={t("alignLeft")}
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("alignCenter")}
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("alignRight")}
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="size-3.5" />
      </ToolbarButton>
    </div>
  );
}

/**
 * Controlled rich-text field (bold/italic/underline, bullet/numbered lists,
 * text align) backed by Tiptap, styled to match the plain Input/textarea
 * fields elsewhere in the dashboard. `value`/`onChange` carry HTML — callers
 * must sanitize server-side before storing (see wanted-ads-actions.ts) since
 * this HTML gets rendered elsewhere with dangerouslySetInnerHTML.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
      TextAlign.configure({ types: ["paragraph", "listItem"], alignments: ["left", "center", "right"] }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class:
          "min-h-24 w-full min-w-0 rounded-b-lg px-2.5 py-2 text-base outline-none md:text-sm [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-muted-foreground [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keeps the editor in sync with external value changes (e.g. the
  // auto-draft effects in wanted-ads-tab.tsx) without fighting the user's own
  // typing — onUpdate above already round-trips through `value`, so this only
  // ever fires setContent when the two have actually diverged.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="w-full rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
