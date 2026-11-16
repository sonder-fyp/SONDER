import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RoleRequestList } from "./RoleRequestList";
const request = {
  id: "example",
  display_name: "Example Teacher",
  email: "teacher@sonder.invalid",
  requested_role: "teacher",
  requested_at: "2026-11-17T00:00:00Z",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("access request decisions", () => {
  it("shows loading and errors without claiming there are no requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<RoleRequestList />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.queryByText("There are no pending access requests."),
    ).toBeNull();
  });
  it("waits for confirmation and acknowledges a persisted decision", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requests: [request] }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetch);
    render(<RoleRequestList />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/Grant teacher access to Example Teacher/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm decision" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Access approved",
      ),
    );
    expect(fetch.mock.calls[1][1].body).toBe(
      JSON.stringify({ decision: "approve" }),
    );
    expect(screen.queryByText("Example Teacher")).toBeNull();
  });
  it("retains a request when saving fails and offers refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ requests: [request] }),
        })
        .mockResolvedValueOnce({ ok: false }),
    );
    render(<RoleRequestList />);
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm decision" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Example Teacher")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
