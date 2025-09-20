import {
  assignVisimeTimes,
  mapWordPhonemesToVisemes,
} from "@/lib/visemes";
import { decodeWav } from "@/lib/wav";
import { copyFileSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { phonemize } from "phonemizer";

const fps = 30;
const visemeDir = "./public/visemes/lisa";
const outputFramesDir = "./tmp_frames";
mkdirSync(outputFramesDir, { recursive: true });

function detectSilences(
  signal: Float32Array,
  threshold = 0.01,
  minSilenceLength = 0.05,
  sampleRate: number
) {
  const silences: { start: number; end: number }[] = [];
  let start: number | null = null;

  const minSamples = minSilenceLength * sampleRate;

  for (let i = 0; i < signal.length; i++) {
    if (Math.abs(signal[i]) < threshold) {
      if (start === null) start = i;
    } else {
      if (start !== null && i - start >= minSamples) {
        silences.push({ start, end: i });
      }
      start = null;
    }
  }
  return silences.map(s => ({
    startTime: s.start / sampleRate,
    endTime: s.end / sampleRate,
  }));
}

async function main() {
  const t1 = performance.now();

  const text = readFileSync("./public/harvard.txt");
  const phonemes = (await phonemize(text.toString()))
    .reduce((a, c) => a + " " + c, "")
    .trimStart()
    .split(" ");
  const words = text.toString().split(/\s+/);

  const t2 = performance.now();

  const audioFile = readFileSync("./public/harvard.wav");

  const t3 = performance.now();

  const { numChannels, sampleRate, samples } = decodeWav(audioFile);
  const silences = detectSilences(samples, 0.01, 0.05, sampleRate);

  let wordIndex = 0;
  const aligned: {
    word: string;
    phonemes: string;
    visemes: {
      viseme: string;
      startTime: number;
      endTime: number;
    }[];
    startTime: number;
    endTime: number;
  }[] = [];

  for (let i = 0; i < silences.length; i++) {
    const start = silences[i].endTime;
    const end =
      silences[i + 1]?.startTime ??
      samples.length / sampleRate / numChannels;

    if (wordIndex < words.length) {
      aligned.push({
        word: words[wordIndex],
        phonemes: phonemes[wordIndex],
        visemes: assignVisimeTimes(
          start,
          end,
          mapWordPhonemesToVisemes(phonemes[wordIndex])
        ),
        startTime: start,
        endTime: end,
      });
      wordIndex++;
    }
  }

  const t4 = performance.now();

  const t5 = performance.now();
  const timedVisemes = aligned.flatMap(word =>
    word.visemes.map(v => ({
      viseme: v.viseme,
      startTime: v.startTime,
      endTime: v.endTime,
    }))
  );

  const totalDuration = Math.max(...timedVisemes.map(v => v.endTime));
  const totalFrames = Math.ceil(totalDuration * fps);

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const frameTime = frameIndex / fps;

    // Find the viseme active at this frame, default to X
    const viseme =
      timedVisemes.find(
        v => frameTime >= v.startTime && frameTime < v.endTime
      )?.viseme || "X";

    const visemePath = path.join(visemeDir, `${viseme}.png`);
    const frameFilename = path.join(
      outputFramesDir,
      `frame_${String(frameIndex).padStart(6, "0")}.png`
    );
    copyFileSync(visemePath, frameFilename);
  }
  const t6 = performance.now();

  console.log("phoneme and word parsing", ((t2 - t1) | 0) + "ms");
  console.log("Decoding and alignment", ((t4 - t3) | 0) + "ms");
  console.log("Frame creation", ((t6 - t5) | 0) + "ms");

  // const totalDuration = Math.max(...timedVisemes.map(v => v.endTime));
  // const expectedFrames = Math.ceil(totalDuration * fps);
  // console.log(
  //   "Total frames:",
  //   globalFrameIndex,
  //   "Expected:",
  //   expectedFrames
  // );

  // console.log(sampleRate);
}

main();
