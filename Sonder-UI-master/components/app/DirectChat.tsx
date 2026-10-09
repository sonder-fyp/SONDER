"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/type";
import { ChatFrame } from "@/components/layout";
import { PageMasthead } from "@/components/layout";
import { assertMessagingFixtures } from "@/fixtures/messaging/assert";
import type { ChatMessage, ChatRole } from "@/fixtures/messaging/types";

const REPLY_MS = 750;
let uid = 0;
const nextId = () => `dm${uid++}`;

/** Chosen solely by who is replying. No matching, no variation, no sequence. */
const CANNED_REPLY: Record<ChatRole, string> = {
  teacher: "Thanks — I'll take a look and get back to you.",
  student: "Okay, thank you Mr Shah.",
  parent: "Thank you, I appreciate you letting me know.",
};

/**
 * A complete 1:1 thread. Used in all four messaging placements — there is no
 * per-role variant. Seeded from a fixture thread and never persisted: leaving
 * and returning re-mounts from the seed.
 */
export function DirectChat({
  messages: seed,
  meRole,
  counterpartRole,
  counterpartName,
  context,
}: {
  messages: ChatMessage[];
  meRole: ChatRole;
  counterpartRole: ChatRole;
  counterpartName: string;
  /** Optional line under the header, e.g. "Guardian of Zara Qureshi · 9-B". */
  context?: string;
}) {
  useMemo(() => assertMessagingFixtures(), []);

  const [messages, setMessages] = useState<ChatMessage[]>(seed);
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function send() {
    if (pending) return;
    const text = input.trim();
    if (!text) return;

    setMessages((m) => [...m, { id: nextId(), from: meRole, text, at: "Just now" }]);
    setInput("");
    setPending(true);

    timer.current = setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: nextId(), from: counterpartRole, text: CANNED_REPLY[counterpartRole], at: "Just now" },
      ]);
      setPending(false);
    }, REPLY_MS);
  }

  return (
    <ChatFrame
      header={
        <PageMasthead
          density="compact"
          label="Message"
          title={counterpartName}
          lede={
            context
              ? `${context}. Scripted for this build — nothing you send here is delivered.`
              : "Scripted for this build — nothing you send here is delivered."
          }
        />
      }
      composer={
        <form
          className="flex min-w-0 w-full items-center gap-8"
          onSubmit={(e) => { e.preventDefault(); send(); }}
        >
          <label htmlFor="direct-chat-input" className="sr-only">
            Message {counterpartName}
          </label>
          <Input
            id="direct-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
            placeholder={`Message ${counterpartName}…`}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" className="min-h-12 shrink-0" disabled={pending || !input.trim()}>
            Send
            <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
        </form>
      }
    >
      <div role="log" aria-label={`Conversation with ${counterpartName}`} aria-live="polite">
        {messages.map((m) => {
          const mine = m.from === meRole;
          return (
            <div
              key={m.id}
              className={cn("border-b border-border py-6", !mine && "relative pl-6")}
            >
              {!mine ? (
                <span aria-hidden className="absolute inset-y-6 left-0 w-0.5 bg-accent" />
              ) : null}
              <Label tone={mine ? "muted" : "accent"}>
                {mine ? "You" : counterpartName}
              </Label>
              <p
                className={cn(
                  "mt-3 max-w-2xl leading-relaxed",
                  !mine ? "text-lg text-foreground" : "text-base text-muted-foreground",
                )}
              >
                {m.text}
              </p>
              <p className="mt-2 text-xs text-faint">{m.at}</p>
            </div>
          );
        })}

        {pending ? (
          <div className="relative border-b border-border py-6 pl-6" role="status">
            <span aria-hidden className="absolute inset-y-6 left-0 w-0.5 bg-accent" />
            <Label tone="accent">{counterpartName}</Label>
            <div className="mt-3 w-24">
              <div className="rule-sweep" aria-hidden />
            </div>
            <span className="sr-only">{counterpartName} is typing a reply.</span>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>
    </ChatFrame>
  );
}
