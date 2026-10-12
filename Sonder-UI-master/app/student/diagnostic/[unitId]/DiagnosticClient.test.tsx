import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticClient } from "./DiagnosticClient";
import { diagnosticClient, DiagnosticError } from "@/lib/diagnostic/client";
import { catalogue, snapshot } from "@/lib/diagnostic/testFixtures";
import { parseCatalogue, parseSnapshot } from "@/lib/diagnostic/validation";
vi.mock("@/lib/diagnostic/client", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/diagnostic/client")>(), diagnosticClient: {
  catalogue: vi.fn(), begin: vi.fn(), current: vi.fn(), answer: vi.fn(),
} }));
describe("live student diagnostic screen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState(null, "", "/student/diagnostic/U1");
    vi.mocked(diagnosticClient.catalogue).mockResolvedValue(parseCatalogue(catalogue));
    vi.mocked(diagnosticClient.begin).mockResolvedValue(parseSnapshot(snapshot()));
    vi.mocked(diagnosticClient.answer).mockResolvedValue(parseSnapshot(snapshot(1, true)));
  });
  afterEach(cleanup);
  it("renders authored symbols, sends ID, completes neutrally and preserves actual answer count", async () => {
    render(<DiagnosticClient unitId="U1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Begin" }));
    expect(await screen.findByRole("heading", { name: "3⁴ − ∛27?" })).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "D. Answer D" }));
    expect(await screen.findByRole("heading", { name: "Session complete" })).toBeTruthy();
    expect(screen.getByText("Your check is finished. A teacher will review it.")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/diagnosed|misconception|study note/i)).toBeNull();
    expect(vi.mocked(diagnosticClient.answer).mock.calls[0][1].option_id).toBe("D");
    fireEvent.click(screen.getByRole("button", { name: "Run again" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Begin" })).toBeTruthy());
    expect(diagnosticClient.begin).toHaveBeenCalledTimes(1);
  });
  it("explains each failure plainly and offers Retry only when it can help", async () => {
    for (const [code, text, retry] of [
      ["capacity_exceeded", /busy right now/, true],
      ["answer_conflict", /moved on in another tab/, true],
      ["session_expired", /unavailable\. You can start a fresh check/, false],
      ["invalid_origin", /cannot be started from this web address/, false],
      ["engine_timeout", /could not reach your check/, true],
    ] as const) {
      vi.mocked(diagnosticClient.begin).mockRejectedValueOnce(new DiagnosticError(code));
      const view = render(<DiagnosticClient unitId="U1" />);
      fireEvent.click(await screen.findByRole("button", { name: "Begin" }));
      expect((await screen.findByRole("alert")).textContent).toMatch(text);
      expect(screen.queryByRole("button", { name: "Retry" }) !== null).toBe(retry);
      expect(screen.getByRole("button", { name: "Start a fresh check" })).toBeTruthy();
      view.unmount();
    }
  });
});
