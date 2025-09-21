"use client";

import { useEffect, useRef, useState } from "react";
import { phonemize } from "phonemizer";
import {
  assignVisimeTimes,
  mapWordPhonemesToVisemes,
} from "@/lib/visemes";

export type Word = { text: string; start: number; end: number };

export function mergeWordChunks(chunks: Word[][]): Word[] {
  const result: Word[] = [];
  let pending: Word | null = null;

  for (const group of chunks) {
    for (const w of group) {
      if (pending) {
        if (/^[a-z]+$/i.test(w.text)) {
          pending.text += w.text;
          pending.end = w.end;
          continue;
        } else {
          result.push(pending);
          pending = null;
        }
      }

      if (!/\W$/.test(w.text) && w.text.length < 4) {
        pending = { ...w };
      } else {
        result.push(w);
      }
    }
  }
  if (pending) result.push(pending);
  return result;
}

export function useVisemeAnimation(
  wordTimingRef: React.MutableRefObject<Word[][]>,
  getCurrentTimeMs: () => number,
  loading: boolean,
  fps = 24
) {
  const [currentViseme, setCurrentViseme] = useState<string>("X");
  const lastFrameTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    async function renderFrame(timestamp: number) {
      if (!loading) return;

      const delta = timestamp - lastFrameTimeRef.current;
      if (delta < 1000 / fps) {
        animationRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      lastFrameTimeRef.current = timestamp;
      const nowMs = getCurrentTimeMs();
      const words = mergeWordChunks(wordTimingRef.current);
      const currentWord = words.find(
        w => nowMs >= w.start && nowMs <= w.end
      );

      if (currentWord) {
        const phonemesArr = await phonemize(currentWord.text);
        const phonemes = phonemesArr.map(p =>
          p.replace(/[ˈˌː]/g, "")
        );
        const visemes = mapWordPhonemesToVisemes(phonemes.join(""));
        const visemeTiming = assignVisimeTimes(
          currentWord.start,
          currentWord.end,
          visemes
        );
        const visemeFrame = visemeTiming.find(
          v => nowMs >= v.startTime && nowMs <= v.endTime
        );

        setCurrentViseme(visemeFrame?.viseme ?? "X");
      } else {
        setCurrentViseme("X");
      }

      animationRef.current = requestAnimationFrame(renderFrame);
    }

    if (loading) {
      lastFrameTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(renderFrame);
    }

    return () => {
      if (animationRef.current)
        cancelAnimationFrame(animationRef.current);
    };
  }, [loading, fps, getCurrentTimeMs, wordTimingRef]);

  return currentViseme;
}
