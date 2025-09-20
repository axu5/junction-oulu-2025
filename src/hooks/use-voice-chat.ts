"use client";

import { useRef, useState } from "react";

export type Word = { text: string; start: number; end: number };

export function useVoiceChat() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playbackStateRef = useRef<{
    startTime: number;
    context: AudioContext;
  }>(null);
  // const audioCtxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playingRef = useRef(false);
  const queueRef = useRef<(() => Promise<void>)[]>([]);
  const processingRef = useRef(false);
  const wordTimingRef = useRef<Word[][]>([]);

  async function processQueue() {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift();
      if (job) await job();
    }
    processingRef.current = false;
  }

  async function speak(text: string) {
    queueRef.current.push(() => speakJob(text));
    processQueue();
  }

  async function speakJob(text: string) {
    setError(null);
    setLoading(true);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (playbackStateRef.current) {
      playbackStateRef.current.context.close();
      playbackStateRef.current = null;
    }

    const audioCtx = new AudioContext();
    playingRef.current = true;

    try {
      const res = await fetch("/api/voice-chat", {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      if (!res.body)
        throw new Error(
          "Response body is null, this should never happen"
        );

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // To accumulate audio binary
      const audioBuffers: AudioBuffer[] = [];
      const bufferQueue: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on newlines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line for next iteration

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.audio) {
              // Decode base64 audio
              const audioBinary = Uint8Array.from(
                atob(msg.audio),
                c => c.charCodeAt(0)
              );
              bufferQueue.push(audioBinary);
            }

            if (msg.words) {
              wordTimingRef.current.push(msg.words);
            }
          } catch (err) {
            console.error("Bad NDJSON line:", line, err);
          }
        }
      }

      // Once finished, merge audio buffers
      const totalLength = bufferQueue.reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      const concat = new Uint8Array(totalLength);
      let offset = 0;
      for (const arr of bufferQueue) {
        concat.set(arr, offset);
        offset += arr.length;
      }

      try {
        const audioBuffer = await audioCtx.decodeAudioData(
          concat.buffer
        );
        audioBuffers.push(audioBuffer);
      } catch {
        setError("Audio decode error");
        setLoading(false);
        playingRef.current = false;
        return;
      }

      // Play each buffer in sequence
      for (const buffer of audioBuffers) {
        if (!playingRef.current) break;
        await playBuffer(audioCtx, buffer);
      }

      setLoading(false);
    } catch {
      // if (err.name !== "AbortError") {
      //   setError("Unknown error");
      // }
      setLoading(false);
    } finally {
      playingRef.current = false;
    }
  }

  // Helper to play a buffer and wait until it finishes
  function playBuffer(audioCtx: AudioContext, buffer: AudioBuffer) {
    return new Promise<void>(resolve => {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        if (playbackStateRef.current) {
          playbackStateRef.current.context.close();
          playbackStateRef.current = null;
        }
        resolve();
      };

      const startTime = audioCtx.currentTime;
      playbackStateRef.current = {
        startTime,
        context: audioCtx,
      };

      source.start();
    });
  }

  function stop() {
    abortRef.current?.abort();
    if (playbackStateRef.current) {
      playbackStateRef.current.context.close();
      playbackStateRef.current = null;
    }
    playingRef.current = false;
    setLoading(false);
    queueRef.current = [];
  }

  function getCurrentTimeMs() {
    const state = playbackStateRef.current;
    if (!state) return 0;
    return (state.context.currentTime - state.startTime) * 1000;
  }

  return {
    speak,
    stop,
    loading,
    error,
    getCurrentTimeMs,
    wordTimingRef,
  };
}
