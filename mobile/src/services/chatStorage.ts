import { getItem, setItem, removeItem, clearAll } from './storage';
import { MessageItem } from './voice';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: MessageItem[];
}

const SESSIONS_KEY = 'sahara.chat_sessions';
const ACTIVE_SESSION_KEY = 'sahara.active_session_id';

export async function getChatSessions(): Promise<ChatSession[]> {
  try {
    const raw = await getItem(SESSIONS_KEY);
    if (!raw) return [];
    const list: ChatSession[] = JSON.parse(raw);
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  const sessions = await getChatSessions();
  return sessions.find((s) => s.id === id) || null;
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  try {
    const sessions = await getChatSessions();
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = { ...session, updatedAt: Date.now() };
    } else {
      sessions.unshift({ ...session, updatedAt: Date.now() });
    }
    await setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 30))); // Keep last 30 sessions
  } catch (err) {
    console.warn('saveChatSession error:', err);
  }
}

export async function deleteChatSession(id: string): Promise<void> {
  try {
    const sessions = await getChatSessions();
    const filtered = sessions.filter((s) => s.id !== id);
    await setItem(SESSIONS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('deleteChatSession error:', err);
  }
}

export async function getActiveSessionId(): Promise<string | null> {
  return await getItem(ACTIVE_SESSION_KEY);
}

export async function setActiveSessionId(id: string): Promise<void> {
  await setItem(ACTIVE_SESSION_KEY, id);
}

export async function resetAllLocalData(): Promise<void> {
  await clearAll();
}
