import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MathsTopicPicker } from "./MathsTopicPicker";
import { catalogue } from "@/lib/diagnostic/testFixtures";

const json = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const named = (name: string) => ({
  ...catalogue,
  units: [{ unit_id: "U1", name, item_count: 20 }],
});
const urls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map((c) => String(c[0]));

describe("topic picker network behaviour", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("fetches the catalogue exactly once per mount outside StrictMode", async () => {
    fetchMock.mockImplementation(() => json(catalogue));
    render(<MathsTopicPicker />);
    await screen.findByRole("link", { name: /Rounding/ });
    expect(urls(fetchMock)).toEqual(["/api/diagnostic/units"]);
  });

  it("ignores the stale result of the first StrictMode effect run", async () => {
    let releaseStale!: () => void;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseStale = () => resolve(json(named("Stale")));
          }),
      )
      .mockImplementation(() => json(named("Fresh")));
    render(
      <StrictMode>
        <MathsTopicPicker />
      </StrictMode>,
    );
    await screen.findByRole("link", { name: /Fresh/ });
    await act(async () => {
      releaseStale();
    });
    expect(screen.queryByRole("link", { name: /Stale/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Fresh/ })).toBeTruthy();
  });
});
