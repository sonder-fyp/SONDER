import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { studentClasses: vi.fn(), studentDashboard: vi.fn() },
}));
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { StudentClass } from "@/lib/classes/types";
import { StudentClassDetail } from "./StudentClassDetail";

const id = "11111111-1111-4111-8111-111111111111";
const room: StudentClass = { class_id: id, name: "Grade 8 Blue", grade_level: 8, teacher_names: "Ms Khan", joined_at: "2026-11-18T09:00:00.000Z" };
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("student class page", () => {
  it("shows the class and its assignments section", async () => {
    vi.mocked(classesClient.studentClasses).mockResolvedValue([room]);
    vi.mocked(classesClient.studentDashboard).mockResolvedValue([]);
    render(<StudentClassDetail classId={id} />);
    expect(await screen.findByRole("heading", { name: "Grade 8 Blue" })).toBeTruthy();
    expect(screen.getByText("Mathematics · Grade 8 · Ms Khan")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Assignments in this class" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Your classes" }).getAttribute("href")).toBe("/student/classes");
  });

  it("says so when the student is not in the class", async () => {
    vi.mocked(classesClient.studentClasses).mockResolvedValue([room]);
    render(<StudentClassDetail classId="00000000-0000-4000-8000-000000000000" />);
    expect(await screen.findByRole("heading", { name: "Class not found" })).toBeTruthy();
    expect(screen.getByText("You are not in this class, or it is no longer active.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Your classes" })).toBeTruthy();
  });

  it("offers Retry after an error", async () => {
    vi.mocked(classesClient.studentClasses).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([room]);
    vi.mocked(classesClient.studentDashboard).mockResolvedValue([]);
    render(<StudentClassDetail classId={id} />);
    expect((await screen.findByRole("alert")).textContent).toContain("We could not load this class.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Grade 8 Blue" })).toBeTruthy();
  });

  it("asks to sign in again when the session ended", async () => {
    vi.mocked(classesClient.studentClasses).mockRejectedValue(new ClassesError("authentication_required"));
    render(<StudentClassDetail classId={id} />);
    expect((await screen.findByRole("link", { name: "Log in" })).getAttribute("href"))
      .toBe(`/auth/sign-in?next=${encodeURIComponent(`/student/classes/${id}`)}`);
  });
});
