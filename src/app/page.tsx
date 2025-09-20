"use client";

import SpeechDetector from "@/components/speech-detector";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [stream, setStream] = useState<MediaStream>();

  useEffect(() => {
    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setStream(s);

        // You can still start MediaRecorder on the same stream:
        // const mr = new MediaRecorder(s);
        // mr.start();
      } catch (e) {
        console.error("mic access denied", e);
      }
    }
    init();
  }, []);

  return <>{stream && <SpeechDetector mediaStream={stream} />}</>;
}
