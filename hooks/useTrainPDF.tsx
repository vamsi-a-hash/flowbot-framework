import { useContext, useEffect, useState, useRef } from 'react';
import { uploadDocument, getUploadConstraints, getJobProgress, cancelDocumentProcessing, listSessionDocuments, removeDocument, retryDocumentJob } from '@/apiRequests/ttt';
import { UploadConstraintsResponse } from '@/types/fileUploadStatus';
import ThemeContext from '@/contexts/ThemeContext';
import { useRouter } from 'next/router';
import { usePolling } from '@/hooks/usePolling';
import { FileUploadStatus, SessionDocument } from '@/types/fileUploadStatus';
import { getActiveProjectId, getCurrentSessionId, getJobSessionId, notifyGraphIdsChanged, SESSION_CHANGED_EVENT, RESUME_SESSION_EVENT } from '@/utils/sessionJobs';
import type { HistoryDocumentEntry } from '@/types/history';
import { toast } from 'react-toastify';

/**
 * Notify the server that a document has been processed and linked to this session.
 * Called once per file when polling confirms COMPLETED + a valid graphId is present.
 * Non-fatal — failure is logged but does not affect the upload UI.
 */
async function recordDocumentInHistory(
    file: FileUploadStatus,
    graphId: string,
    chatbotId: string
): Promise<void> {
    const sessionId = getCurrentSessionId();
    if (!sessionId || !graphId) return;

    try {
        await fetch('/api/history/document', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                chatbotId,
                graphId,
                name:  file.name,
                size:  file.size,
                type:  file.type,
                jobId: file.jobId,
            }),
        });
    } catch (err) {
        console.error('recordDocumentInHistory failed (non-fatal):', err);
    }
}

const pollProgress = async (
    uploads: FileUploadStatus[],
    cancelledRef: React.MutableRefObject<Set<string>>,
    chatbotId: string
): Promise<FileUploadStatus[]> => {
    return Promise.all(
        uploads.map(async (f) => {
            if (f.phase === 'done' || f.phase === 'cancelled' || f.phase === 'error' || !f.jobId || cancelledRef.current.has(f.jobId)) {
                return f;
            }

            try {
                const response = await getJobProgress(f?.jobId);
                const progressPercentage = response?.progress ?? f.progress ?? 0;

                const currentState = response?.state
                if (currentState == "CANCELLED") {
                    cancelledRef.current.add(f.jobId);
                    return {
                        ...f,
                        phase: "cancelled",
                        error: 'Upload cancelled',
                        progress: 0
                    };
                }
                
                if (currentState === 'FAILED') {
                    return {
                        ...f,
                        phase: 'error',
                        progress: progressPercentage,
                        error: response?.failure_reason && response?.error_message
                            ? response.error_message
                            : 'Something went wrong while processing your document',
                    };
                }

                if (currentState === 'COMPLETED') {
                    const graphId = response?.result_graph_id;
                    // Only record when we have a real graphId — guards against the
                    // race where COMPLETED fires but result_graph_id isn't set yet,
                    if (graphId) {
                        // Tell the server to persist this document in user_histories.
                        // Fire-and-forget — UI does not wait for this.
                        recordDocumentInHistory(f, graphId, chatbotId);
                    }

                return {
                    ...f,
                    graphId: graphId || f.graphId,
                    phase: currentState == "FAILED"? "error": "done",
                    progress: progressPercentage
                };
            }

                // still in progress: update percentage and surface the backend stage label
                return {
                    ...f,
                    phase: currentState === "CANCELLING"? "cancelling": "processing",
                    progress: progressPercentage,
                    stage: response?.stage
                };
            } catch (error: any) {
                console.error(`something went wrong in polling progress`, {
                    message: error?.message,
                    status: error?.response?.status,
                    responseData: error?.response?.data
                });

                return {
                    ...f,
                    phase: 'error',
                    error: 'Failed to fetch status',
                };
            }
        })
    );
};

