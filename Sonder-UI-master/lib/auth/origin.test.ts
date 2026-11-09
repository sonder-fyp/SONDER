import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./origin";

describe("same-origin validation", () => {
  it("uses the incoming host when the framework request URL has a different local alias", () => {
    const request = new Request("http://localhost:3100/api/account/profile", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3100",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  it("uses forwarded host and protocol when running behind an HTTPS proxy", () => {
    const request = new Request("http://internal:3000/api/account/profile", {
      method: "POST",
      headers: {
        host: "internal:3000",
        origin: "https://app.example.com",
        "x-forwarded-host": "app.example.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  it("rejects missing, malformed, and cross-origin requests", () => {
    expect(isSameOrigin(new Request("http://localhost:3100/api/account/profile"))).toBe(false);
    expect(isSameOrigin(new Request("http://localhost:3100/api/account/profile", {
      method: "POST",
      headers: { host: "localhost:3100", origin: "not an origin" },
    }))).toBe(false);
    expect(isSameOrigin(new Request("http://localhost:3100/api/account/profile", {
      method: "POST",
      headers: { host: "localhost:3100", origin: "http://attacker.example" },
    }))).toBe(false);
  });
});
