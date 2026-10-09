"use client";

/**
 * One looping soundtrack for the whole app. The <audio> node lives in
 * MusicProvider (mounted from Providers) so crossing landing and product does
 * not restart the track. Playback is opt-in: browsers block autoplay, so the
 * toggle is the gesture, and the preference is stored for the next visit.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export const MUSIC_SRC = "/audio/background.mp3";
export const MUSIC_STORAGE_KEY = "sonder.music";
const VOLUME = 0.28;

type MusicValue = {
  playing: boolean;
  toggle: () => void;
};

const MusicContext = createContext<MusicValue | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playingRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = VOLUME;
    try {
      if (localStorage.getItem(MUSIC_STORAGE_KEY) !== "on") return;
    } catch {
      return;
    }
    audio.play().then(() => {
      playingRef.current = true;
      setPlaying(true);
    }).catch(() => {
      playingRef.current = false;
      setPlaying(false);
    });
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingRef.current) {
      audio.pause();
      playingRef.current = false;
      setPlaying(false);
      try {
        localStorage.setItem(MUSIC_STORAGE_KEY, "off");
      } catch {
        /* ignore */
      }
      return;
    }

    audio.play().then(() => {
      playingRef.current = true;
      setPlaying(true);
      try {
        localStorage.setItem(MUSIC_STORAGE_KEY, "on");
      } catch {
        /* ignore */
      }
    }).catch(() => {
      playingRef.current = false;
      setPlaying(false);
    });
  }, []);

  return (
    <MusicContext.Provider value={{ playing, toggle }}>
      <audio
        ref={audioRef}
        src={MUSIC_SRC}
        loop
        preload="metadata"
        playsInline
      />
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic(): MusicValue {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used inside <MusicProvider>");
  return ctx;
}
