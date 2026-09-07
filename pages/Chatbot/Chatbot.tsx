import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useChatbot } from '@/hooks/useChatbot';
import { ChatHeader } from '@/modules/ChatHeader';
import { SidePanel } from '@/modules/SideDrawer';
import { ManageProjectsDrawer } from '@/modules/ManageProjectsPanel';
import { ChatMessages } from '@/modules/ChatMessages';
import { ChatInput } from '@/modules/ChatInput';
import { Loader } from '@/components/ui';
import { SignInScreen } from './SignIn';
import DocumentTree from '@/modules/DocumentTree';
import { getDocumentTreeJSon } from '@/apiRequests/ttt';
import { DocumentTreeData } from '@/types/documentTree';
import SuggestedQueries from '@/modules/SuggestedQueries';
import HistorySidebar from '@/modules/HistorySidebar';
import { HistorySessionSummary } from '@/types/history';
import { listHistorySessions, updateSessionStatus } from '@/apiRequests';
import { GRAPH_IDS_CHANGED_EVENT, getCurrentSessionId } from '@/utils/sessionJobs';

const Chatbot: React.FC = () => {
  const {
    messages,
    loading,
    botLoading,
    query,
    setQuery,
    typingState,
    handleSubmit,
    handleInputChange,
    handleFileUpload,
    JSModule,
    open,
    setOpen,
    styles,
    references,
    chatId,
    isLoggedIn,
    isCheckingSession,
    hasOpenID,
    handleLogin,
    authError,
    setAuthError,
    namespace,
    startNewChat,
    resumeSession,
    currentSession,
    selectedGraphIds,
    setSelectedGraphIds,
  } = useChatbot();

  const showHistory = !!JSModule?.showHistory;
  const [historyReloadToken, setHistoryReloadToken] = useState(0);
  const [hasPriorSessions, setHasPriorSessions] = useState(false);
  const [sessions, setSessions] = useState<HistorySessionSummary[]>([]);
  const handleSessionsCount = useCallback((n: number) => setHasPriorSessions(n > 0), []);
  const [manageProjectsOpen, setManageProjectsOpen] = useState(false);
  // bumped whenever indexing finishes so the drawer's counts and document
  // lists reflect the upload without the user reopening it
  const [projectsReloadToken, setProjectsReloadToken] = useState(0);

  useEffect(() => {
    const onDocumentsChanged = () => setProjectsReloadToken((t) => t + 1);
    window.addEventListener(GRAPH_IDS_CHANGED_EVENT, onDocumentsChanged);
    return () => window.removeEventListener(GRAPH_IDS_CHANGED_EVENT, onDocumentsChanged);
  }, []);

  const handleSelectSession = (sessionId: string) => {
    if (sessionId === currentSession) return;
    resumeSession(sessionId);
  };

  const showNewChatTab = async () => {
    const currentSessionId = getCurrentSessionId()
    await load()
    setSessions((prev) => [
      {
        sessionId: currentSessionId,
        chatbotId: String(chatId),
        createdAt: String(new Date),
        sessionStatus: 'ACTIVE',
        firstQuestion: ""
      },
      ...prev
    ])
  }

  const handleNewChat = async () => {
    // abandoning an empty session -> close it instead of leaving a blank tab behind
    const abandonedSessionId = getCurrentSessionId();
    if (abandonedSessionId && !messages?.length) {
      await updateSessionStatus(abandonedSessionId, 'INACTIVE');
      setSessions((prev) => prev.filter((s) => s.sessionId !== abandonedSessionId));
    }
    startNewChat()
    await showNewChatTab()
    setHistoryReloadToken((t) => t + 1);
  };

  const load = useCallback(async () => {
    const data = await listHistorySessions();
    setSessions(data);
    handleSessionsCount(data.length);
  }, [handleSessionsCount]);


  useEffect(() => {
    if (!currentSession) {
      showNewChatTab();
    }
  }, [currentSession]);

  useEffect(() => {
    if (!showHistory) return;
    if (messages.length > 0) setHistoryReloadToken((t) => t + 1);
  }, [messages.length, showHistory]);

  const [leftPanelExpanded, setLeftPanelExpanded] = useState(true);
  const [showSuggestedQueries, setShowSuggestedQueries] = useState(true);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [activeTabName, setActiveTabName] = useState<string>('chat');
  const [documentTreeLoading, setDocumentTreeLoading] = useState<boolean>(false);
  const [documentTreeJSon, setDocumentTreeJSon] = useState<DocumentTreeData | null>(null);

  const handleSuggestedQueries = (queries: string[]) => {
    if (queries?.length > 0) {
      setShowSuggestedQueries(true)
      setSuggestedQueries(queries)
    } else {
      setShowSuggestedQueries(false)
    }
  }

  const latestRequestRef = useRef(0);
  const switchTab = async (tabName: string, graphId: string = '') => {
    setActiveTabName(tabName)

    // if documentTree tab is being selected, then setting the graphId of selected document;
    if (tabName === 'documentTree') {
      const requestId = ++latestRequestRef.current;
      setDocumentTreeLoading(true);

      try {
        const response = await getDocumentTreeJSon(graphId);
        if (requestId === latestRequestRef.current && response) {
          setDocumentTreeJSon(response);
        }
      } finally {
        if (requestId === latestRequestRef.current) {
          setDocumentTreeLoading(false);
        }
      }
    }
  }

  // Set up window functions immediately (for headerPaneHtml onclick handlers)
  if (typeof window !== 'undefined') {
    (window as any).toggleDrawer = () => setOpen(!open);
    (window as any).toggleLeftPanel = () => setLeftPanelExpanded(prev => !prev);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).toggleDrawer;
        delete (window as any).toggleLeftPanel;
      }
    };
  }, []);

  if (hasOpenID && isCheckingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div style={{ width: '150px', height: '150px' }}>
          <Loader />
        </div>
      </div>
    );
  }

  if (hasOpenID && !isLoggedIn) {
    return (
      <SignInScreen
        JSModule={JSModule}
        onLogin={() => { setAuthError(null); handleLogin(); }}
        error={authError}
      />
    );
  }

  if (botLoading || !JSModule?.enabled) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div style={{ width: '150px', height: '150px' }}>
          <Loader />
        </div>
      </div>
    )
  }
  else {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <ChatHeader
          drawerOpen={open}
          onDrawerToggle={() => setOpen(!open)}
          leftPanelExpanded={leftPanelExpanded}
          onToggleLeftPanel={() => setLeftPanelExpanded((v) => !v)}
          messages={messages}
          manageProjectsOpen={manageProjectsOpen}
          onToggleManageProjects={() => setManageProjectsOpen((v) => !v)}
          sessions={sessions}
          setSessions={setSessions}
          activeSessionId={currentSession}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
        />
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}>
          {showHistory ? (
            leftPanelExpanded && (
              <HistorySidebar
                selectedSessionId={currentSession}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                reloadToken={historyReloadToken}
                onCountChange={handleSessionsCount}
              />
            )
          ) : leftPanelExpanded && JSModule?.leftPanelHtml ? (
            <div
              className={styles?.['sidebar']}
              dangerouslySetInnerHTML={{ __html: JSModule.leftPanelHtml }}
            />
          ) : null}

          {/* Main Content Area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            overflow: 'hidden',
            minWidth: 0,
          }}>
            <div style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'row',
            }}>

              {
                activeTabName === 'documentTree' ? (
                  <div
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      minWidth: 0,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    <button
                      onClick={() => setActiveTabName('chat')}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 1000,
                        width: 32,
                        height: 32,
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        background: '#fff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                      }}
                    >
                      ✕
                    </button>
                    {
                      documentTreeLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                          <div style={{ width: '150px', height: '150px' }}>
                            <Loader />
                          </div>
                        </div>
                      ) : (
                        documentTreeJSon?.nodes?.length ? (
                          <DocumentTree data={documentTreeJSon} />
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              width: '100%',
                              height: '100%',
                              fontSize: '16px',
                              color: '#666',
                            }}
                          >
                            Document tree is not available at this moment.
                          </div>
                        )
                      )
                    }
                  </div>
                ) : (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                  }}>
                    <div style={{
                      flex: 1,
                      overflow: 'auto',
                    }}>
                      <ChatMessages
                        chatId={String(chatId)}
                        references={references}
                        messages={messages}
                        loading={loading}
                        handleSubmit={handleSubmit}
                        handleFileUpload={handleFileUpload}
                        typingState={typingState}
                        onUploadClick={JSModule?.drawerEnabled ? () => setOpen(true) : undefined}
                      />
                    </div>
                    {
                      showSuggestedQueries && !hasPriorSessions && messages?.length == 0 && query === "" && (
                        <SuggestedQueries setQuery={setQuery} suggestedQuestions={suggestedQueries} />
                      )
                    }
                    <ChatInput
                      query={query}
                      messages={messages}
                      typingState={typingState}
                      loading={loading}
                      onSubmit={handleSubmit}
                      onChange={setQuery}
                      onAddClick={JSModule?.drawerEnabled ? () => setOpen(true) : undefined}
                    />
                  </div>
                )
              }
              {JSModule?.drawerEnabled && (
                <SidePanel
                  switchTab={switchTab}
                  open={open}
                  currentSession={currentSession}
                  setOpen={setOpen}
                  namespace={namespace}
                  handleSuggestedQueries={handleSuggestedQueries} 
                  hideDemoDocs={hasPriorSessions} 
                  selectedGraphIds={selectedGraphIds}
                  setSelectedGraphIds={setSelectedGraphIds}
                />
              )}
              <ManageProjectsDrawer
                open={manageProjectsOpen}
                onClose={() => setManageProjectsOpen(false)}
                reloadToken={projectsReloadToken}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Chatbot;