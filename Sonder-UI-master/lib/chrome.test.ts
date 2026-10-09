import { describe, expect, it } from "vitest";
import { chromeMode, LANDING_CHROME_SENTINEL_ID } from "./chrome";

describe("chromeMode", () => {
  it("treats the marketing root as landing", () => {
    expect(chromeMode("/")).toBe("landing");
  });

  it("keeps the component gallery chrome-free", () => {
    expect(chromeMode("/dev")).toBe("gallery");
    expect(chromeMode("/dev/components")).toBe("gallery");
  });

  it("treats every role route as product", () => {
    expect(chromeMode("/student")).toBe("product");
    expect(chromeMode("/student/learn")).toBe("product");
    expect(chromeMode("/teacher/escalations")).toBe("product");
    expect(chromeMode("/parent")).toBe("product");
    expect(chromeMode("/admin/catalogue")).toBe("product");
  });

  it("does not treat a nested path as the landing", () => {
    expect(chromeMode("/student")).not.toBe("landing");
    expect(chromeMode("/dev/components")).not.toBe("landing");
  });
});

describe("LANDING_CHROME_SENTINEL_ID", () => {
  it("is a stable id the landing page and TopBar share", () => {
    expect(LANDING_CHROME_SENTINEL_ID).toBe("landing-chrome-sentinel");
  });
});
