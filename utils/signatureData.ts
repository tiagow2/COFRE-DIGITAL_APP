export const DIGITAL_SIGNATURE_PREFIX = 'cofre-signature-v1:';

export interface StoredDigitalSignature {
  version: 1;
  width: number;
  height: number;
  paths: string[];
  createdAt: string;
}

export const isDigitalSignature = (value?: string | null) =>
  typeof value === 'string' && value.startsWith(DIGITAL_SIGNATURE_PREFIX);

export const encodeDigitalSignature = (paths: string[], width: number, height: number) => {
  const payload: StoredDigitalSignature = {
    version: 1,
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    paths,
    createdAt: new Date().toISOString(),
  };

  return `${DIGITAL_SIGNATURE_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
};

export const decodeDigitalSignature = (value?: string | null): StoredDigitalSignature | null => {
  if (!value || !isDigitalSignature(value)) return null;

  try {
    const raw = decodeURIComponent(value.slice(DIGITAL_SIGNATURE_PREFIX.length));
    const parsed = JSON.parse(raw) as StoredDigitalSignature;
    if (!Array.isArray(parsed.paths) || parsed.paths.length === 0) return null;

    return {
      version: 1,
      width: Math.max(Number(parsed.width) || 1, 1),
      height: Math.max(Number(parsed.height) || 1, 1),
      paths: parsed.paths.filter((path) => typeof path === 'string' && path.trim().length > 0),
      createdAt: parsed.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const normalizeSignatureValue = (value?: string | null) => {
  const clean = value?.trim();
  if (!clean) return '';
  if (isDigitalSignature(clean) || clean.startsWith('data:image')) return clean;
  return `data:image/png;base64,${clean}`;
};
