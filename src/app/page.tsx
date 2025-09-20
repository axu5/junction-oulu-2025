"use client";

import SpeechDetector from "@/components/speech-detector";
import { useTranscribe } from "@/hooks/use-transribe";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function Home() {
  const [stream, setStream] = useState<MediaStream>();
  const mrRef = useRef<MediaRecorder>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcribe = useTranscribe({
    onSuccess() {
      audioChunksRef.current = [];
    },
  });
  // const [trancript, setTranscript] = useState("");

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
      } catch {
        toast.error("Error detecting microphone");
      }
    }
    init();
  }, []);

  return (
    <>
      {!stream && <>Requesting microphone access</>}
      {stream && (
        <SpeechDetector
          config={{
            hangoverMs: 2000,
            rmsThreshold: 0.05,
          }}
          mediaStream={stream}
          onSpeakingChange={isSpeaking => {
            if (transcribe.isPending) {
              toast.error("Transcription pending");
              return;
            }

            if (isSpeaking) {
              if (!mrRef.current) {
                const mr = new MediaRecorder(stream);
                audioChunksRef.current = [];

                mr.ondataavailable = e => {
                  if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                  }
                };

                mr.onstop = async () => {
                  await transcribe.mutateAsync(
                    audioChunksRef.current
                  );
                };

                mr.start();
                mrRef.current = mr;
              }
            } else {
              if (mrRef.current) {
                mrRef.current.stop();
                mrRef.current = null;
              }
            }
          }}
        />
      )}
      {transcribe.isSuccess && transcribe.data.transcript}
    </>
  );
}
