import Link from "next/link";
import { Users } from "lucide-react";
import { Container, PageMasthead, Section, ListRow } from "@/components/layout";
import { THREADS } from "@/fixtures/messaging/threads";

export default function TeacherMessages() {
  return (
    <Container>
      <PageMasthead
        scale="page"
        label="Class"
        title="Messages"
        lede="Threads are scripted in this build. Anything you send here is not delivered."
      />

      <Section size="tight" bordered>
        <div className="border-t border-border">
          {THREADS.map((t) => {
            const last = t.messages[t.messages.length - 1];
            const prefix = last.from === "teacher" ? "You: " : "";
            return (
              <Link key={t.id} href={`/teacher/messages/${t.id}`} className="block">
                <ListRow
                  leading={
                    t.kind === "parent" ? (
                      <Users className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                    ) : undefined
                  }
                  title={t.label}
                  meta={`${prefix}${last.text}`}
                  trailing={last.at}
                />
              </Link>
            );
          })}
        </div>
      </Section>
    </Container>
  );
}
