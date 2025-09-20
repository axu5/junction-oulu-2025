"use client";

import { useState } from "react";
import { useVoiceChat } from "@/hooks/use-voice-chat";

export default function VoiceChatTestPage() {
  const [text, setText] = useState("");
  const { speak, stop, loading, error } = useVoiceChat();

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "40px auto",
      }}>
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
    </div>
  );
}
