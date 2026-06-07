const DEFAULT_API_ORIGIN = 'http://192.168.0.122:3000';

function normalizeApiOrigin(value?: string) {
  const raw = (value || DEFAULT_API_ORIGIN).trim();
  return raw.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

export const API_ORIGIN = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_URL);
export const API_URL = `${API_ORIGIN}/api`;
