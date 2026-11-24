import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticClient } from "./DiagnosticClient";
import { catalogue, sid, snapshot } from "@/lib/diagnostic/testFixtures";

const json = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const named = (name: string) => ({
  ...catalogue,
  units: [{ unit_id: "U1", name, item_count: 20 }],
});
const route = (url: string) => {
  if (url === "/api/diagnostic/units") return json(catalogue);
  if (url === `/api/diagnostic/sessions/${sid}`) return json(snapshot(1));
  return Promise.reject(new Error(`unexpected ${url}`));
};

describe("diagnostic screen network behaviour", () => {
  const fetchMock = vi.fn();
  const urls = () => fetchMock.mock.calls.map((c) => String(c[0])).sort();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string) => route(url));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/student/diagnostic/U1");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("intro: units once, and no unfinished-check lookup, outside StrictMode", async () => {
    render(<DiagnosticClient unitId="U1" />);
    await screen.findByRole("button", { name: "Begin" });
    expect(urls()).toEqual(["/api/diagnostic/units"]);
  });

  it("intro from an assignment also reads the assignment list once for its labels", async () => {
    fetchMock.mockImplementation((url: string) =>
      url === "/api/student/dashboard" ? json({ assignments: [] }) : route(url));
    render(<DiagnosticClient unitId="U1" assignmentId="55555555-5555-4555-8555-555555555555" />);
    await screen.findByRole("button", { name: "Begin" });
    expect(urls()).toEqual(["/api/diagnostic/units", "/api/student/dashboard"]);
  });

  it("resume: units once and the session once outside StrictMode", async () => {
    render(<DiagnosticClient unitId="U1" initialSession={sid} />);
    await screen.findByRole("heading", { name: "3⁴ − ∛27?" });
    expect(urls()).toEqual([
      `/api/diagnostic/sessions/${sid}`,
      "/api/diagnostic/units",
    ]);
  });

  it("ignores stale results of the first StrictMode effect run", async () => {
    let releaseStale!: () => void;
    let first = true;
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/diagnostic/units" && first) {
        first = false;
        return new Promise((resolve) => {
          releaseStale = () => resolve(json(named("Stale")));
        });
      }
      if (url === "/api/diagnostic/units") return json(named("Fresh"));
      return route(url);
    });
    render(
      <StrictMode>
        <DiagnosticClient unitId="U1" />
      </StrictMode>,
    );
    await screen.findByRole("heading", { name: "Fresh" });
    await act(async () => {
      releaseStale();
    });
    expect(screen.queryByRole("heading", { name: "Stale" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Fresh" })).toBeTruthy();
  });
});
