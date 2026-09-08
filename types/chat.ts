import { Dispatch, SetStateAction } from 'react';
import { Document } from 'langchain/document';
import { AxiosResponse } from 'axios';
import { HistorySessionSummary } from './history';

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export type Message = {
  type: 'apiMessage' | 'userMessage';
  message: string;
  src: 'test' | 'gpt4' | 'talkingDb' | ''
  isStreaming?: boolean;
  sourceDocs?: Document[];
  step?: { [key: string]: any };
  answer?: string;
  error?: boolean;
  errorMessage?: string;
  tokens?: TokenUsage;
};

export type contextItem = {
  content: Array<string>;
  content_source: string;
};

export type contextItemArray = contextItem[];

export type Page = {
  page_number: string;
  page_body: string
};

export interface IReferences {
  documentName: string;
  pageNumber: number;
}

export interface LiveChatbot {
  file: string;
  url: string;
}
export type ChatbotsResponse = AxiosResponse<{data: LiveChatbot[]}>;
export interface SignInScreenProps {
  JSModule: any;
  onLogin: () => void;
  error?: string | null;
}

export interface ChatHeaderProps {
  drawerOpen?: boolean;
  onDrawerToggle?: () => void;
  leftPanelExpanded?: boolean;
  onToggleLeftPanel?: () => void;
  messages?: Message[]
  manageProjectsOpen?: boolean
  onToggleManageProjects?: () => void
  sessions?: HistorySessionSummary[];
  setSessions?: Dispatch<SetStateAction<HistorySessionSummary[]>>;
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  totalTokensOverride?: number | null;
  user?: { name?: string; email?: string };
  onLogout?: () => void;
}

export interface ChatTabsProps {
  messages?: Message[]
  sessions: HistorySessionSummary[];
  setSessions?: Dispatch<SetStateAction<HistorySessionSummary[]>>;
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onNewChat?: () => void;
}