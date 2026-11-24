import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticClient } from "./DiagnosticClient";
import { classesClient } from "@/lib/classes/client";
import { diagnosticClient, DiagnosticError } from "@/lib/diagnostic/client";
import { catalogue, snapshot } from "@/lib/diagnostic/testFixtures";
import { parseCatalogue, parseSnapshot } from "@/lib/diagnostic/validation";
import { parseCard } from "@/lib/student/dashboard";
vi.mock("@/lib/diagnostic/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/diagnostic/client")>()),
  diagnosticClient: {
    catalogue: vi.fn(),
    begin: vi.fn(),
    current: vi.fn(),
    answer: vi.fn(),
  },
}));
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { studentDashboard: vi.fn() },
}));

const ASSIGNMENT = "55555555-5555-4555-8555-555555555555";
const card = (extra: Record<string, unknown> = {}) =>
  parseCard({
    assignment_id: ASSIGNMENT,
    class_id: "11111111-1111-4111-8111-111111111111",
    class_name: "Grade 8",
    title: "Rounding check",
    unit_code: "U1",
    unit_name: "Rounding",
    attempt_rule: "single",
    created_at: "2026-11-18T09:00:00Z",
    latest_session_id: null,
    latest_state: null,
    answered: 0,
    question_budget: null,
    attempts: 0,
    assignment_status: "open",
    ...extra,
  });
const renderCheck = () => render(<DiagnosticClient unitId="U1" assignmentId={ASSIGNMENT} />);
async function finish() {
  fireEvent.click(await screen.findByRole("button", { name: "Begin" }));
  await screen.findByRole("heading", { name: "3⁴ − ∛27?" });
  fireEvent.click(screen.getByRole("button", { name: "D. Answer D" }));
  await screen.findByRole("heading", { name: "Check submitted" });
}

describe("live student diagnostic screen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState(null, "", `/student/diagnostic/U1?assignment=${ASSIGNMENT}`);
    vi.mocked(classesClient.studentDashboard).mockResolvedValue([card()]);
    vi.mocked(diagnosticClient.catalogue).mockResolvedValue(parseCatalogue(catalogue));
    vi.mocked(diagnosticClient.begin).mockResolvedValue(parseSnapshot(snapshot()));
    vi.mocked(diagnosticClient.answer).mockResolvedValue(parseSnapshot(snapshot(1, true)));
  });
  afterEach(cleanup);

  it("shows the assignment on the intro and exits to the assignments", async () => {
    renderCheck();
    expect(await screen.findByRole("heading", { name: "Rounding check" })).toBeTruthy();
    expect(screen.getByText("Grade 8")).toBeTruthy();
    expect(screen.getByText("Rounding · One attempt")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to your assignments" }).getAttribute("href")).toBe("/student");
  });

  it("renders authored symbols, sends ID and completes neutrally", async () => {
    renderCheck();
    fireEvent.click(await screen.findByRole("button", { name: "Begin" }));
    expect(await screen.findByRole("heading", { name: "3⁴ − ∛27?" })).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(/0 answers saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "D. Answer D" }));
    expect(await screen.findByRole("heading", { name: "Check submitted" })).toBeTruthy();
    expect(screen.getByText("Rounding check")).toBeTruthy();
    expect(screen.getByText("Your answers are saved. Your teacher will look at this check.")).toBeTruthy();
    expect(screen.queryByText(/diagnosed|misconception|study note/i)).toBeNull();
    expect(vi.mocked(diagnosticClient.answer).mock.calls[0][1].option_id).toBe("D");
    expect(vi.mocked(diagnosticClient.begin).mock.calls[0][0].assignment_id).toBe(ASSIGNMENT);
  });

  it("completion: back link, and no second attempt for a single assignment", async () => {
    renderCheck();
    await finish();
    const links = screen.getAllByRole("link", { name: "Back to your assignments" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("href")).toBe("/student");
    expect(screen.queryByRole("button", { name: "Start another attempt" })).toBeNull();
  });

  it("completion: repeat and open offers another attempt, which returns to Begin", async () => {
    vi.mocked(classesClient.studentDashboard).mockResolvedValue([card({ attempt_rule: "repeat" })]);
    renderCheck();
    await finish();
    fireEvent.click(await screen.findByRole("button", { name: "Start another attempt" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Begin" })).toBeTruthy());
    expect(diagnosticClient.begin).toHaveBeenCalledTimes(1);
  });

  it("completion: repeat but closed offers no further attempt", async () => {
    vi.mocked(classesClient.studentDashboard).mockResolvedValue([card({ attempt_rule: "repeat", assignment_status: "closed" })]);
    renderCheck();
    await finish();
    expect(screen.queryByRole("button", { name: "Start another attempt" })).toBeNull();
  });

  it("still works when the assignment card cannot be loaded", async () => {
    vi.mocked(classesClient.studentDashboard).mockRejectedValue(new Error("offline"));
    renderCheck();
    expect(await screen.findByRole("heading", { name: "Rounding" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));
    expect(await screen.findByRole("heading", { name: "3⁴ − ∛27?" })).toBeTruthy();
  });

  it("explains each failure plainly and offers Retry only when it can help", async () => {
    for (const [code, text, retry] of [
      ["enrolment_required", /not in the class for this check.*join your class under Classes/, false],
      ["enrolment_ambiguous", /Open this check from your assignments on the home page/, false],
      ["assignment_required", /Open this check from your assignments on the home page/, false],
      ["assignment_not_found", /not available to you.*Go back to your assignments/, false],
      ["assignment_closed", /closed this assignment/, false],
      ["assignment_unavailable", /no longer offered/, false],
      ["attempt_in_progress", /already have this assignment in progress.*choose Resume/, false],
      ["attempt_limit_reached", /allows one attempt/, false],
      ["authentication_required", /sign-in has ended/, false],
      ["role_required", /only for student accounts/, false],
      ["storage_unavailable", /cannot save answers right now/, true],
      ["storage_error", /went wrong while saving/, true],
      ["engine_numeric_error", /went wrong while saving/, true],
      ["replay_mismatch", /cannot be continued/, false],
      ["capacity_exceeded", /busy right now/, true],
      ["answer_conflict", /moved on in another tab/, true],
      ["session_expired", /unavailable\. Go back to your assignments/, false],
      ["invalid_origin", /cannot be started from this web address/, false],
      ["engine_timeout", /could not reach your check/, true],
    ] as const) {
      vi.mocked(diagnosticClient.begin).mockRejectedValueOnce(new DiagnosticError(code));
      const view = renderCheck();
      fireEvent.click(await screen.findByRole("button", { name: "Begin" }));
      expect((await screen.findByRole("alert")).textContent).toMatch(text);
      expect(screen.queryByRole("button", { name: "Retry" }) !== null).toBe(retry);
      expect(screen.getAllByRole("link", { name: "Back to your assignments" }).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: "Start a fresh check" })).toBeNull();
      expect(screen.queryByText("Back to topics")).toBeNull();
      view.unmount();
    }
  });
});