const toCompletedDocs = (data: any[]): SessionDocument[] =>
    data
        .filter((raw: any) => raw?.state === 'COMPLETED')
        .map((raw: any) => ({
            jobId: raw?.job_id, fileName: raw?.file_name,
            fileSize: raw?.file_size, graphId: raw?.result_graph_id,
        }));

export const useTainPDF = () => {
    const router = useRouter();
    const { JSModule } = useContext(ThemeContext);
    const [trainingInProgress, setTrainingInProgress] = useState(false);
    const [uploads, setUploads] = useState<FileUploadStatus[]>([]);
    const [uploadConstraints, setUploadConstraints] = useState<UploadConstraintsResponse | null>(null);
    const cancelledRef = useRef<Set<string>>(new Set());
    const uploadsRef = useRef<FileUploadStatus[]>([]);
    const jobSessionIdRef = useRef<string>('');
    const [documentList, setDocumentList] = useState<SessionDocument[]>([]);
    const [loadingSessionDocuments, setLoadingSessionDocuments] = useState(false);
    const { 'chat-id': chatId } = router.query;

    // chatbotId needed to record documents under the right chatbot in user_histories
    const chatbotId = (chatId as string) || process.env.NEXT_PUBLIC_DEFAULT_CHAT_ID || '';

    uploadsRef.current = uploads;

    useEffect(() => {
        jobSessionIdRef.current = getJobSessionId();
        rehydrateSession();
        getUploadConstraints().then((data) => {
            if (data) setUploadConstraints(data);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onSessionChanged = () => {
            jobSessionIdRef.current = getJobSessionId();
            cancelledRef.current.clear();
            setUploads([]);
            setDocumentList([]);
            setTrainingInProgress(false);
        };
        window.addEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
        return () => window.removeEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // A resumed session's documents live in Mongo history, not under this
        // tab's jobSessionId, so listSessionDocuments(jobSessionId) can't see
        // them. When the resume event carries the session's document list,
        // use it directly; only fall back to the jobSessionId lookup (e.g.
        // brand-new chat, no history payload) when it doesn't.
        const onSessionResumed = (e: Event) => {
            const documents = (e as CustomEvent<HistoryDocumentEntry[] | null>).detail;
            if (documents) {
                setUploads([]);
                setTrainingInProgress(false);
                setDocumentList(
                    documents
                        .filter((doc) => doc.graphId)
                        .map((doc) => ({
                            jobId: doc.jobId,
                            fileName: doc.name,
                            fileSize: doc.size,
                            graphId: doc.graphId,
                        }))
                );
                return;
            }
            rehydrateSession();
        };
        window.addEventListener(RESUME_SESSION_EVENT, onSessionResumed);
        return () => window.removeEventListener(RESUME_SESSION_EVENT, onSessionResumed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // completed docs -> Trained; still-processing -> Uploads (polling resumes them)
    const rehydrateSession = async () => {
        const jobSessionId = jobSessionIdRef.current;
        if (!jobSessionId) return;

        setLoadingSessionDocuments(true);
        const data = await listSessionDocuments(jobSessionId);
        setLoadingSessionDocuments(false);

        if (!Array.isArray(data)) return;
        setDocumentList(toCompletedDocs(data));

        const inProgressStates = ['QUEUED', 'ONGOING', 'CANCELLING'];
        const seeded: FileUploadStatus[] = data
            .filter((raw: any) => inProgressStates.includes(raw?.state))
            .map((raw: any) => ({
                name: raw?.file_name || raw?.job_id,
                size: raw?.file_size || 0,
                type: '',
                progress: 0,
                phase: raw?.state === 'CANCELLING' ? 'cancelling' : 'processing',
                jobId: raw?.job_id,
                graphId: raw?.result_graph_id || '',
                startedAt: Date.now(),
            }));

        if (seeded.length) {
            setUploads((prev) => {
                const existing = new Set(prev.map((f) => f.jobId));
                return [...prev, ...seeded.filter((s) => !existing.has(s.jobId))];
            });
            setTrainingInProgress(true);
        }
    };
    const hasActiveFiles = uploads.some(
        (f: FileUploadStatus) => f.phase === 'uploading' || f.phase === 'processing' || f.phase === 'cancelling'
    );

    // move finished uploads into Trained using their polling data (/v1/documents lags)
    const mergeCompletedIntoTrained = (list: FileUploadStatus[]) => {
        const completed = list.filter((f) => f.phase === 'done' && f.jobId);
        if (!completed.length) return;
        setDocumentList((prev) => {
            const existing = new Set(prev.map((d) => d.jobId));
            const added: SessionDocument[] = completed
                .filter((f) => !existing.has(f.jobId as string))
                .map((f) => ({
                    jobId: f.jobId as string,
                    fileName: f.name,
                    fileSize: f.size,
                    graphId: f.graphId,
                }));
            if (!added.length) return prev;
            notifyGraphIdsChanged(); // let the namespace gate know private docs exist now
            return [...prev, ...added];
        });
    };

    usePolling<void>({
        fn: async () => {
            const updated = await pollProgress(uploadsRef.current, cancelledRef,chatbotId);
            setUploads(updated);
            mergeCompletedIntoTrained(updated);
        },
        interval: JSModule?.pollingInterval || 400, // configurable polling interval from backend config
        enabled: hasActiveFiles,
        shouldStop: () => !uploadsRef.current.some((f: FileUploadStatus) => f.phase === 'uploading' || f.phase === 'processing' || f.phase === 'cancelling'),
        onComplete: () => setTrainingInProgress(false),
    });

    const handleFileChange = (e: any) => {
        const files = e.target.files;
        if (files) {
            Array.from(files as FileList).forEach((file) => addFile(file));
        }
        // resetting the file input value after processing
        e.target.value = '';
    };

    const handleFileDrop = (files: FileList) => {
        Array.from(files).forEach((file) => addFile(file));
    };

    const markUploadFailed = (fileName: string, message: string) => {
        const tempId = crypto.randomUUID();
        setUploads((prev: FileUploadStatus[]) =>
            prev.map((f) =>
                f.name === fileName && !f.jobId
                    ? { ...f, jobId: tempId, phase: 'error', error: message, synthetic: true }
                    : f
            )
        );
    };

    const extOf = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';

    const validateSelectedFile = (file: File, constraints: UploadConstraintsResponse | null): string | null => {
        if (!constraints) return null;
        const ext = extOf(file.name);
        const type = constraints.supported_types.find((t) => t.extension === ext);
        if (!type) {
            const readable = constraints.supported_types.map((t) => `.${t.extension}`).join(', ');
            return `We only support ${readable} files right now.`;
        }
        if (file.size > type.max_file_size_mb * 1024 * 1024) {
            return `This file is too large (max ${type.max_file_size_mb} MB).`;
        }
        return null;
    };

    const addFile = async (file: File) => {
        const projectId = getActiveProjectId();
        const validationError = validateSelectedFile(file, uploadConstraints);
        const entry: FileUploadStatus = {
            name: file.name,
            size: file.size,
            type: file.name.split('.').pop()?.toUpperCase() || '',
            progress: 0,
            phase: 'uploading',
            jobId: '',
            graphId: '',
            startedAt: Date.now(),
        };
        if (validationError) {
            setUploads((prev: FileUploadStatus[]) => [
                ...prev,
                { ...entry, jobId: crypto.randomUUID(), phase: 'error', error: validationError },
            ]);
            return;
        }
        setUploads((prev: FileUploadStatus[]) => [...prev, entry]);
        setTrainingInProgress(true);
        
        try {
            const jobSessionId = jobSessionIdRef.current || getJobSessionId();
            jobSessionIdRef.current = jobSessionId;

            const res = await uploadDocument(file, jobSessionId, projectId);
            if (!res?.job_id) {
                markUploadFailed(file.name, res?.error_message || 'Something went wrong while processing your document.');
                return;
            }
            const { job_id } = res;
            setUploads((prev: FileUploadStatus[]) =>
                prev.map((f) =>
                    f.name === file.name && !f.jobId
                        ? { ...f, jobId: job_id, phase: f.phase === 'uploading' ? 'processing' : f.phase }
                        : f
                )
            );
        } catch {
            markUploadFailed(file.name, 'Something went wrong while processing your document.');
        }
    };

    const cancelUpload = async (jobId: string) => {
        if (!jobId) return

        setUploads((prev: FileUploadStatus[]) =>
            prev.map((f) => f.jobId === jobId ? { ...f, phase: 'cancelling', progress: 0 } : f)
        );

        const response = await cancelDocumentProcessing(jobId);

        if (!response) {
            toast("Document processing cancellation failed", { type: "error" });
            setUploads((prev: FileUploadStatus[]) =>
                prev.map((f) => (f.jobId === jobId && f.phase === 'cancelling') ? { ...f, phase: 'processing' } : f)
            );
            return;
        }

        if (response?.state === 'CANCELLED') {
            cancelledRef.current.add(jobId);
            setUploads((prev: FileUploadStatus[]) =>
                prev.map((f) => f.jobId === jobId ? { ...f, phase: 'cancelled', error: 'Upload cancelled', progress: 0 } : f)
            );
        }
    };

    const retryUpload = async (jobId: string) => {
        if (!jobId) return;

        const current = uploadsRef.current.find((f) => f.jobId === jobId);
        if (!current || current.retrying) return;

        setUploads((prev: FileUploadStatus[]) =>
            prev.map((f) => (f.jobId === jobId ? { ...f, retrying: true } : f))
        );

        const result = await retryDocumentJob(jobId);

        if (!result.ok) {
            toast(result.message || 'Retry failed', { type: 'error' });
            setUploads((prev: FileUploadStatus[]) =>
                prev.map((f) => (f.jobId === jobId ? { ...f, retrying: false } : f))
            );
            return;
        }

        cancelledRef.current.delete(jobId);
        setTrainingInProgress(true);
        setUploads((prev: FileUploadStatus[]) =>
            prev.map((f) =>
                f.jobId === jobId
                    ? {
                        ...f,
                        phase: 'processing',
                        progress: 0,
                        error: undefined,
                        stage: undefined,
                        retrying: false,
                        startedAt: Date.now(),
                    }
                    : f
            )
        );
    };

    const removeUpload = (jobId: string) => {
        cancelledRef.current.delete(jobId);
        setUploads((prev: FileUploadStatus[]) => prev.filter((f) => f.jobId !== jobId));
    };

    // delete a trained document; completed docs are terminal so the backend removes them
    const removeSessionDocument = async (jobId: string) => {
        if (!jobId) return;

        setDocumentList((prev) =>
            prev.map((d) => (d.jobId === jobId ? { ...d, removing: true } : d))
        );

        const result = await removeDocument(jobId);
        if (!result) {
            toast('Failed to remove document', { type: 'error' });
            setDocumentList((prev) =>
                prev.map((d) => (d.jobId === jobId ? { ...d, removing: false } : d))
            );
            return;
        }

        setDocumentList((prev) => prev.filter((d) => d.jobId !== jobId));
        setUploads((prev) => prev.filter((f) => f.jobId !== jobId));
        cancelledRef.current.delete(jobId);
        notifyGraphIdsChanged();
        toast('Document removed', { type: 'success' });
    };

    const canCancel = (jobId: string) => {
        const f = uploads.find((f: FileUploadStatus) => f.jobId === jobId);
        return f ? f.phase === 'processing' : false;
    };

    return {
        documentList,
        uploads,
        uploadConstraints,
        trainingInProgress,
        handleFileChange,
        handleFileDrop,
        cancelUpload,
        retryUpload,
        removeUpload,
        canCancel,
        loadingSessionDocuments,
        removeSessionDocument,
    };
}