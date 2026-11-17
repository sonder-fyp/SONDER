import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { teacherClass: vi.fn() },
}));
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { TeacherClass } from "@/lib/classes/types";
import { TeacherClassDetail } from "./TeacherClassDetail";

const id = "11111111-1111-4111-8111-111111111111";
const room: TeacherClass = {
  class_id: id, name: "Grade 8 Blue", note: "Morning group", join_code: "ABCDEFGHJK",
  grade_level: 8, status: "active", student_count: 2, created_at: "2026-11-18T09:00:00.000Z",
};
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("teacher class detail", () => {
  it("shows the class and its join code, and copies the code", async () => {
    vi.mocked(classesClient.teacherClass).mockResolvedValue(room);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<TeacherClassDetail classId={id} />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Grade 8 Blue");
    expect(classesClient.teacherClass).toHaveBeenCalledWith(id);
    expect(screen.getByText("ABCDEFGHJK")).toBeTruthy();
    expect(screen.getByText(/2 students/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith("ABCDEFGHJK");
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("says when copying is not possible", async () => {
    vi.mocked(classesClient.teacherClass).mockResolvedValue(room);
    vi.stubGlobal("navigator", {});
    render(<TeacherClassDetail classId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy code" }));
    expect(await screen.findByText(/Copy failed/)).toBeTruthy();
  });

  it("says not found for another teacher's or an unknown class", async () => {
    vi.mocked(classesClient.teacherClass).mockRejectedValue(new ClassesError("class_not_found"));
    render(<TeacherClassDetail classId={id} />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Class not found");
    expect(screen.queryByText("ABCDEFGHJK")).toBeNull();
    expect(screen.getByRole("link", { name: "All classes" }).getAttribute("href")).toBe("/teacher/classes");
  });

  it("retries other failures", async () => {
    vi.mocked(classesClient.teacherClass).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(room);
    render(<TeacherClassDetail classId={id} />);
    expect((await screen.findByRole("alert")).textContent).toContain("could not load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("ABCDEFGHJK")).toBeTruthy();
  });
});
