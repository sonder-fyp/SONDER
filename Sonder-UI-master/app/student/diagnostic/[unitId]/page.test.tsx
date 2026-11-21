// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./DiagnosticClient", () => ({ DiagnosticClient: () => null }));
import DiagnosticPage from "./page";

const uuid = "55555555-5555-4555-8555-555555555555";
const call = (query: Record<string, string>) =>
  DiagnosticPage({ params: Promise.resolve({ unitId: "U1" }), searchParams: Promise.resolve(query) });

describe("diagnostic page entry", () => {
  beforeEach(() => {
    redirect.mockReset();
    redirect.mockImplementation((to: string) => { throw new Error(`redirect:${to}`); });
  });

  it("sends a visit with no assignment and no session to the student home", async () => {
    await expect(call({})).rejects.toThrow("redirect:/student");
    expect(redirect).toHaveBeenCalledWith("/student");
  });

  it("allows an assignment or an existing session", async () => {
    await call({ assignment: uuid });
    await call({ session: uuid });
    expect(redirect).not.toHaveBeenCalled();
  });
});
