import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StartDiagnostic from "./page";
import { diagnosticClient } from "@/lib/diagnostic/client";
import { catalogue } from "@/lib/diagnostic/testFixtures";
import { parseCatalogue } from "@/lib/diagnostic/validation";
vi.mock("@/lib/diagnostic/client", () => ({ diagnosticClient: { catalogue: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("Mathematics picker entry", () => {
  it("fetches live units only after Mathematics and links every unit to the new path", async () => {
    const units = Array.from({ length: 7 }, (_, i) => ({ unit_id: `U${i + 1}`, name: `Real unit ${i + 1}`, item_count: 20 }));
    vi.mocked(diagnosticClient.catalogue).mockResolvedValue(parseCatalogue({ ...catalogue, units }));
    render(<StartDiagnostic />);
    expect(diagnosticClient.catalogue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mathematics" }));
    await screen.findByRole("link", { name: "Real unit 1, 20 questions in this topic" });
    expect(screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("/student/diagnostic/"))).toHaveLength(7);
    expect(screen.queryByText("Whole subject")).toBeNull();
    expect(screen.queryByText("Not in this build")).toBeNull();
  });
  it("reports engine failure and retries without fixture fallback", async () => {
    vi.mocked(diagnosticClient.catalogue).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(parseCatalogue(catalogue));
    render(<StartDiagnostic />);
    fireEvent.click(screen.getByRole("button", { name: "Mathematics" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Rounding to decimal places")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Rounding, 20 questions in this topic" })).toBeTruthy();
  });
  it("retains existing Physics demo behavior", () => {
    render(<StartDiagnostic />);
    fireEvent.click(screen.getByRole("button", { name: /Physics/ }));
    expect(screen.getByText("Whole subject")).toBeTruthy();
    expect(diagnosticClient.catalogue).not.toHaveBeenCalled();
  });
});
