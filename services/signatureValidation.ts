export interface SignatureValidationResult {
  accepted: boolean;
  score: number;
}

const MIN_SCORE = 0.52;

function payload(signature: string) {
  return signature
    .replace(/^data:image\/\w+;base64,/, '')
    .replace(/[^A-Za-z0-9+/=]/g, '');
}

function segmentVector(value: string, segments = 48) {
  const clean = payload(value);
  if (!clean) return [];

  const vector: number[] = [];
  const size = Math.max(Math.floor(clean.length / segments), 1);

  for (let i = 0; i < segments; i += 1) {
    const part = clean.slice(i * size, (i + 1) * size);
    if (!part) {
      vector.push(0);
      continue;
    }

    const avg = part.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) / part.length;
    vector.push(avg / 122);
  }

  return vector;
}

function histogram(value: string) {
  const clean = payload(value);
  const buckets = new Array(16).fill(0);
  for (const char of clean) {
    buckets[char.charCodeAt(0) % buckets.length] += 1;
  }
  return buckets;
}

function cosine(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  let aMag = 0;
  let bMag = 0;

  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }

  if (aMag === 0 || bMag === 0) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

export function compareSignatures(savedSignature: string, candidateSignature: string): SignatureValidationResult {
  const saved = payload(savedSignature);
  const candidate = payload(candidateSignature);

  if (!saved || !candidate) return { accepted: false, score: 0 };
  if (saved === candidate) return { accepted: true, score: 1 };

  const lengthRatio = Math.min(saved.length, candidate.length) / Math.max(saved.length, candidate.length);
  const segmentScore = cosine(segmentVector(saved), segmentVector(candidate));
  const histogramScore = cosine(histogram(saved), histogram(candidate));
  const score = Number(((lengthRatio * 0.25) + (segmentScore * 0.35) + (histogramScore * 0.4)).toFixed(3));

  return {
    accepted: score >= MIN_SCORE,
    score,
  };
}
