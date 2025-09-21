"use client";

import { VisemeRenderer } from "@/components/viseme-renderer";
import { ChatMessage } from "@/hooks/use-llm";
import { useSpeechDetector } from "@/hooks/use-speech-detector";
import { useTranscribe } from "@/hooks/use-transribe";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { useVisemeAnimation } from "@/hooks/use-voice-chat-visemes";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";

export default function Home() {
  const [stream, setStream] = useState<MediaStream>();
  const mrRef = useRef<MediaRecorder>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const {
    speak,
    // stop,
    loading: thinking,
    getCurrentTimeMs,
    wordTimingRef,
  } = useVoiceChat();

  useSpeechDetector({
    mediaStream: stream,
    config: {
      hangoverMs: 2000,
      rmsThreshold: 0.05,
    },

    onSpeakingChange: isUserSpeaking => {
      if (!stream) {
        // this should never happen
        return;
      }

      if (transcribe.isPending) {
        return;
      }

      if (isUserSpeaking) {
        // if (assistantSpeaking) {
        //   stop();
        // }
        if (!mrRef.current) {
          const mr = new MediaRecorder(stream);
          audioChunksRef.current = [];

          mr.ondataavailable = e => {
            if (e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };

          mr.onstop = async () => {
            await transcribe.mutateAsync(audioChunksRef.current);
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
    },
  });

  const currentViseme = useVisemeAnimation(
    wordTimingRef,
    getCurrentTimeMs,
    thinking
  );
  const transcribe = useTranscribe({
    onSuccess({ transcript }) {
      // if (assistantSpeaking) {
      //   stop();
      // }
      const userMsg: ChatMessage = {
        role: "user",
        content: transcript,
      };

      speak([userMsg]);
    },
  });

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
      <div className='w-screen h-screen relative'>
        {transcribe.isPending && (
          <Image
            className='absolute top-1/2 left-1/2 -translate-1/2 z-20'
            src='/thought-bubble.gif'
            width={357}
            height={600}
            alt='Thinking'
          />
        )}
        <VisemeRenderer
          currentViseme={currentViseme}
          width={357}
          height={600}
        />
      </div>
    </>
  );
}
