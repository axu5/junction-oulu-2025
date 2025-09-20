"use client";

import { VisemeRenderer } from "@/components/viseme-renderer";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import {
  assignVisimeTimes,
  mapWordPhonemesToVisemes,
} from "@/lib/visemes";
import { phonemize } from "phonemizer";
import { useEffect, useRef, useState } from "react";

type Word = { text: string; start: number; end: number };

export default function VoiceChatTestPage() {
  const [text, setText] = useState("");
  const [currentViseme, setCurrentViseme] = useState<string>("X");
  const {
    speak,
    stop,
    loading,
    error,
    getCurrentTimeMs,
    wordTimingRef,
  } = useVoiceChat();

  const lastFrameTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    async function renderFrame(timestamp: number) {
      if (!loading) return;

      const delta = timestamp - lastFrameTimeRef.current;

      // 24 FPS → ~41.667 ms per frame
      if (delta >= 1000 / 24) {
        lastFrameTimeRef.current = timestamp;

        const nowMs = getCurrentTimeMs();

        // Merge partial words from streaming data
        const words = mergeWordChunks(wordTimingRef.current);

        // Find the currently spoken word
        const currentWord = words.find(
          w => nowMs >= w.start && nowMs <= w.end
        );

        if (currentWord) {
          // Phonemize once per word (you could cache this for smoother rendering)
          const phonemesArr = await phonemize(currentWord.text);
          // phonemesArr is what phonemize returns
          const phonemes = phonemesArr.map(p =>
            p.replace(/[ˈˌː]/g, "")
          ); // remove stress and length markers

          const visemes = mapWordPhonemesToVisemes(phonemes.join(""));
          const visemeTiming = assignVisimeTimes(
            currentWord.start,
            currentWord.end,
            visemes
          );

          const visemeFrame = visemeTiming.find(
            v => nowMs >= v.startTime && nowMs <= v.endTime
          );

          if (visemeFrame) {
            console.log("Drawing visiemeFrame", visemeFrame);
            setCurrentViseme(visemeFrame.viseme);
          }
        }
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
  }, [loading, getCurrentTimeMs, wordTimingRef]);

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>Voice Chat Test</h2>
      <form
        onSubmit={e => {
          e.preventDefault();
          speak(text);
        }}
        style={{ marginBottom: 16 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          style={{ width: "100%", fontSize: 16, marginBottom: 8 }}
          placeholder='Type something to speak...'
          disabled={loading}
        />
        <div>
          <button type='submit' disabled={loading || !text.trim()}>
            {loading ? "Speaking..." : "Speak"}
          </button>
          <button
            type='button'
            onClick={stop}
            disabled={!loading}
            style={{ marginLeft: 8 }}>
            Stop
          </button>
        </div>
      </form>
      {error && (
        <div style={{ color: "red", marginTop: 8 }}>{error}</div>
      )}
      <VisemeRenderer currentViseme={currentViseme} />
    </div>
  );
}

function mergeWordChunks(chunks: Word[][]): Word[] {
  const result: Word[] = [];
  let pending: Word | null = null;

  for (const group of chunks) {
    for (const w of group) {
      if (pending) {
        // Check if current word continues the pending one
        if (/^[a-z]+$/i.test(w.text)) {
          // Looks like continuation (e.g. "toda" -> "y?")
          pending.text += w.text;
          pending.end = w.end;
          continue;
        } else {
          // Finalize pending before starting new word
          result.push(pending);
          pending = null;
        }
      }

      // If word is cut off, keep it pending
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
