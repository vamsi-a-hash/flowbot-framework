import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Plus, MoreVertical, Trash2, Eye } from 'lucide-react';
import { deleteHistorySession } from '@/apiRequests';
import { MenuItem, ConfirmDialog, EmptyState } from '@/components/ui';
import { HistorySessionSummary, HistorySidebarProps } from '@/types/history';

const COLORS = {
    accent: '#3b82f6',
    accentSoft: '#eff6ff',
    border: '#e5e7eb',
    textMuted: '#6b7280',
    danger: '#ef4444',
};

const HistorySidebar: React.FC<HistorySidebarProps> = ({
    selectedSessionId,
    onSelectSession,
    onNewChat,
    sessions,
    setSessions,
    loading,
}) => {
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<HistorySessionSummary | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close the ⋮ menu when clicking outside it.
    useEffect(() => {
        if (!menuFor) return;
        const onDocClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuFor(null);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [menuFor]);

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        setDeleteError(null);
        const { ok, status } = await deleteHistorySession(pendingDelete.sessionId);
        setDeleting(false);
        // 404 = already gone → treat as removed. Only a real failure (500/network) errors.
        if (ok || status === 404) {
            setSessions((prev) => prev.filter((s) => s.sessionId !== pendingDelete.sessionId));
            if (selectedSessionId === pendingDelete.sessionId) {
                onNewChat(); // deleted the session we were viewing → back to live chat
            }
            setPendingDelete(null);
        } else {
            setDeleteError('Couldn’t delete this chat. Please try again.');
        }
    };

    return (
        <div
            style={{
                width: 260,
                height: '100%',
                background: '#ffffff',
                borderRight: `1px solid ${COLORS.border}`,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 260,
            }}
        >
            {/* New chat */}
            <div style={{ padding: 16 }}>
                <button
                    onClick={onNewChat}
                    className="flex items-center justify-center gap-2 w-full p-3 border bg-white rounded text-sm font-semibold cursor-pointer hover:bg-gray-100"
                    style={{
                        borderColor: COLORS.border,
                        color: COLORS.accent,
                    }}
                >
                    <Plus size={18} />
                    New chat
                </button>
            </div>

            {/* History label */}
            <div
                style={{
                    padding: '0 16px 8px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#111827',
                }}
            >
                History
            </div>

            {/* List / empty state */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                {loading ? null : sessions.length === 0 ? (
                    <EmptyState />
                ) : (
                    sessions.map((s) => {
                        const isActive = s.sessionId === selectedSessionId;
                        const label = s.firstQuestion || 'New Chat';
                        return (
                            <div
                                key={s.sessionId}
                                onClick={() => onSelectSession(s.sessionId)}
                                style={{
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 10px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    background: isActive ? COLORS.accentSoft : 'transparent',
                                    borderLeft: isActive
                                        ? `3px solid ${COLORS.accent}`
                                        : '3px solid transparent',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) e.currentTarget.style.background = '#f9fafb';
                                    const btn = e.currentTarget.querySelector<HTMLElement>('[data-menu-btn]');
                                    if (btn) btn.style.opacity = '1';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) e.currentTarget.style.background = 'transparent';
                                    if (menuFor !== s.sessionId) {
                                        const btn = e.currentTarget.querySelector<HTMLElement>('[data-menu-btn]');
                                        if (btn) btn.style.opacity = '0';
                                    }
                                }}
                            >
                                <MessageSquare size={16} color={COLORS.textMuted} style={{ flexShrink: 0 }} />
                                <span
                                    style={{
                                        flex: 1,
                                        fontSize: 14,
                                        color: '#374151',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {label}
                                </span>

                                <button
                                    data-menu-btn
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuFor((cur) => (cur === s.sessionId ? null : s.sessionId));
                                    }}
                                    style={{
                                        opacity: menuFor === s.sessionId ? 1 : 0,
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        padding: 2,
                                        display: 'flex',
                                        color: COLORS.textMuted,
                                    }}
                                >
                                    <MoreVertical size={16} />
                                </button>

                                {menuFor === s.sessionId && (
                                    <div
                                        ref={menuRef}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 8,
                                            zIndex: 50,
                                            background: '#fff',
                                            border: `1px solid ${COLORS.border}`,
                                            borderRadius: 10,
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                            padding: '4px 0',
                                            minWidth: 130,
                                        }}
                                    >
                                        <MenuItem
                                            icon={<Trash2 size={15} />}
                                            label="Delete"
                                            danger
                                            onClick={() => {
                                                setMenuFor(null);
                                                setDeleteError(null);
                                                setPendingDelete(s);
                                            }}
                                        />
                                        <MenuItem
                                            icon={<Eye size={15} />}
                                            label="View"
                                            onClick={() => {
                                                setMenuFor(null);
                                                onSelectSession(s.sessionId);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {pendingDelete && (
                <ConfirmDialog
                    title="Delete this chat?"
                    message="This action cannot be undone."
                    confirmLabel="Delete"
                    danger
                    loading={deleting}
                    error={deleteError ?? undefined}
                    onCancel={() => { setPendingDelete(null); setDeleteError(null); }}
                    onConfirm={confirmDelete}
                />
            )}
        </div>
    );
};

export default HistorySidebar;
