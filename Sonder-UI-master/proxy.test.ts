// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

vi.mock("@/lib/auth/server", () => ({ getAuth: vi.fn() }));
import { config } from "./proxy";

function matches(path: string) {
  return unstable_doesMiddlewareMatch({ config, url: `http://127.0.0.1:3000${path}` });
}

describe("authentication proxy matcher", () => {
  it("allows public site assets without authentication", () => {
    for (const path of ["/brand/sonder-mark.png", "/models/brain.glb", "/audio/background.mp3", "/icon.svg", "/icon.png", "/opengraph-image.png", "/favicon.ico", "/_next/static/chunks/example.js"]) {
      expect(matches(path), path).toBe(false);
    }
  });
  it("keeps application and API paths behind the proxy", () => {
    for (const path of ["/student", "/teacher", "/admin", "/api/diagnostic/units", "/brandish/private", "/icon.svg-private"]) {
      expect(matches(path), path).toBe(true);
    }
  });
});
