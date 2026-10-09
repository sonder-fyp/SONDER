import { THREADS } from "./threads";
import { ANNOUNCEMENTS } from "./announcements";
import { getStudent } from "../students";
import { getClassByName } from "../classes";

/**
 * Dev-time guard for the messaging fixtures, same style as
 * `assertScenarioPosteriors`: a malformed fixture is a build error, not a
 * runtime edge case. Throws on the first violation in development, no-op in
 * production.
 */
export function assertMessagingFixtures(): void {
  if (process.env.NODE_ENV === "production") return;

  const seenIds = new Set<string>();
  THREADS.forEach((t) => {
    if (seenIds.has(t.id)) {
      throw new Error(`[messaging] duplicate thread id "${t.id}"`);
    }
    seenIds.add(t.id);

    if (t.messages.length === 0) {
      throw new Error(`[messaging] thread "${t.id}" has no messages`);
    }

    if (!getStudent(t.studentId)) {
      throw new Error(
        `[messaging] thread "${t.id}" has studentId "${t.studentId}", which resolves to no student`,
      );
    }

    if (t.kind === "parent" && t.id !== `parent-${t.studentId}`) {
      throw new Error(
        `[messaging] parent thread for student "${t.studentId}" must have id "parent-${t.studentId}", got "${t.id}"`,
      );
    }
  });

  ANNOUNCEMENTS.forEach((a) => {
    if (!getClassByName(a.className)) {
      throw new Error(
        `[messaging] announcement "${a.id}" references unknown class "${a.className}"`,
      );
    }
  });
}
