export type UploadPhase = 'uploading' | 'processing' | 'done' | 'error' | 'cancelling' | 'cancelled';

export type FileUploadStatus = {
    name: string;
    size: number;
    type: string;
    progress: number;
    phase: UploadPhase;
    jobId?: string;
    graphId?: string;
    error?: string;
    stage?: string;
    startedAt?: number;
    retrying?: boolean;
    synthetic?: boolean;
    sessionId?: string;
};

export type SessionDocument = {
    jobId: string;
    fileName?: string;
    fileSize?: number;
    graphId?: string;
    removing?: boolean;
};

export interface UploadConstraint {
    extension: string;
    mime_type: string;
    max_file_size_mb: number;
}

export interface UploadConstraintsResponse {
    supported_types: UploadConstraint[];
    max_file_size_mb: number;
}
