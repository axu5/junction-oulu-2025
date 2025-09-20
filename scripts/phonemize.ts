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

/**
 * Decode a WAV file (PCM16 or PCM32) from a Buffer to Float32Array.
 */
function decodeWav(buffer: Buffer): {
  sampleRate: number;
  numChannels: number;
  samples: Float32Array;
} {
  // Check RIFF header
  if (buffer.toString("ascii", 0, 4) !== "RIFF")
    throw new Error("Not a valid WAV file");
  if (buffer.toString("ascii", 8, 12) !== "WAVE")
    throw new Error("Not a WAVE file");

  // Find 'fmt ' chunk
  let fmtChunkOffset = 12;
  while (
    buffer.toString("ascii", fmtChunkOffset, fmtChunkOffset + 4) !==
    "fmt "
  ) {
    fmtChunkOffset += 4;
    const chunkSize = buffer.readUInt32LE(fmtChunkOffset);
    fmtChunkOffset += 4 + chunkSize;
    if (fmtChunkOffset >= buffer.length)
      throw new Error("fmt chunk not found");
  }

  const fmtChunkSize = buffer.readUInt32LE(fmtChunkOffset + 4);
  const audioFormat = buffer.readUInt16LE(fmtChunkOffset + 8); // 1 = PCM
  const numChannels = buffer.readUInt16LE(fmtChunkOffset + 10);
  const sampleRate = buffer.readUInt32LE(fmtChunkOffset + 12);
  const bitsPerSample = buffer.readUInt16LE(fmtChunkOffset + 22);

  if (audioFormat !== 1)
    throw new Error("Only PCM encoding is supported");

  // Find 'data' chunk
  let dataChunkOffset = fmtChunkOffset + 8 + fmtChunkSize;
  while (
    buffer.toString("ascii", dataChunkOffset, dataChunkOffset + 4) !==
    "data"
  ) {
    dataChunkOffset += 4;
    const chunkSize = buffer.readUInt32LE(dataChunkOffset);
    dataChunkOffset += 4 + chunkSize;
    if (dataChunkOffset >= buffer.length)
      throw new Error("data chunk not found");
  }

  const dataSize = buffer.readUInt32LE(dataChunkOffset + 4);
  const dataStart = dataChunkOffset + 8;
  const sampleCount = dataSize / (bitsPerSample / 8);

  const frameCount = sampleCount / numChannels;

  const samples = new Float32Array(sampleCount);
  const bytesPerSample = bitsPerSample >> 3;

  for (let i = 0; i < frameCount; i++) {
    let sum = 0;

    for (let ch = 0; ch < numChannels; ch++) {
      const offset =
        dataStart + (i * numChannels + ch) * bytesPerSample;
      let sample = 0;

      if (bitsPerSample === 16) {
        sample = buffer.readInt16LE(offset) / 32768; // normalize to -1..1
      } else if (bitsPerSample === 32) {
        sample = buffer.readInt32LE(offset) / 2147483648; // normalize to -1..1
      } else {
        throw new Error(
          "Unsupported bits per sample: " + bitsPerSample
        );
      }

      sum += sample;
    }

    samples[i] = sum / numChannels; // average across channels
  }

  return { numChannels, sampleRate, samples };
}

const ipaToViseme: Record<string, string> = {
  // Ⓐ Closed: P, B, M
  p: "A",
  b: "A",
  m: "A",

  // Ⓑ Slightly open (most consonants)
  k: "B",
  g: "B",
  t: "B",
  d: "B",
  s: "B",
  z: "B",
  ʃ: "B",
  ʒ: "B",
  f: "G", // upper teeth touch lower lip
  v: "G",
  θ: "B",
  ð: "B",
  n: "B",
  ŋ: "B",
  l: "H", // long L
  r: "B",
  h: "B",
  // Ⓒ Open mouth (vowels like EH, AE)
  ɛ: "C",
  æ: "C",
  ɪ: "C",
  i: "C",
  ʊ: "F",
  u: "F",
  ɔ: "E",
  ə: "C",
  ɜ: "E",
  o: "F",
  a: "D", // wide open
  ɑ: "D",
  // Ⓧ Idle / pause
  sil: "X",
  ".": "X",
  ",": "X",
};

function assignVisimeTimes(
  startTime: number,
  endTime: number,
  visemes: string[]
) {
  const duration = endTime - startTime;
  const step = duration / visemes.length;
  return visemes.map((v, i) => ({
    viseme: v,
    startTime: startTime + i * step,
    endTime: startTime + (i + 1) * step,
  }));
}

function mapWordPhonemesToVisemes(phonemes: string) {
  // Split IPA phonemes — simple approach: split each character
  const phonemeChars = Array.from(phonemes.replace(/ˈ|ˌ|ː/g, "")); // remove stress / length marks
  const visemes = phonemeChars.map(ph => ipaToViseme[ph] || "X");
  return visemes;
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
