const DEFAULT_API_BASE_URL = 'https://api.gajabike.shop';

export function resolveApiBaseUrl(rawValue = process.env.EXPO_PUBLIC_API_BASE_URL): string {
  const value = rawValue?.trim();
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }
  return value.replace(/\/+$/, '');
}

export function toWebSocketUrl(apiBaseUrl: string, path: string): string {
  const normalizedBaseUrl = resolveApiBaseUrl(apiBaseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedBaseUrl
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://') + normalizedPath;
}
