import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChatFrame } from "./ChatFrame";

afterEach(() => {
  cleanup();
});

describe("ChatFrame", () => {
  it("keeps gutters on the inner column, not on the overflow shell", () => {
    render(
      <ChatFrame composer={<button type="button">Send</button>}>
        <p>transcript</p>
      </ChatFrame>,
    );

    const frame = document.querySelector("[data-slot=chat-frame]") as HTMLElement;
    const column = document.querySelector("[data-slot=chat-column]") as HTMLElement;

    expect(frame.style.height).toContain("--topbar-h");
    expect(frame.className).toContain("min-w-0");
    expect(frame.className).not.toContain("px-6");
    expect(frame.className).not.toContain("lg:px-16");
    expect(frame.className).not.toContain("max-w-[1200px]");

    expect(column.className).toContain("px-6");
    expect(column.className).toContain("md:px-12");
    expect(column.className).toContain("lg:px-16");
    expect(column.className).toContain("max-w-[1200px]");
    expect(column.className).toContain("min-w-0");
    expect(frame.contains(column)).toBe(true);
  });

  it("scrolls only the transcript, with the composer as a sibling", () => {
    render(
      <ChatFrame composer={<button type="button">Send</button>}>
        <p>transcript</p>
      </ChatFrame>,
    );

    const transcript = document.querySelector("[data-slot=chat-transcript]") as HTMLElement;
    const footer = document.querySelector("[data-slot=chat-footer]") as HTMLElement;

    expect(transcript.className).toContain("overflow-y-auto");
    expect(transcript.className).toContain("min-h-0");
    expect(transcript.textContent).toContain("transcript");
    expect(footer.contains(transcript)).toBe(false);
    expect(footer.textContent).toContain("Send");
  });

  it("omits the chip row when chips are not passed", () => {
    render(
      <ChatFrame composer={<button type="button">Send</button>}>
        <p>transcript</p>
      </ChatFrame>,
    );

    expect(document.querySelector("[data-slot=chat-chips]")).toBeNull();
  });

  it("wraps chips inside the padded column instead of clipping them", () => {
    render(
      <ChatFrame
        chips={
          <>
            <button type="button">WHAT SHOULD I FOCUS ON NEXT?</button>
            <button type="button">WHY DID I GET THE ROUNDING QUESTION WRONG?</button>
            <button type="button">AM I BEHIND THE CLASS?</button>
            <button type="button">HOW DO I USE THE STUDY NOTE?</button>
          </>
        }
        composer={<button type="button">Send</button>}
      >
        <p>transcript</p>
      </ChatFrame>,
    );

    const column = document.querySelector("[data-slot=chat-column]") as HTMLElement;
    const chips = document.querySelector("[data-slot=chat-chips]") as HTMLElement;
    const transcript = document.querySelector("[data-slot=chat-transcript]") as HTMLElement;

    expect(chips.className).toContain("flex-wrap");
    expect(chips.className).not.toContain("overflow-x-auto");
    expect(column.contains(chips)).toBe(true);
    expect(screen.getByRole("button", { name: "HOW DO I USE THE STUDY NOTE?" })).toBeTruthy();
    expect(
      transcript.contains(screen.getByRole("button", { name: "WHAT SHOULD I FOCUS ON NEXT?" })),
    ).toBe(false);
  });
});
