import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { ChatMessages } from '@/modules/ChatMessages';
import { Loader, ErrorAlert } from '@/components/ui';
import { getHistorySession } from '@/apiRequests';
import { HistorySessionDetail, HistoryDocumentEntry, PastConversationProps } from '@/types/history';
import { Message } from '@/types/chat';
import { getCachedSessionMessages } from '@/utils/sessionMessagesCache';

const noop = () => {};

// Past session Q&A → the Message shape ChatMessages renders (read-only).
// History in Mongo only stores graphIds, not page-level source content, so
// there's no real sourceDocs to show unless this tab already chatted in this
// session earlier (see utils/sessionMessagesCache) — in that case reuse the
// real messages; otherwise render without sourceDocs so no reference icon
// shows, rather than a fake one.
const toHistoryMessages = (detail: HistorySessionDetail): Message[] => {
    const cached = getCachedSessionMessages(detail.sessionId);
    if (cached) return cached.messages;

    return detail.chats.flatMap((chat) => [
        { type: 'userMessage', message: chat.question, src: 'test' } as Message,
        { type: 'apiMessage', message: chat.answer, src: 'talkingDb', tokens: chat.tokens } as Message,
    ]);
};

// Sources list + read-only banner, shown after the messages.
const Footer: React.FC<{ documents: HistoryDocumentEntry[] }> = ({ documents }) => (
    <div style={{ maxWidth: 820, margin: '24px auto 0', width: '100%', padding: '0 24px' }}>
        {documents.length > 0 && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Sources</div>
                {documents.map((doc, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            border: '1px solid #e5e7eb', borderRadius: 8,
                            padding: '10px 12px', marginBottom: 8, maxWidth: 360,
                        }}
                    >
                        <FileText size={18} color="#6b7280" />
                        <div style={{ fontSize: 13, color: '#374151' }}>{doc.name}</div>
                    </div>
                ))}
            </div>
        )}
        <ErrorAlert
            variant="info"
            title="This is a past conversation."
            message="Reopening a history item does not allow follow-up questions that rely on this query's context. Any new query will be treated as a new, independent question."
        />
    </div>
);

// Read-only view of a saved session: fetches it and replays the Q&A through
// the shared ChatMessages UI, with a Sources + "past conversation" footer.
const PastConversation: React.FC<PastConversationProps> = ({ sessionId, onTokensChange }) => {
    const [detail, setDetail] = useState<HistorySessionDetail | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setDetail(null);
        onTokensChange?.(null);
        getHistorySession(sessionId).then((d) => {
            if (!alive) return;
            setDetail(d);
            setLoading(false);
            const total = d?.chats.reduce((sum, chat) => sum + (chat.tokens?.total_tokens ?? 0), 0) ?? null;
            onTokensChange?.(total);
        });
        return () => { alive = false; };
    }, [sessionId]);

    const messages = useMemo(() => (detail ? toHistoryMessages(detail) : []), [detail]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <div style={{ width: 120, height: 120 }}>
                    <Loader />
                </div>
            </div>
        );
    }

    if (!detail) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6b7280' }}>
                This conversation is no longer available.
            </div>
        );
    }

    return (
        <ChatMessages
            chatId={detail.chatbotId}
            messages={messages}
            references={[]}
            loading={false}
            typingState={false}
            handleSubmit={noop}
            handleFileUpload={noop}
            footer={<Footer documents={detail.documents} />}
        />
    );
};

export default PastConversation;