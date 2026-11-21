// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
import Diagnostics from "./page";

describe("retired self-start page", () => {
  beforeEach(() => {
    redirect.mockReset();
    redirect.mockImplementation((to: string) => { throw new Error(`redirect:${to}`); });
  });

  it("sends old links to the student home", () => {
    expect(() => Diagnostics()).toThrow("redirect:/student");
    expect(redirect).toHaveBeenCalledWith("/student");
  });
});
