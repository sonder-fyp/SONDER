import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { DirectChat } from "./DirectChat";
import type { ChatMessage } from "@/fixtures/messaging/types";

const SEED: ChatMessage[] = [
  { id: "1", from: "teacher", text: "Hello from the teacher.", at: "Mon 8:00 AM" },
  { id: "2", from: "student", text: "Hello back.", at: "Mon 8:05 AM" },
];

async function settle(ms = 750) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function send(text: string) {
  const input = screen.getByPlaceholderText(/Message /);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DirectChat", () => {
  it("renders the seeded messages", () => {
    render(
      <DirectChat messages={SEED} meRole="student" counterpartRole="teacher" counterpartName="Imran Shah" />,
    );

    expect(screen.getByText("Hello from the teacher.")).toBeTruthy();
    expect(screen.getByText("Hello back.")).toBeTruthy();
  });

  it("a student-side send produces the teacher's canned reply only after the timer advances", async () => {
    render(
      <DirectChat messages={SEED} meRole="student" counterpartRole="teacher" counterpartName="Imran Shah" />,
    );

    send("Quick question");
    expect(screen.queryByText("Thanks — I'll take a look and get back to you.")).toBeNull();

    await settle();
    expect(screen.getByText("Thanks — I'll take a look and get back to you.")).toBeTruthy();
  });

  it("a teacher-side send produces the student's canned reply", async () => {
    render(
      <DirectChat messages={SEED} meRole="teacher" counterpartRole="student" counterpartName="Zara Qureshi" />,
    );

    send("Any update?");
    await settle();
    expect(screen.getByText("Okay, thank you Mr Shah.")).toBeTruthy();
  });

  it("a parent-side send produces the teacher's canned reply", async () => {
    render(
      <DirectChat messages={SEED} meRole="parent" counterpartRole="teacher" counterpartName="Imran Shah" />,
    );

    send("Thank you");
    await settle();
    expect(screen.getByText("Thanks — I'll take a look and get back to you.")).toBeTruthy();
  });

  it("a message whose from equals meRole renders on the opposite side from one that doesn't", () => {
    render(
      <DirectChat messages={SEED} meRole="student" counterpartRole="teacher" counterpartName="Imran Shah" />,
    );

    const mine = screen.getByText("Hello back.");
    const theirs = screen.getByText("Hello from the teacher.");
    const mineRow = mine.closest("div")!;
    const theirsRow = theirs.closest("div")!;

    expect(mineRow.className).not.toContain("relative");
    expect(theirsRow.className).toContain("relative");
  });
});
