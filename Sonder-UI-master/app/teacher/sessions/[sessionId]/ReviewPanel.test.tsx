import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/teacher/client", async (original) => ({
  ...(await original<typeof import("@/lib/teacher/client")>()),
  teacherClient: { reviews: vi.fn(), addReview: vi.fn() },
}));
import { teacherClient, TeacherError } from "@/lib/teacher/client";
import type { Review } from "@/lib/teacher/reviews";
import { ReviewPanel } from "./ReviewPanel";

const sid = "77777777-7777-4777-8777-777777777777";
const first: Review = { revision: 1, status: "follow_up_required", note: "Check place value", reviewer_name: "Ms Khan",
  created_at: "2026-11-18T10:00:00.000Z" };
beforeEach(() => { vi.mocked(teacherClient.reviews).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const statusIs = (text: string) =>
  vi.waitFor(() => expect(screen.getByText("Status").parentElement?.textContent).toBe(`Status ${text}`));

describe("review panel", () => {
  it("starts unreviewed and appends a revision naming the expected one", async () => {
    vi.mocked(teacherClient.addReview).mockResolvedValue([first]);
    render(<ReviewPanel sessionId={sid} finished />);
    expect(await screen.findByText("Not reviewed yet")).toBeTruthy();
    expect(screen.getByText(/Reviewed is not approval for release/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Follow-up required"));
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "Check place value" } });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    expect(await screen.findByText("Saved.")).toBeTruthy();
    const call = vi.mocked(teacherClient.addReview).mock.calls[0];
    expect(call[0]).toBe(sid);
    expect(call[1]).toMatchObject({ expected_revision: 0, status: "follow_up_required", note: "Check place value" });
    expect(call[1].request_key).toMatch(/^[0-9a-f-]{36}$/);
    const history = screen.getByRole("list", { name: "Review history" });
    expect(within(history).getByText("Check place value")).toBeTruthy();
    expect(within(history).getByText(/Ms Khan/)).toBeTruthy();
  });

  it("reuses the request key when retrying a failed save and uses a new one after a change", async () => {
    vi.mocked(teacherClient.reviews).mockResolvedValue([first]);
    vi.mocked(teacherClient.addReview).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));
    render(<ReviewPanel sessionId={sid} finished />);
    await statusIs("Follow-up required");
    const save = screen.getByRole("button", { name: "Save review" });
    fireEvent.click(save);
    expect((await screen.findByRole("alert")).textContent).toContain("will not be saved twice");
    fireEvent.click(save);
    await vi.waitFor(() => expect(teacherClient.addReview).toHaveBeenCalledTimes(2));
    const [a, b] = vi.mocked(teacherClient.addReview).mock.calls;
    expect(b[1].request_key).toBe(a[1].request_key);
    expect(a[1].expected_revision).toBe(1);
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "changed" } });
    vi.mocked(teacherClient.addReview).mockResolvedValueOnce([first]);
    fireEvent.click(save);
    await vi.waitFor(() => expect(teacherClient.addReview).toHaveBeenCalledTimes(3));
    expect(vi.mocked(teacherClient.addReview).mock.calls[2][1].request_key).not.toBe(a[1].request_key);
  });

  it("reloads and explains when someone else saved first", async () => {
    vi.mocked(teacherClient.reviews).mockResolvedValueOnce([]).mockResolvedValueOnce([first]);
    vi.mocked(teacherClient.addReview).mockRejectedValue(new TeacherError("review_conflict"));
    render(<ReviewPanel sessionId={sid} finished />);
    fireEvent.click(await screen.findByRole("button", { name: "Save review" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Someone else updated this review");
    await statusIs("Follow-up required");
    expect(teacherClient.reviews).toHaveBeenCalledTimes(2);
  });

  it("does not offer a review for an unfinished check", async () => {
    render(<ReviewPanel sessionId={sid} finished={false} />);
    expect(await screen.findByText(/not finished yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save review" })).toBeNull();
  });

  it("retries a failed load", async () => {
    vi.mocked(teacherClient.reviews).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([first]);
    render(<ReviewPanel sessionId={sid} finished />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await statusIs("Follow-up required");
  });
});
