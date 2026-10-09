"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/type";
import { MetaList } from "@/components/layout";
import type { ChatEntry, LearnConceptChat, WorkedExample } from "@/fixtures/learn/types";

type Msg = {
  id: string;
  from: "user" | "assistant";
  text: string;
  example?: WorkedExample;
  followups?: ChatEntry[];
};

const REPLY_MS = 750;
let uid = 0;
const nextId = () => `lc${uid++}`;

/**
 * A concept-oriented chat (Feature 8c) — purpose-built, not a reuse of the
 * session-history `ChatConsultant`. Two persistent affordances ("explain it
 * simpler" / "give me a harder example") are always available, and any reply
 * with a worked example renders it inline rather than as plain text.
 */
export function ConceptChat({ chat }: { chat: LearnConceptChat }) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: nextId(), from: "assistant", text: chat.greeting },
  ]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function findEntry(id?: string, questionText?: string): ChatEntry | undefined {
    if (id) return chat.entries.find((e) => e.id === id);
    const q = questionText?.toLowerCase().trim();
    return chat.entries.find((e) => e.question.toLowerCase().trim() === q);
  }

  function ask(questionText: string, entryId?: string) {
    if (pending) return;
    const q = questionText.trim();
    if (!q) return;

    const matched = findEntry(entryId, q);

    setMessages((m) => [...m, { id: nextId(), from: "user", text: q }]);
    setInput("");
    if (matched) setUsedIds((s) => new Set(s).add(matched.id));
    setPending(true);

    timer.current = setTimeout(() => {
      const followups = matched?.followups
        ?.map((id) => chat.entries.find((e) => e.id === id))
        .filter((e): e is ChatEntry => !!e);

      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          from: "assistant",
          text: matched?.answer ?? chat.fallback,
          example: matched?.example,
          followups,
        },
      ]);
      setPending(false);
    }, REPLY_MS);
  }

  const openPrompts = chat.entries.filter(
    (e) => e.id !== "simpler" && e.id !== "harder" && !usedIds.has(e.id),
  );

  return (
    <div className="flex min-h-[32rem] w-full flex-col border-t border-border">
      <div className="border-b border-border py-6">
        <Label tone="accent">Concept tutor</Label>
        <p className="mt-3 text-sm text-muted-foreground">
          Scripted. About this concept, not your sessions.
        </p>
      </div>

      <div className="app-scroll flex-1 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "border-b border-border py-8",
              m.from === "assistant" && "relative pl-6",
            )}
          >
            {m.from === "assistant" ? (
              <span aria-hidden className="absolute inset-y-8 left-0 w-0.5 bg-accent" />
            ) : null}
            <Label tone={m.from === "assistant" ? "accent" : "muted"}>
              {m.from === "assistant" ? "Concept tutor" : "You"}
            </Label>
            <p
              className={cn(
                "mt-4 max-w-2xl leading-relaxed",
                m.from === "assistant"
                  ? "text-lg text-foreground"
                  : "text-base text-muted-foreground",
              )}
            >
              {m.text}
            </p>

            {m.example ? (
              <MetaList
                className="mt-6"
                items={[
                  { label: "Prompt", value: m.example.prompt },
                  { label: "The slip", value: m.example.wrongMove },
                  { label: "The fix", value: m.example.rightMove },
                  { label: "Answer", value: m.example.answer },
                ]}
              />
            ) : null}

            {m.followups?.length ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {m.followups.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={pending}
                    onClick={() => ask(f.question, f.id)}
                    className="label min-h-11 shrink-0 whitespace-nowrap border border-border-strong px-4 text-muted-foreground transition-colors duration-150 hover:border-accent hover:text-foreground disabled:opacity-50"
                  >
                    Next: {f.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {pending ? (
          <div className="relative border-b border-border py-8 pl-6" role="status">
            <span aria-hidden className="absolute inset-y-8 left-0 w-0.5 bg-accent" />
            <Label tone="accent">Concept tutor</Label>
            <div className="mt-4 w-24">
              <div className="rule-sweep" aria-hidden />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border py-6">
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => ask("Explain it simpler", "simpler")}
            className="label min-h-11 shrink-0 whitespace-nowrap border border-border-strong px-4 text-muted-foreground transition-colors duration-150 hover:border-accent hover:text-foreground disabled:opacity-50"
          >
            Explain it simpler
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => ask("Give me a harder example", "harder")}
            className="label min-h-11 shrink-0 whitespace-nowrap border border-border-strong px-4 text-muted-foreground transition-colors duration-150 hover:border-accent hover:text-foreground disabled:opacity-50"
          >
            Give me a harder example
          </button>
        </div>

        {openPrompts.length ? (
          <div className="mb-4 flex flex-wrap gap-3">
            {openPrompts.map((e) => (
              <button
                key={e.id}
                type="button"
                disabled={pending}
                onClick={() => ask(e.question, e.id)}
                className="label min-h-11 shrink-0 whitespace-nowrap border border-border-strong px-4 text-muted-foreground transition-colors duration-150 hover:border-accent hover:text-foreground disabled:opacity-50"
              >
                {e.label}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="flex items-stretch gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this concept…"
            className="h-12 flex-1 border border-border-strong bg-input px-4 text-base text-foreground placeholder:text-muted-foreground outline-none focus:border-accent disabled:opacity-50 md:h-14"
          />
          <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send">
            <Send className="size-4" strokeWidth={1.5} />
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          <a href="#notes" className="underline-offset-2 hover:underline">Back to the notes</a>
          {" · "}
          <a href="#resources" className="underline-offset-2 hover:underline">See resources</a>
        </p>
      </div>
    </div>
  );
}
