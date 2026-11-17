import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/teacher/client", async (original) => ({
  ...(await original<typeof import("@/lib/teacher/client")>()),
  teacherClient: { evidence: vi.fn() },
}));
import { teacherClient, TeacherError } from "@/lib/teacher/client";
import { parseEvidence } from "@/lib/teacher/evidence";
import { evidenceBody, sessionId } from "@/lib/teacher/testEvidence";
import { CONFIDENCE_NOTE } from "@/lib/teacher/describe";
import { TeacherEvidence } from "./TeacherEvidence";

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const load = (overrides = {}) => vi.mocked(teacherClient.evidence).mockResolvedValue(parseEvidence(evidenceBody(overrides)));

describe("teacher evidence page", () => {
  it("shows who, where and the outcome with the confidence note", async () => {
    load();
    render(<TeacherEvidence sessionId={sessionId} />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Ali");
    expect(teacherClient.evidence).toHaveBeenCalledWith(sessionId);
    expect(screen.getByRole("heading", { name: "In progress" })).toBeTruthy();
    expect(screen.getByText(CONFIDENCE_NOTE)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Grade 8 Blue/ }).getAttribute("href")).toBe("/teacher/classes/11111111-1111-4111-8111-111111111111");
    expect(screen.getByText(/Release Maths_v2-U1-dev\/spec-v2-prior/)).toBeTruthy();
  });

  it("shows each question with the chosen and correct options, links and why it was asked", async () => {
    load();
    render(<TeacherEvidence sessionId={sessionId} />);
    const first = (await screen.findByText("Round 48,630 to the nearest 1,000.")).closest("li") as HTMLElement;
    const chosen = within(first).getByLabelText("Option B, chosen by the student");
    expect(chosen.textContent).toContain("Rounds too little");
    expect(within(first).getByLabelText("Option D, correct answer")).toBeTruthy();
    expect(within(first).getByText("B is linked to MATH-1248.")).toBeTruthy();
    expect(within(first).getByText("Chosen to separate NONE from MATH-1248.")).toBeTruthy();
    expect(within(first).getByText(/next best T1-006 at 0\.700 bits/)).toBeTruthy();
    const second = screen.getByText("Round 3,456 to the nearest 100.").closest("li") as HTMLElement;
    expect(within(second).getByText(/waiting for an answer/)).toBeTruthy();
  });

  it("shows the model's confidence after each answer as figures, in slot order", async () => {
    load();
    render(<TeacherEvidence sessionId={sessionId} />);
    const meters = await screen.findByText("Model confidence after this answer");
    const figure = meters.closest("figure") as HTMLElement;
    expect(within(figure).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Rounds too little80%"), expect.stringContaining("No misconception15%"), expect.stringContaining("Something else5%"),
    ]);
    expect(within(figure).getByText(/supported by 1 answers/)).toBeTruthy();
  });

  it("explains a refusal with the engine's own reason", async () => {
    load({ outcome: { outcome: "escalated_no_separator", diagnosis_candidates: [], escalation_reason: "No question left separates them.",
      escalation_leader_slot: 0, escalation_candidates: [[1, 0], [2, 1]] }, ended_at: "2026-11-18T09:05:00+00:00" });
    render(<TeacherEvidence sessionId={sessionId} />);
    expect(await screen.findByText(/cannot tell these apart/)).toBeTruthy();
    expect(screen.getByText("Rounds too little and No misconception stay tied, and no question left can separate them.")).toBeTruthy();
    expect(screen.getByText("No question left separates them.")).toBeTruthy();
  });

  it("says not found for another class's check and retries other failures", async () => {
    vi.mocked(teacherClient.evidence).mockRejectedValueOnce(new TeacherError("session_not_found"));
    const view = render(<TeacherEvidence sessionId={sessionId} />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Check not found");
    view.unmount();
    vi.mocked(teacherClient.evidence).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(parseEvidence(evidenceBody()));
    render(<TeacherEvidence sessionId={sessionId} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Ali");
  });

  it("asks to sign in again when the session ended", async () => {
    vi.mocked(teacherClient.evidence).mockRejectedValue(new TeacherError("authentication_required"));
    render(<TeacherEvidence sessionId={sessionId} />);
    expect((await screen.findByRole("link", { name: "Log in" })).getAttribute("href")).toBe(`/auth/sign-in?next=%2Fteacher%2Fsessions%2F${sessionId}`);
  });
});
