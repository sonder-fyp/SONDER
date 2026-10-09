import { describe, it, expect } from "vitest";
import { assertMessagingFixtures } from "./assert";
import { THREADS, getThreadById, getStudentThread, getParentThread } from "./threads";
import { ANNOUNCEMENTS, announcementsForClass } from "./announcements";
import { CLASSES } from "../classes";

describe("assertMessagingFixtures", () => {
  it("does not throw against the real fixtures", () => {
    expect(() => assertMessagingFixtures()).not.toThrow();
  });

  it("every thread has messages, a unique id, and is retrievable by that id", () => {
    const ids = new Set<string>();
    THREADS.forEach((t) => {
      expect(t.messages.length).toBeGreaterThan(0);
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      expect(getThreadById(t.id)).toBe(t);
    });
  });

  it("the demo student has both a student thread and a correctly-named parent thread", () => {
    const studentThread = getStudentThread("zara");
    const parentThread = getParentThread("zara");

    expect(studentThread).toBeDefined();
    expect(studentThread?.id).toBe("zara");
    expect(parentThread).toBeDefined();
    expect(parentThread?.id).toBe("parent-zara");
  });

  it("every class has at least one announcement, all of them carrying that class's name", () => {
    CLASSES.forEach((c) => {
      const forClass = announcementsForClass(c.name);
      expect(forClass.length).toBeGreaterThan(0);
      forClass.forEach((a) => expect(a.className).toBe(c.name));
    });

    ANNOUNCEMENTS.forEach((a) => {
      expect(CLASSES.some((c) => c.name === a.className)).toBe(true);
    });
  });
});
