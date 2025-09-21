"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  PropsWithChildren,
} from "react";
import { Word } from "./use-voice-chat";
import { mergeWordChunks } from "./use-voice-chat-visemes";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type LLMContextType = {
  wordTimingRef: React.MutableRefObject<Word[][]>;
  mergedWords: Word[];
  transcription: string;
  setTranscription: (t: string) => void;
  chatHistory: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
};

const LLMContext = createContext<LLMContextType | undefined>(
  undefined
);

export function LLMProvider({ children }: PropsWithChildren) {
  const wordTimingRef = useRef<Word[][]>([]);
  const [transcription, setTranscription] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const mergedWords = mergeWordChunks(wordTimingRef.current);

  const addMessage = (msg: ChatMessage) => {
    setChatHistory(prev => [...prev, msg]);
  };

  return (
    <LLMContext.Provider
      value={{
        wordTimingRef,
        mergedWords,
        transcription,
        setTranscription,
        chatHistory,
        addMessage,
      }}>
      {children}
    </LLMContext.Provider>
  );
}

export const useLLM = () => {
  const context = useContext(LLMContext);
  if (!context)
    throw new Error("useLLM must be used within an LLMProvider");
  return context;
};
