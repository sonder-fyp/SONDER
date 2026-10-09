import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { ConceptChat } from "./ConceptChat";
import type { LearnConceptChat } from "@/fixtures/learn/types";

const CHAT: LearnConceptChat = {
  greeting: "Hi, ask me about this concept.",
  entries: [
    {
      id: "why",
      label: "Why does this happen?",
      question: "Why does this happen?",
      answer: "Because of reason X.",
      followups: ["example"],
    },
    {
      id: "example",
      label: "Give me an example",
      question: "Can you give me an example?",
      answer: "Here is the worked example.",
      example: {
        prompt: "Do the thing.",
        wrongMove: "The slip.",
        rightMove: "The fix.",
        answer: "42",
      },
    },
    {
      id: "simpler",
      label: "Explain it simpler",
      question: "Explain it simpler",
      answer: "Simplest version.",
    },
    {
      id: "harder",
      label: "Give me a harder example",
      question: "Give me a harder example",
      answer: "Harder version.",
    },
  ],
  fallback: "I can only talk about this concept — try a suggested question.",
};

function renderChat() {
  return render(createElement(ConceptChat, { chat: CHAT }));
}

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView — the component calls it on every
  // message; stub it so that's not what the test is exercising.
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ConceptChat", () => {
  it("a suggested-question chip asks the matching entry", async () => {
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Why does this happen?" }));
    await settle();
    expect(screen.getByText("Because of reason X.")).toBeTruthy();
  });

  it("typing the exact question text (any case) matches the entry", async () => {
    renderChat();
    const input = screen.getByPlaceholderText("Ask about this concept…");
    fireEvent.change(input, { target: { value: "WHY DOES THIS HAPPEN?" } });
    fireEvent.submit(input.closest("form")!);
    await settle();
    expect(screen.getByText("Because of reason X.")).toBeTruthy();
  });

  it("'Explain it simpler' always resolves to the simpler entry, regardless of prior state", async () => {
    renderChat();
    const simplerButton = screen.getByRole("button", { name: "Explain it simpler" });
    const harderButton = screen.getByRole("button", { name: "Give me a harder example" });

    fireEvent.click(simplerButton);
    await settle();
    expect(screen.getByText("Simplest version.")).toBeTruthy();

    fireEvent.click(harderButton);
    await settle();
    fireEvent.click(simplerButton);
    await settle();
    expect(screen.getAllByText("Simplest version.").length).toBe(2);
  });

  it("'Give me a harder example' always resolves to the harder entry", async () => {
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Give me a harder example" }));
    await settle();
    expect(screen.getByText("Harder version.")).toBeTruthy();
  });

  it("an entry with a worked example renders the stepped panel", async () => {
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Give me an example" }));
    await settle();
    expect(screen.getByText("Do the thing.")).toBeTruthy();
    expect(screen.getByText("The slip.")).toBeTruthy();
    expect(screen.getByText("The fix.")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("unmatched free text falls back", async () => {
    renderChat();
    const input = screen.getByPlaceholderText("Ask about this concept…");
    fireEvent.change(input, { target: { value: "asdkjfh nonsense" } });
    fireEvent.submit(input.closest("form")!);
    await settle();
    expect(
      screen.getByText("I can only talk about this concept — try a suggested question."),
    ).toBeTruthy();
  });

  it("a followup chip asks the referenced next entry", async () => {
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Why does this happen?" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Next: Give me an example" }));
    await settle();
    expect(screen.getByText("Here is the worked example.")).toBeTruthy();
  });
});
