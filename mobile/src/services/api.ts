import { NativeModules, Platform } from 'react-native';

export function getBackendBaseUrl(): string {
  // Runtime resolution — so a single web export can target any deployed
  // backend by replacing APIBaseUrl at Hydration time instead of rebuilding.
  if (typeof window !== 'undefined' && (window as any).__APIBaseUrl) {
    return (window as any).__APIBaseUrl as string;
  }
  if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:8000`;
      }
    }
  } catch {}
  return 'http://192.168.29.247:8000';
}

export const API_BASE_URL = getBackendBaseUrl();

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 3000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetchWithTimeout(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  return res.json() as Promise<T>;
}

export async function getConfig(params: { channel?: string }) {
  const url = `${API_BASE_URL}/get_config?${new URLSearchParams({ channel: params.channel ?? '' }).toString()}`;
  return fetchJson<{
    channel_name: string;
    token: string;
    uid: string;
    app_id: string;
    agent_uid: string;
    bot_domain?: string;
  }>(url);
}
