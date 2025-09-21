import { TARGET_BPS, TARGET_CH, TARGET_SR } from "@/consts";
import { ai } from "@/lib/ai";
import { parseWavHeader } from "@/lib/wav";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const audioBuffer = await req.arrayBuffer();
    const { sampleRate, numChannels, bitsPerSample } =
      parseWavHeader(audioBuffer);
    if (
      sampleRate !== TARGET_SR ||
      numChannels !== TARGET_CH ||
      bitsPerSample !== TARGET_BPS
    ) {
      return NextResponse.json(
        {
          error: "Invalid wav file",
        },
        {
          status: 400,
        }
      );
    }
    const audioFile = new File([audioBuffer], "speech.wav", {
      type: "audio/wav",
    });

    const transcription = await ai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe",
    });

    console.log(transcription);

    return NextResponse.json({ transcript: transcription.text });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
