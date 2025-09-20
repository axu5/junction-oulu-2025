"use client";

import { useRef, useState } from "react";

export function useVoiceChat() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playingRef = useRef(false);
  const queueRef = useRef<(() => Promise<void>)[]>([]);
  const processingRef = useRef(false);

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

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    playingRef.current = true;

    try {
      const res = await fetch("/api/voice-chat", {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      if (!res.body)
        throw new Error(
          "Response body is null, this should never happen"
        );

      const reader = res.body.getReader();
      let audioBuffers: AudioBuffer[] = [];
      let bufferQueue: Uint8Array[] = [];

      // Collect all audio chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) bufferQueue.push(value);
      }

      // Concatenate all chunks into a single buffer
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

      // Decode the full audio buffer
      try {
        const audioBuffer = await audioCtx.decodeAudioData(
          concat.buffer.slice(
            concat.byteOffset,
            concat.byteOffset + concat.byteLength
          )
        );
        audioBuffers.push(audioBuffer);
      } catch (err) {
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
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Unknown error");
      }
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
      source.onended = () => resolve();
      source.start();
    });
  }

  function stop() {
    abortRef.current?.abort();
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    playingRef.current = false;
    setLoading(false);
    queueRef.current = [];
  }

  return { speak, stop, loading, error };
}
