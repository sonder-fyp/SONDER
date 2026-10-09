"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/type";
import { ChatFrame } from "@/components/layout";
import { PageMasthead } from "@/components/layout";
import type { ConsultantConfig } from "@/fixtures/consultant/types";

type Msg = { id: string; from: "user" | "assistant"; text: string; evidence?: string[] };

const REPLY_MS = 750;
let uid = 0;
const nextId = () => `m${uid++}`;

function Evidence({ items, messageId }: { items: string[]; messageId: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `evidence-${messageId}`;
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="label inline-flex min-h-11 items-center gap-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
          strokeWidth={1.5}
          aria-hidden
        />
        {open ? "Hide evidence" : "Show evidence"}
        <span className="nums">({items.length})</span>
      </button>
      {open ? (
        <ul id={panelId} className="mt-4 border-t border-border">
          {items.map((e) => (
            <li key={e} className="border-b border-border py-3 text-sm text-muted-foreground">
              {e}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ChatConsultant({
  config,
  label,
}: {
  config: ConsultantConfig;
  /** The masthead kicker, for example "ASK THE CONSULTANT". */
  label: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: nextId(), from: "assistant", ...config.greeting },
  ]);
  const [usedPromptIds, setUsedPromptIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function ask(question: string, promptId?: string) {
    if (pending) return;
    const q = question.trim();
    if (!q) return;

    const matched =
      config.prompts.find((p) => p.id === promptId) ??
      config.prompts.find((p) => p.question.toLowerCase().trim() === q.toLowerCase());

    setMessages((m) => [...m, { id: nextId(), from: "user", text: q }]);
    setInput("");
    if (matched) setUsedPromptIds((s) => new Set(s).add(matched.id));
    setPending(true);

    timer.current = setTimeout(() => {
      const reply = matched?.reply ?? config.fallback;
      setMessages((m) => [
        ...m,
        { id: nextId(), from: "assistant", text: reply.text, evidence: reply.evidence },
      ]);
      setPending(false);
    }, REPLY_MS);
  }

  const openPrompts = config.prompts.filter((p) => !usedPromptIds.has(p.id));

  return (
    <ChatFrame
      header={
        <PageMasthead
          density="compact"
          label={label}
          title={config.personaLabel}
          lede="Scripted suggestions, not decisions. This assistant does not set marks and does not diagnose."
        />
      }
      chips={
        openPrompts.length
          ? openPrompts.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => ask(p.question, p.id)}
                className="label min-h-11 max-w-full border border-border-strong px-4 text-left text-muted-foreground transition-colors duration-150 hover:border-accent hover:text-foreground disabled:opacity-50"
              >
                {p.label}
              </button>
            ))
          : undefined
      }
      composer={
        <form
          className="flex min-w-0 w-full items-center gap-8"
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
        >
          <label htmlFor="consultant-input" className="sr-only">
            Ask the consultant a question
          </label>
          <Input
            id="consultant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
            placeholder="Ask about a session or a topic"
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" className="min-h-12 shrink-0" disabled={pending || !input.trim()}>
            Send
            <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
        </form>
      }
    >
      <div role="log" aria-label="Consultant conversation" aria-live="polite">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "border-b border-border py-6",
              m.from === "assistant" && "relative pl-6",
            )}
          >
            {m.from === "assistant" ? (
              <span aria-hidden className="absolute inset-y-6 left-0 w-0.5 bg-accent" />
            ) : null}
            <Label tone={m.from === "assistant" ? "accent" : "muted"}>
              {m.from === "assistant" ? config.personaLabel : "You"}
            </Label>
            <p
              className={cn(
                "mt-3 max-w-2xl leading-relaxed",
                m.from === "assistant"
                  ? "text-lg text-foreground"
                  : "text-base text-muted-foreground",
              )}
            >
              {m.text}
            </p>
            {m.evidence?.length ? <Evidence items={m.evidence} messageId={m.id} /> : null}
          </div>
        ))}

        {pending ? (
          <div className="relative border-b border-border py-6 pl-6" role="status">
            <span aria-hidden className="absolute inset-y-6 left-0 w-0.5 bg-accent" />
            <Label tone="accent">{config.personaLabel}</Label>
            <div className="mt-3 w-24">
              <div className="rule-sweep" aria-hidden />
            </div>
            <span className="sr-only">The consultant is typing a reply.</span>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>
    </ChatFrame>
  );
}
