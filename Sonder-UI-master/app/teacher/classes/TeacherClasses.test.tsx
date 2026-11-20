import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { teacherClasses: vi.fn(), createClass: vi.fn() },
}));
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { TeacherClass } from "@/lib/classes/types";
import { TeacherClasses } from "./TeacherClasses";

const room: TeacherClass = {
  class_id: "11111111-1111-4111-8111-111111111111", name: "Grade 8 Blue", note: "", join_code: "ABCDEFGHJK",
  grade_level: 8, status: "active", student_count: 1, created_at: "2026-11-18T09:00:00.000Z",
};
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("teacher classes page", () => {
  it("lists the teacher's classes with links to each class", async () => {
    vi.mocked(classesClient.teacherClasses).mockResolvedValue([room, { ...room, class_id: "22222222-2222-4222-8222-222222222222", name: "Old group", status: "archived", student_count: 0 }]);
    render(<TeacherClasses />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    const link = await screen.findByRole("link", { name: /Grade 8 Blue/ });
    expect(link.getAttribute("href")).toBe(`/teacher/classes/${room.class_id}`);
    expect(link.textContent).toContain("1 student");
    expect(screen.getByRole("link", { name: /Old group/ }).textContent).toContain("Archived");
  });

  it("shows an empty state that still offers the create form", async () => {
    vi.mocked(classesClient.teacherClasses).mockResolvedValue([]);
    render(<TeacherClasses />);
    expect(await screen.findByText("No classes yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create class" })).toBeTruthy();
  });

  it("creates a class once and opens it", async () => {
    vi.mocked(classesClient.teacherClasses).mockResolvedValue([]);
    let finish: (value: TeacherClass) => void = () => {};
    vi.mocked(classesClient.createClass).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<TeacherClasses />);
    fireEvent.change(await screen.findByLabelText("Class name"), { target: { value: "Grade 8 Blue" } });
    const button = screen.getByRole("button", { name: "Create class" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(classesClient.createClass).toHaveBeenCalledTimes(1);
    expect(classesClient.createClass).toHaveBeenCalledWith({ name: "Grade 8 Blue", note: "" });
    finish(room);
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/teacher/classes/${room.class_id}`));
  });

  it("explains a refused create without leaving the form", async () => {
    vi.mocked(classesClient.teacherClasses).mockResolvedValue([]);
    vi.mocked(classesClient.createClass).mockRejectedValue(new ClassesError("subject_missing"));
    render(<TeacherClasses />);
    fireEvent.change(await screen.findByLabelText("Class name"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Create class" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Mathematics is not set up");
    expect(screen.getByRole("button", { name: "Create class" })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("retries a failed load and asks for sign-in when the session ended", async () => {
    vi.mocked(classesClient.teacherClasses).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([room]);
    const view = render(<TeacherClasses />);
    expect((await screen.findByRole("alert")).textContent).toContain("could not load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: /Grade 8 Blue/ })).toBeTruthy();
    view.unmount();
    vi.mocked(classesClient.teacherClasses).mockRejectedValue(new ClassesError("authentication_required"));
    render(<TeacherClasses />);
    expect((await screen.findByRole("link", { name: "Log in" })).getAttribute("href")).toBe("/auth/sign-in?next=%2Fteacher%2Fclasses");
  });
});
