import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/teacher/client", async (original) => ({
  ...(await original<typeof import("@/lib/teacher/client")>()),
  teacherClient: { attempts: vi.fn() },
}));
import { teacherClient } from "@/lib/teacher/client";
import { parseAttempt } from "@/lib/teacher/attempts";
import { AttemptList } from "./AttemptList";

const id = (n: number) => `77777777-7777-4777-8777-77777777777${n}`;
const attempt = (n: number, extra: Record<string, unknown> = {}) => parseAttempt({
  session_id: id(n), attempt_number: n, state: "completed", answered: 4, question_budget: 8,
  started_at: "2026-11-18T09:00:00Z", ended_at: "2026-11-18T09:10:00Z", review_status: null, ...extra,
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("attempt list", () => {
  it("renders nothing for no attempts or one", async () => {
    for (const list of [[], [attempt(1)]]) {
      vi.mocked(teacherClient.attempts).mockResolvedValue(list);
      const view = render(<AttemptList sessionId={id(1)} />);
      await vi.waitFor(() => expect(teacherClient.attempts).toHaveBeenCalled());
      expect(view.container.textContent).toBe("");
      view.unmount();
      vi.mocked(teacherClient.attempts).mockClear();
    }
  });

  it("links the other attempts and marks the current one", async () => {
    vi.mocked(teacherClient.attempts).mockResolvedValue([
      attempt(1, { review_status: "reviewed" }), attempt(2), attempt(3, { state: "in_progress", ended_at: null }),
    ]);
    render(<AttemptList sessionId={id(2)} />);
    const nav = await screen.findByRole("navigation", { name: "Attempts at this assignment" });
    expect(nav.querySelectorAll("a")).toHaveLength(2);
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe("Attempt 2 · Completed · Not reviewed (this attempt)");
    expect(screen.getByRole("link", { name: "Attempt 3 · In progress" }).getAttribute("href")).toBe(`/teacher/sessions/${id(3)}`);
    expect(screen.getByRole("link", { name: "Attempt 1 · Completed · Reviewed" })).toBeTruthy();
  });

  it("renders nothing when loading fails", async () => {
    vi.mocked(teacherClient.attempts).mockRejectedValue(new Error("offline"));
    const view = render(<AttemptList sessionId={id(1)} />);
    await vi.waitFor(() => expect(teacherClient.attempts).toHaveBeenCalled());
    expect(view.container.textContent).toBe("");
  });
});
