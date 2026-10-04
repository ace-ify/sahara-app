// Persistent cross-platform storage layer for Sahara.
// Web: uses localStorage.
// Native: uses @react-native-async-storage/async-storage.
import AsyncStorage from '@react-native-async-storage/async-storage';

function webStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage as Storage;
    }
  } catch {
    // Access can throw in private mode / sandboxed iframes.
  }
  return null;
}

export async function getItem(key: string): Promise<string | null> {
  const ls = webStorage();
  if (ls) {
    try {
      const val = ls.getItem(key);
      if (val !== null) return val;
    } catch {}
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  const ls = webStorage();
  if (ls) {
    try {
      ls.setItem(key, value);
    } catch {}
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}

export async function removeItem(key: string): Promise<void> {
  const ls = webStorage();
  if (ls) {
    try {
      ls.removeItem(key);
    } catch {}
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function clearAll(): Promise<void> {
  const ls = webStorage();
  if (ls) {
    try {
      ls.clear();
    } catch {}
  }
  try {
    await AsyncStorage.clear();
  } catch {}
}
