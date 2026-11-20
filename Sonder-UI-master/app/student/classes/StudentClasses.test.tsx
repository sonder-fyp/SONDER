import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { studentClasses: vi.fn(), joinClass: vi.fn() },
}));
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { StudentClass } from "@/lib/classes/types";
import { StudentClasses } from "./StudentClasses";

const room: StudentClass = {
  class_id: "11111111-1111-4111-8111-111111111111", name: "Grade 8 Blue", grade_level: 8,
  teacher_names: "Ms Khan", joined_at: "2026-11-18T09:00:00.000Z",
};
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("student classes page", () => {
  it("lists joined classes with their teachers", async () => {
    vi.mocked(classesClient.studentClasses).mockResolvedValue([room]);
    render(<StudentClasses />);
    expect(await screen.findByText("Grade 8 Blue")).toBeTruthy();
    expect(screen.getByText(/Ms Khan/)).toBeTruthy();
  });

  it("joins with the typed code once and adds the class", async () => {
    vi.mocked(classesClient.studentClasses).mockResolvedValue([]);
    vi.mocked(classesClient.joinClass).mockResolvedValue({ class: room, joined: true });
    render(<StudentClasses />);
    expect(await screen.findByText("You have not joined a class yet.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Class code"), { target: { value: "abcd efgh jk" } });
    fireEvent.click(screen.getByRole("button", { name: "Join class" }));
    expect(await screen.findByText("You joined Grade 8 Blue.")).toBeTruthy();
    expect(classesClient.joinClass).toHaveBeenCalledTimes(1);
    expect(classesClient.joinClass).toHaveBeenCalledWith("abcd efgh jk");
    expect(screen.getByRole("heading", { name: "Grade 8 Blue" })).toBeTruthy();
    expect((screen.getByLabelText("Class code") as HTMLInputElement).value).toBe("");
  });

  it("says when the student was already in the class, without a duplicate row", async () => {
    vi.mocked(classesClient.studentClasses).mockResolvedValue([room]);
    vi.mocked(classesClient.joinClass).mockResolvedValue({ class: room, joined: false });
    render(<StudentClasses />);
    fireEvent.change(await screen.findByLabelText("Class code"), { target: { value: "ABCDEFGHJK" } });
    fireEvent.click(screen.getByRole("button", { name: "Join class" }));
    expect(await screen.findByText("You are already in Grade 8 Blue.")).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Grade 8 Blue" })).toHaveLength(1);
  });

  it("explains a wrong or closed code", async () => {
    vi.mocked(classesClient.studentClasses).mockResolvedValue([]);
    vi.mocked(classesClient.joinClass).mockRejectedValue(new ClassesError("join_code_invalid"));
    render(<StudentClasses />);
    fireEvent.change(await screen.findByLabelText("Class code"), { target: { value: "WRONG" } });
    fireEvent.click(screen.getByRole("button", { name: "Join class" }));
    expect((await screen.findByRole("alert")).textContent).toContain("does not match an open class");
  });

  it("retries a failed load and handles an ended session", async () => {
    vi.mocked(classesClient.studentClasses).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([room]);
    const view = render(<StudentClasses />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Grade 8 Blue")).toBeTruthy();
    view.unmount();
    vi.mocked(classesClient.studentClasses).mockRejectedValue(new ClassesError("authentication_required"));
    render(<StudentClasses />);
    expect((await screen.findByRole("link", { name: "Log in" })).getAttribute("href")).toBe("/auth/sign-in?next=%2Fstudent%2Fclasses");
  });
});
