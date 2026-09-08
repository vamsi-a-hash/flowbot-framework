import { Dispatch, SetStateAction } from 'react';
import { TokenUsage } from "./chat";

export interface HistorySessionSummary {
    sessionId: string;
    chatbotId: string;
    createdAt: string;
    sessionStatus: string;
    firstQuestion: string | null;
}

export interface HistoryChatEntry {
    question: string;
    answer: string;
    graphIds: string[];
    tokens?: TokenUsage;
    askedAt: string;
}

export interface HistoryDocumentEntry {
    name: string;
    size: number;
    type: string;
    jobId: string;
    graphId: string;
    uploadedAt: string;
}

export interface HistorySessionDetail {
    sessionId: string;
    chatbotId: string;
    email: string | null;
    createdAt: string;
    updatedAt: string;
    documents: HistoryDocumentEntry[];
    chats: HistoryChatEntry[];
}

export interface HistorySidebarProps {
    selectedSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
    sessions: HistorySessionSummary[];
    setSessions: Dispatch<SetStateAction<HistorySessionSummary[]>>;
    loading: boolean;
}

export interface PastConversationProps {
    sessionId: string;
    onTokensChange?: (total: number | null) => void;
}
