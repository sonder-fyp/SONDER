import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ChatConsultant } from "./ChatConsultant";
import type { ConsultantConfig } from "@/fixtures/consultant/types";

const CONFIG: ConsultantConfig = {
  personaLabel: "AI Consultant",
  greeting: { text: "Hello, I am the greeting." },
  prompts: [
    {
      id: "pace",
      label: "How is my pace?",
      question: "How is my pace?",
      reply: {
        text: "Your pace reply.",
        evidence: ["Session B", "Median days"],
      },
    },
  ],
  fallback: { text: "I can only answer scripted questions." },
};

function renderConsultant() {
  return render(<ChatConsultant config={CONFIG} label="Ask the consultant" />);
}

async function settle(ms = 750) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ChatConsultant", () => {
  it("renders the required kicker and a compact persona heading", () => {
    renderConsultant();

    expect(screen.getByText("Ask the consultant")).toBeTruthy();
    const heading = screen.getByRole("heading", { level: 1, name: "AI Consultant" });
    expect(heading.className).toContain("text-xl");
    expect(heading.className).not.toContain("text-4xl");
    expect(heading.className).not.toContain("lg:text-6xl");
  });

  it("puts the greeting in the conversation log", () => {
    renderConsultant();

    const log = screen.getByRole("log", { name: "Consultant conversation" });
    expect(log.textContent).toContain("Hello, I am the greeting.");
  });

  it("a chip asks the matching prompt and then disappears", async () => {
    renderConsultant();

    fireEvent.click(screen.getByRole("button", { name: "How is my pace?" }));
    expect(screen.getByText("How is my pace?")).toBeTruthy();

    await settle();

    expect(screen.getByText("Your pace reply.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "How is my pace?" })).toBeNull();
  });

  it("typing the exact question text (any case) matches the prompt", async () => {
    renderConsultant();

    const input = screen.getByPlaceholderText("Ask about a session or a topic");
    fireEvent.change(input, { target: { value: "  HOW IS MY PACE?  " } });
    fireEvent.submit(input.closest("form")!);
    await settle();

    expect(screen.getByText("Your pace reply.")).toBeTruthy();
  });

  it("unmatched free text falls back", async () => {
    renderConsultant();

    const input = screen.getByPlaceholderText("Ask about a session or a topic");
    fireEvent.change(input, { target: { value: "asdkjfh nonsense" } });
    fireEvent.submit(input.closest("form")!);
    await settle();

    expect(screen.getByText("I can only answer scripted questions.")).toBeTruthy();
  });

  it("disables the composer while a reply is pending and Send when empty", () => {
    renderConsultant();

    const send = screen.getByRole("button", { name: "Send" });
    const input = screen.getByPlaceholderText("Ask about a session or a topic");
    expect(send).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "How is my pace?" }));
    expect(input).toHaveProperty("disabled", true);
    expect(send).toHaveProperty("disabled", true);
  });

  it("keeps evidence collapsed until shown", async () => {
    renderConsultant();

    fireEvent.click(screen.getByRole("button", { name: "How is my pace?" }));
    await settle();

    expect(screen.queryByText("Session B")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show evidence/ }));
    expect(screen.getByText("Session B")).toBeTruthy();
    expect(screen.getByText("Median days")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Hide evidence/ })).toBeTruthy();
  });

  it("fits the composer in the padded column: wrapping chips, full-width form", () => {
    renderConsultant();

    const form = screen.getByPlaceholderText("Ask about a session or a topic").closest("form");
    expect(form?.className).toContain("min-w-0");
    expect(form?.className).toContain("w-full");

    const chip = screen.getByRole("button", { name: "How is my pace?" });
    const chipRow = chip.parentElement as HTMLElement;
    expect(chipRow.className).toContain("flex-wrap");
    expect(chipRow.className).not.toContain("overflow-x-auto");
    expect(chip.className).toContain("max-w-full");
    expect(chip.className).not.toContain("whitespace-nowrap");
  });
});
