"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Props:
 * - mediaStream: a MediaStream that's already active (microphone). Assumed MediaRecorder may be using it.
 * - onSpeakingChange?: (isSpeaking: boolean) => void
 * - config?: { fftSize, smoothingTimeConstant, sampleIntervalMs, rmsThreshold, hangoverMs }
 */
export default function SpeechDetector({
  mediaStream,
  onSpeakingChange,
  config = {},
}: {
  mediaStream: MediaStream;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  config?: {
    fftSize?: number;
    smoothingTimeConstant?: number;
    sampleIntervalMs?: number;
    rmsThreshold?: number;
    hangoverMs?: number;
  };
}) {
  const {
    fftSize = 2048,
    smoothingTimeConstant = 0.8, // smoother meter (0..1)
    sampleIntervalMs = 100, // how often we sample audio (ms)
    rmsThreshold = 0.01, // tune this for sensitivity (RMS)
    hangoverMs = 250, // keep 'speaking' true for this many ms after last above-threshold
  } = config;

  const audioCtxRef = useRef<AudioContext>(null);
  const analyserRef = useRef<AnalyserNode>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode>(null);
  const rafRef = useRef<number>(null);
  const lastLoudAtRef = useRef(0);
  const [level, setLevel] = useState(0);
  const speakingRef = useRef(false);
  const [speaking, setSpeaking] = useState(false);

  function setSpeakingState(val: boolean) {
    speakingRef.current = val;
    setSpeaking(val);
  }

  useEffect(() => {
    if (!mediaStream) return;

    // Create AudioContext & AnalyserNode
    const AudioContext = window.AudioContext;
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    // If the context is suspended (autoplay policy), resume on first user gesture or right away if possible
    if (audioCtx.state === "suspended") {
      // try to resume immediately (may still require a gesture in some browsers)
      audioCtx.resume().catch(() => {});
    }

    const source = audioCtx.createMediaStreamSource(mediaStream);
    sourceRef.current = source;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothingTimeConstant;
    analyserRef.current = analyser;

    // Connect graph: source -> analyser (we don't need to connect to destination)
    source.connect(analyser);

    const bufferLen = analyser.fftSize;
    const data = new Float32Array(bufferLen);

    let mounted = true;

    function sample() {
      if (!mounted) return;

      analyser.getFloatTimeDomainData(data);
      // compute RMS
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(rms);

      const now = performance.now();
      if (rms >= rmsThreshold) {
        lastLoudAtRef.current = now;
        if (!speakingRef.current) {
          setSpeakingState(true);
          if (onSpeakingChange) onSpeakingChange(true);
        }
      } else {
        // if we are above threshold recently (within hangover), keep speaking true
        if (
          speakingRef.current &&
          now - lastLoudAtRef.current > hangoverMs
        ) {
          setSpeakingState(false);
          if (onSpeakingChange) onSpeakingChange(false);
        }
      }

      rafRef.current = window.setTimeout(sample, sampleIntervalMs);
    }

    // kick off sampling loop
    sample();

    return () => {
      mounted = false;
      if (rafRef.current) {
        clearTimeout(rafRef.current);
        rafRef.current = null;
      }
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {}
      // Don't close AudioContext if other audio parts of your app need it.
      try {
        audioCtx.close();
      } catch {}
    };
  }, [
    mediaStream,
    fftSize,
    smoothingTimeConstant,
    sampleIntervalMs,
    rmsThreshold,
    hangoverMs,
    onSpeakingChange,
  ]);

  // small visualization
  const meterPct = Math.min(1, level / (rmsThreshold * 6)); // scale for UI

  return (
    <div
      style={{
        fontFamily: "system-ui, Arial",
        display: "inline-block",
      }}>
      <div
        aria-hidden
        style={{
          width: 160,
          height: 12,
          background: "#eee",
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 8,
          boxShadow: "inset 0 0 2px rgba(0,0,0,0.1)",
        }}>
        <div
          style={{
            width: `${meterPct * 100}%`,
            height: "100%",
            transition: "width 80ms linear",
            background: speaking ? "limegreen" : "#888",
          }}
        />
      </div>
      <div style={{ fontSize: 13 }}>
        <strong style={{ color: speaking ? "green" : "#333" }}>
          {speaking ? "Someone is speaking" : "Silence"}
        </strong>
        <div style={{ fontSize: 12, color: "#666" }}>
          Level (RMS): {level.toFixed(4)}
        </div>
        <div>RMS Threshold: {rmsThreshold}</div>
      </div>
    </div>
  );
}
