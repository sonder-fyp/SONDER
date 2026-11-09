import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";

const toast = vi.fn();
vi.mock("sonner", () => ({ toast: (...args: unknown[]) => toast(...args) }));

import { LatestDiagnosticNotice } from "./LatestDiagnosticNotice";

const result = (id: string, outcome = "diagnosed") => ({
  session_id: id, finished_seq: 1, unit: { unit_id: "U1", name: "Rounding" },
  question_budget: 8, answered_count: 4, outcome, rule: "R1", leader: "MATH-1379",
  leader_name: "Rounds down instead of up", tied: [],
  detail: "R1: MATH-1379 at p = 0.942 with 2 supporting answers.",
  hypotheses: [
    { id: "MATH-1379", name: "Rounds down instead of up", kind: "misconception", prior: 0.175, final: 0.9423, support: 2 },
    { id: "NONE", name: "No misconception", kind: "none", prior: 0.25, final: 0.03, support: 1 },
  ],
  steps: [{ step_index: 0, item_id: "T1-005", reason: "Chosen to separate NONE from MATH-1379.", expected_ig: 0.7887,
    option_id: "D", answer_note: "Chose D (49,000), the correct option.", leader: "NONE", leader_probability: 0.5 }],
});

describe("LatestDiagnosticNotice", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    toast.mockReset();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("shows nothing while no diagnostic has finished", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: "session_unavailable" } }, { status: 404 }));
    render(<LatestDiagnosticNotice />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByText("Latest diagnostic")).toBeNull();
  });

  it("announces a new diagnostic once and opens its result", async () => {
    fetchMock.mockImplementation(async () => Response.json(result("11111111-1111-4111-8111-111111111111")));
    render(<LatestDiagnosticNotice />);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toBe("A diagnostic is ready to review");
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    expect(toast).toHaveBeenCalledTimes(1); // the same run is not announced again

    fireEvent.click(screen.getByRole("button", { name: "Latest diagnostic" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Misconception identified");
    expect(dialog.textContent).toContain("MATH-1379");
    expect(dialog.textContent).toContain("0.9423");
    expect(dialog.textContent).toContain("T1-005");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("announces again when a different run finishes", async () => {
    let id = "11111111-1111-4111-8111-111111111111";
    fetchMock.mockImplementation(async () => Response.json(result(id)));
    render(<LatestDiagnosticNotice />);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    id = "22222222-2222-4222-8222-222222222222";
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));
  });
});
