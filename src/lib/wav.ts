import { TARGET_CH, TARGET_SR } from "@/consts";

function encodeWAV(
  samples: Float32Array,
  sampleRate: number = 16000
) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* WAV header */
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

/**
 * Decode a WAV file (PCM16 or PCM32) from a Buffer to Float32Array.
 */
export function decodeWav(buffer: Buffer): {
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

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++)
    view.setUint8(offset + i, str.charCodeAt(i));
}

export async function webmChunksToWav(rawWebmChunks: Blob[]) {
  // Combine recorded chunks
  const blob = new Blob(rawWebmChunks, { type: "audio/webm" });
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(
    await blob.arrayBuffer()
  );
  const offlineCtx = new OfflineAudioContext(
    TARGET_CH,
    Math.round(
      (audioBuffer.length * TARGET_SR) / audioBuffer.sampleRate
    ),
    TARGET_SR
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const resampledBuffer = await offlineCtx.startRendering();
  return encodeWAV(resampledBuffer.getChannelData(0), TARGET_SR);
}

export function parseWavHeader(buffer: ArrayBuffer) {
  const view = new DataView(buffer);

  // Check RIFF header
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (riff !== "RIFF")
    throw new Error("Not a valid WAV file (missing RIFF)");

  // Check WAVE format
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  if (wave !== "WAVE")
    throw new Error("Not a valid WAV file (missing WAVE)");

  // Audio format (PCM = 1)
  const audioFormat = view.getUint16(20, true);
  if (audioFormat !== 1) throw new Error("Not PCM WAV");

  // Number of channels
  const numChannels = view.getUint16(22, true);

  // Sample rate
  const sampleRate = view.getUint32(24, true);

  // Bits per sample
  const bitsPerSample = view.getUint16(34, true);

  return { sampleRate, numChannels, bitsPerSample };
}
