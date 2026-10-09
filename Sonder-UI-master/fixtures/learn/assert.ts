import type { LearnPage } from "./types";

/**
 * Dev-time guard for a learning-hub page (Feature 8a), mirroring
 * `assertScenarioPosteriors`: a malformed fixture is a build error, not a
 * runtime edge case. Throws in development, no-op in production.
 */
export function assertLearnPage(page: LearnPage): void {
  if (process.env.NODE_ENV === "production") return;

  const key = `${page.subject}/${page.code}`;

  if (page.resources.length === 0) {
    throw new Error(`[learn page ${key}] has no resources`);
  }
  page.resources.forEach((r) => {
    if (r.relevance < 0 || r.relevance > 1) {
      throw new Error(`[learn page ${key}] resource "${r.title}" has relevance ${r.relevance}, expected within [0, 1]`);
    }
  });
  for (let i = 1; i < page.resources.length; i++) {
    if (page.resources[i].relevance > page.resources[i - 1].relevance) {
      throw new Error(`[learn page ${key}] resources are not sorted by relevance descending`);
    }
  }

  const ids = new Set(page.chat.entries.map((e) => e.id));
  if (!ids.has("simpler")) {
    throw new Error(`[learn page ${key}] chat is missing the reserved "simpler" entry`);
  }
  if (!ids.has("harder")) {
    throw new Error(`[learn page ${key}] chat is missing the reserved "harder" entry`);
  }

  page.chat.entries.forEach((e) => {
    (e.followups ?? []).forEach((id) => {
      if (!ids.has(id)) {
        throw new Error(`[learn page ${key}] entry "${e.id}" has a followup "${id}" that doesn't resolve to a real entry`);
      }
    });
  });
}
