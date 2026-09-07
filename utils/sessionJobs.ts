import { listSessionDocuments } from '@/apiRequests/ttt';
import type { HistoryDocumentEntry } from '@/types/history';

const SESSION_ID_KEY = 'currentSessionId';
const JOB_SESSION_KEY = 'jobSessionId';
const ACTIVE_PROJECT_KEY = 'activeProjectId';

export const GRAPH_IDS_CHANGED_EVENT = 'graphids-changed';
export const SESSION_CHANGED_EVENT = 'session-changed';
export const RESUME_SESSION_EVENT = 'resume-session';

export const notifyGraphIdsChanged = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(GRAPH_IDS_CHANGED_EVENT));
};

// documents: the resumed session's already-trained documents (from Mongo
// history), so the drawer can show them without depending on this tab's
// jobSessionId, which never uploaded them.
export const notifySessionResumed = (documents?: HistoryDocumentEntry[]) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(RESUME_SESSION_EVENT, { detail: documents ?? null }));
};

// ─── Session ID ───────────────────────────────────────────────────────────
// Written by useChatbot when currentSession is first generated so that
// useTrainPDF can read it without prop threading.

export const setCurrentSessionId = (sessionId: string): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
};

export const getCurrentSessionId = (): string => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(SESSION_ID_KEY) || '';
};

// ─── Job Session ID ───────────────────────────────────────────────────────
// Groups this tab's document uploads so the TTT backend can hand the list
// back via GET /v1/documents?session_id=XXX

export const getJobSessionId = (): string => {
    if (typeof window === 'undefined') return '';
    let jobSessionId = sessionStorage.getItem(JOB_SESSION_KEY);
    if (!jobSessionId) {
        jobSessionId = crypto.randomUUID();
        sessionStorage.setItem(JOB_SESSION_KEY, jobSessionId);
    }
    return jobSessionId;
};

export const resetJobSessionId = (): void => {
    if (typeof window === 'undefined') return;
    const jobSessionId = crypto.randomUUID();
    sessionStorage.setItem(JOB_SESSION_KEY, jobSessionId);
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

// ─── Active projects ───────────────────────────────────────────────────────
export const setActiveProjectId = (projectId: string): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
};

export const getActiveProjectId = (): string => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(ACTIVE_PROJECT_KEY) || '';
};

export const clearActiveProjectId = (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
};

export const clearCurrentSessionId = (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(SESSION_ID_KEY);
};

export const rotateJobSessionId = (): void => {
    if (typeof window === 'undefined') return;
    const jobSessionId = crypto.randomUUID();
    sessionStorage.setItem(JOB_SESSION_KEY, jobSessionId);
};

// ─── Graph IDs ────────────────────────────────────────────────────────────
// Derived on demand from the backend's session document list (source of
// truth) rather than tracked in a local sessionStorage array, so it stays
// correct across reloads and doesn't drift from server state.

export const getGraphIds = async (): Promise<string[] | null> => {
    const docs = await listSessionDocuments(getJobSessionId());
    if (!Array.isArray(docs)) return null;
    return docs.filter((d: any) => d?.state === 'COMPLETED' && d?.result_graph_id).map((d: any) => d.result_graph_id);
};