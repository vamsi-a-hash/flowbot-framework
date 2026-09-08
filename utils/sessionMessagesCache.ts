import { Message } from '@/types/chat';

const CACHE_KEY = 'chatSessionMessagesCache_v1';
const MAX_CACHED_SESSIONS = 20;

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

const evictIfNeeded = (store: CacheStore): CacheStore => {
    const ids = Object.keys(store);
    if (ids.length <= MAX_CACHED_SESSIONS) return store;
    const toDrop = ids.slice(0, ids.length - MAX_CACHED_SESSIONS);
    const next = { ...store };
    toDrop.forEach((id) => delete next[id]);
    return next;
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
    let store = readStore();
    delete store[sessionId]; // move-to-end for simple FIFO
    store[sessionId] = { messages, history };
    store = evictIfNeeded(store);
    writeStore(store);
};

export const clearCachedSession = (sessionId: string): void => {
    if (typeof window === 'undefined') return;
    const store = readStore();
    if (!(sessionId in store)) return;
    delete store[sessionId];
    writeStore(store);
};

export const getCachedSessionMessages = (sessionId: string): CachedSession | null => {
    if (!sessionId) return null;
    const store = readStore();
    return store[sessionId] ?? null;
};