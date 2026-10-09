import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MusicProvider, MUSIC_SRC, MUSIC_STORAGE_KEY } from "@/lib/music";
import { MusicToggle } from "./MusicToggle";

function mockMedia() {
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  vi.spyOn(HTMLMediaElement.prototype, "volume", "set").mockImplementation(() => {});
  return { play, pause };
}

function renderToggle() {
  return render(
    <MusicProvider>
      <MusicToggle />
    </MusicProvider>,
  );
}

describe("MusicToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts muted and plays the looping track on the first click", async () => {
    const { play } = mockMedia();
    renderToggle();

    const button = screen.getByRole("button", { name: "Play background music" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector("audio")?.getAttribute("src")).toBe(MUSIC_SRC);
    expect(document.querySelector("audio")?.hasAttribute("loop")).toBe(true);

    fireEvent.click(button);
    await waitFor(() => {
      expect(play).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Mute background music" }).getAttribute("aria-pressed")).toBe("true");
    });
    expect(localStorage.getItem(MUSIC_STORAGE_KEY)).toBe("on");
  });

  it("pauses on the second click and remembers the off preference", async () => {
    const { pause } = mockMedia();
    renderToggle();

    fireEvent.click(screen.getByRole("button", { name: "Play background music" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mute background music" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mute background music" }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play background music" }).getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem(MUSIC_STORAGE_KEY)).toBe("off");
  });

  it("retries playback on mount when the stored preference is on", async () => {
    localStorage.setItem(MUSIC_STORAGE_KEY, "on");
    const { play } = mockMedia();
    renderToggle();

    await waitFor(() => {
      expect(play).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Mute background music" })).toBeTruthy();
    });
  });
});
