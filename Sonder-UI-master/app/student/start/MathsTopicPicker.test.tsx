import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StartDiagnostic from "./page";
import { diagnosticClient, DiagnosticError } from "@/lib/diagnostic/client";
import { catalogue } from "@/lib/diagnostic/testFixtures";
import { parseCatalogue } from "@/lib/diagnostic/validation";
vi.mock("@/lib/diagnostic/client", async (original) => ({
  ...(await original<typeof import("@/lib/diagnostic/client")>()),
  diagnosticClient: { catalogue: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("available diagnostics", () => {
  it("lists service-provided units without scripted subject choices", async () => {
    const units = Array.from({ length: 7 }, (_, i) => ({
      unit_id: `U${i + 1}`,
      name: `Real unit ${i + 1}`,
      item_count: 20,
    }));
    vi.mocked(diagnosticClient.catalogue).mockResolvedValue(
      parseCatalogue({ ...catalogue, units }),
    );
    render(<StartDiagnostic />);
    expect(
      await screen.findByRole("link", {
        name: "Real unit 1, up to 8 questions",
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.queryByText("Physics")).toBeNull();
    expect(screen.queryByText("Chemistry")).toBeNull();
  });
  it("retries service errors without filling the page with examples", async () => {
    vi.mocked(diagnosticClient.catalogue)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(parseCatalogue(catalogue));
    render(<StartDiagnostic />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("link", {
        name: "Rounding, up to 8 questions",
      }),
    ).toBeTruthy();
  });
  it("offers a return to diagnostics after session expiry", async () => {
    vi.mocked(diagnosticClient.catalogue).mockRejectedValue(
      new DiagnosticError("authentication_required"),
    );
    render(<StartDiagnostic />);
    expect(
      (await screen.findByRole("link", { name: "Log in" })).getAttribute(
        "href",
      ),
    ).toBe("/auth/sign-in?next=%2Fstudent%2Fstart");
  });
  it("explains an empty catalogue", async () => {
    vi.mocked(diagnosticClient.catalogue).mockResolvedValue({
      ...parseCatalogue(catalogue),
      units: [],
    });
    render(<StartDiagnostic />);
    expect(
      await screen.findByRole("heading", {
        name: "No topics are available yet",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
