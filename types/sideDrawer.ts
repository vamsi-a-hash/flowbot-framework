import React, { Dispatch, SetStateAction } from 'react';
import { NamespaceState } from '@/types/namespace';
import { SessionDocument } from '@/types/fileUploadStatus';

export interface SideDrawerProps {
    open: boolean;
    setOpen: (val: boolean) => void;
    switchTab: (tabName: string, graphId?: string) => Promise<void>;
    namespace?: NamespaceState;
    handleSuggestedQueries: (val: string[]) => void;
    hideDemoDocs?: boolean;
    selectedGraphIds: string[]
    setSelectedGraphIds: Dispatch<SetStateAction<string[]>>;
    currentSession?: string; 
}

export interface DemoDocsSectionProps {
    styles: any;
    namespace: NamespaceState;
    handleSuggestedQueries: (val: string[]) => void;
}

export interface UploadDropZoneProps {
    styles: any;
    dragOver: boolean;
    setDragOver: (val: boolean) => void;
    handleFileDrop: (files: FileList) => void;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    accept?: string;
    hint?: string;
}

export interface UploadFileCardProps {
    styles: any;
    file: any;
    canCancel: (jobId: string) => boolean;
    cancelUpload: (jobId: string) => void;
    retryUpload: (jobId: string) => void;
    removeUpload: (jobId: string) => void;
}

export interface UploadsSectionProps {
    styles: any;
    uploads: any[];
    canCancel: (jobId: string) => boolean;
    cancelUpload: (jobId: string) => void;
    retryUpload: (jobId: string) => void;
    removeUpload: (jobId: string) => void;
}

export interface TrainedDocumentsProps {
    styles: any;
    documentList: SessionDocument[];
    loading: boolean;
    removeSessionDocument: (jobId: string) => void;
    switchTab: (tabName: string, graphId?: string) => Promise<void>;
    selectedGraphIds: string[]
    setSelectedGraphIds: Dispatch<SetStateAction<string[]>>;
}
