import { Message } from '@/types/chat';

const CACHE_KEY = 'chatSessionMessagesCache_v1';

type CachedSession = {
    messages: Message[];
    history: [string, string][];
};

type CacheStore = Record<string, CachedSession>;

const readStore = (): CacheStore => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeStore = (store: CacheStore): void => {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(store));
    } catch (err) {
        // Quota exceeded or a non-serializable value — caching is a
        // nice-to-have, never let it break the chat.
        console.error('sessionMessagesCache: write failed (non-fatal):', err);
    }
};

export const cacheSessionMessages = (
    sessionId: string,
    messages: Message[],
    history: [string, string][]
): void => {
    if (!sessionId || messages.length === 0) return;
    const store = readStore();
    store[sessionId] = { messages, history };
    writeStore(store);
};

export const getCachedSessionMessages = (sessionId: string): CachedSession | null => {
    if (!sessionId) return null;
    const store = readStore();
    return store[sessionId] ?? null;
};