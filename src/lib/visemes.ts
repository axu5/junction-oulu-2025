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

export function assignVisimeTimes(
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

export function mapWordPhonemesToVisemes(phonemes: string) {
  // Split IPA phonemes — simple approach: split each character
  const phonemeChars = Array.from(phonemes.replace(/ˈ|ˌ|ː/g, "")); // remove stress / length marks
  const visemes = phonemeChars.map(ph => ipaToViseme[ph] || "X");
  return visemes;
}
