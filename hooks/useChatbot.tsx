import React, { useState, useEffect, useContext, useRef } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';
import { Message, IReferences } from '@/types/chat';
import {
    getDefaultPromptTemplate,
    resetPromptTemplate,
    submitPromptTemplate,
    getHistorySession
} from '@/apiRequests';

import type { Socket } from 'socket.io-client';
import ThemeContext from '@/contexts/ThemeContext';
import { generateRandomString } from '@/utils/generateRandomeString';
import { getDocumentNameAndPageNumber } from '@/utils/extractDocumentNameAndPage';
import { GRAPH_IDS_CHANGED_EVENT, SESSION_CHANGED_EVENT } from '@/utils/sessionJobs';
import { getCurrentSessionId, getGraphIds, setCurrentSessionId, resetJobSessionId,rotateJobSessionId, clearActiveProjectId, notifySessionResumed, clearCurrentSessionId } from '@/utils/sessionJobs';
import { cacheSessionMessages, getCachedSessionMessages } from '@/utils/sessionMessagesCache';
import { listPublicNamespaces, listPublicNamespaceDocuments } from '@/apiRequests/ttt';
import { NamespaceMode, PublicDocument, NamespaceState } from '@/types/namespace';
// TODO(demo-seed): temporary frontend demo docs; remove once demo-library is seeded on the backend
import { DEMO_FALLBACK_DOCS } from '@/data/demoFallbackDocs';

declare const window: any;

const AUTH_SESSION_URL = '/api/auth/session';
const buildRedirectUri = (chatId: string) => `${window.location.origin}/?chat-id=${chatId}`;

export const useChatbot = () => {
    const router = useRouter();
    const { 'chat-id': chatIdParam, code: openidCode, error: oauthError } = router.query;
    const chatId = chatIdParam || process.env.NEXT_PUBLIC_DEFAULT_CHAT_ID;

    // State declarations
    const [botLoading, setBotLoading] = useState<boolean>(true);
    const [initChat, setInitChat] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [query, setQuery] = useState<string>('');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [roomId, setRoomId] = useState<string>('');
    const [registrationMessage, setRegistrationMessage] = useState<any>(null);
    const [isSignupPage, setIsSignupPage] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [promptTemplate, setPromptTemplate] = useState<string>('');
    const [newChatRoom, setNewChatRoom] = useState<string>('');
    const [currentSession, setCurrentSession] = useState<string>('');
    // bumped on every startNewChat/resumeSession so a response for the
    // previously-active session can't be applied after the user has switched
    const sessionEpochRef = useRef(0);
    // graphIds pulled from this session's persisted Mongo documents on resume;
    // merged with the live jobSessionId-derived cachedGraphIds at query time
    const [seededGraphIds, setSeededGraphIds] = useState<string[]>([]);
    const [content, setContent] = useState('');
    const [open, setOpen] = useState(true);
    const [hiddenInput, setHiddenInput] = useState(false);
    const [references, setReferences] = useState<IReferences[]>([]);
    const [messageState, setMessageState] = useState<{
        messages: Message[];
        pending?: string;
        history: [string, string][];
        pendingSourceDocs?: Document[];
    }>({
        messages: [],
        history: [],
    });
    const [typingState, setTypingState] = useState<boolean>(false);

    const [socketState, setSocketState] = useState(false);
    const [socketInitstate, setSocketInitstate] = useState(false)
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    // --- Public/private document namespace switch ---
    const [graphIdsVersion, setGraphIdsVersion] = useState(0);
    const [selectedGraphIds, setSelectedGraphIds] = useState<string[]>([]);
    const [cachedGraphIds, setCachedGraphIds] = useState<string[]>([]);
    const [hasPrivateDocs, setHasPrivateDocs] = useState(false);
    const [publicDocs, setPublicDocs] = useState<PublicDocument[]>([]);
    const [activeDocId, setActiveDocId] = useState<string | null>(null);
    const [demoActivated, setDemoActivated] = useState(false);

    useEffect(() => {
        const bump = () => setGraphIdsVersion((v) => v + 1);
        window.addEventListener(GRAPH_IDS_CHANGED_EVENT, bump);
        const onSessionChanged = () => {
            setCachedGraphIds([]);
            setSelectedGraphIds([])
            setSeededGraphIds([]);
            setHasPrivateDocs(false);
        };
        window.addEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
        return () => {
            window.removeEventListener(GRAPH_IDS_CHANGED_EVENT, bump);
            window.removeEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
        };
    }, []);

    // Fetch once per change (upload done / remove / focus) and cache; the chat
    // send reads the cache instead of hitting /v1/documents every message.
    useEffect(() => {
        let alive = true;
        getGraphIds().then((ids) => {
            if (!alive || ids === null) return;
            setCachedGraphIds(ids);
            setHasPrivateDocs(ids.length > 0);
        });
        return () => { alive = false; };
    }, [graphIdsVersion]);

    const namespaceMode: NamespaceMode = hasPrivateDocs ? 'private' : 'public';

    useEffect(() => {
        if (hasPrivateDocs) return;          // a private-doc session exists → public not needed
        if (publicDocs.length > 0) return;   // demo docs are static → fetch once, then reuse
        let cancelled = false;
        (async () => {
            // Discover the public (demo) namespace, then load its documents.
            const namespaces = await listPublicNamespaces();
            if (cancelled) return;
            const namespace = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces[0]?.namespace : null;
            const fetched = namespace ? await listPublicNamespaceDocuments(namespace) : false;
            if (cancelled) return;
            // TODO(demo-seed): drop the DEMO_FALLBACK_DOCS fallback once the backend seeds the public namespace.
            const docs = fetched && fetched.length > 0 ? fetched : DEMO_FALLBACK_DOCS;
            setPublicDocs(docs);
            setActiveDocId((prev) => prev ?? docs[0]?.id ?? null);
        })();
        return () => { cancelled = true; };
    }, [hasPrivateDocs, publicDocs.length]);

    const activeDoc = publicDocs.find((d) => d.id === activeDocId) || null;
    const resolveGraphIds = (): string[] =>
        namespaceMode === 'public' && demoActivated && activeDoc?.result_graph_id
            ? [activeDoc.result_graph_id]
            : Array.from(new Set([...seededGraphIds, ...cachedGraphIds]));


    const activateDemo = () => {
        setDemoActivated(true);
        setActiveDocId((prev) => prev ?? publicDocs[0]?.id ?? null);
    };

    const namespace: NamespaceState = {
        mode: namespaceMode,
        hasPrivateDocs,
        publicDocs,
        activeDocId,
        activeDoc,
        setActiveDoc: setActiveDocId,
        demoActivated,
        activateDemo,
    };

    const { JSModule, styles } = useContext(ThemeContext) || {};

    // Poll session status: fires on mount, on tab focus, and every 5 min while tab is visible.
    useEffect(() => {
        if (!router.isReady) return;
        let initialised = false;
        const checkSession = () => {
            if (document.visibilityState !== 'visible') return;
            fetch(AUTH_SESSION_URL)
                .then(r => r.json())
                .then(({ isLoggedIn }) => {
                    setIsLoggedIn(!!isLoggedIn);
                    if (!initialised) {
                        setIsCheckingSession(false);
                        initialised = true;
                    }
                })
                .catch((err) => {
                    if (!initialised) {
                        setIsLoggedIn(false);
                        setIsCheckingSession(false);
                        initialised = true;
                    }
                });
        };

        if (!openidCode) {
            checkSession();
        }
        const id = setInterval(checkSession, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', checkSession);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', checkSession);
        };
    }, [router.isReady, openidCode]);

    // Check if OpenID is configured
    const hasOpenID = JSModule?.openid?.authorization_endpoint && JSModule?.openid?.client_id;

    const handleLogin = () => {
        if (JSModule?.openid?.authorization_endpoint && chatId) {
            const state = crypto.randomUUID();
            sessionStorage.setItem('oauth_state', state);
            const redirectUri = buildRedirectUri(chatId as string);
            const authUrl = `${JSModule.openid.authorization_endpoint}?` +
                `client_id=${encodeURIComponent(JSModule.openid.client_id)}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent(JSModule.openid.scopes_supported?.join(' ') || 'openid profile email')}&` +
                `state=${encodeURIComponent(state)}&` +
                `prompt=select_account`;
            window.location.href = authUrl;
        }
    };

    const handleLogout = async () => {
        const response = await fetch(AUTH_SESSION_URL, { method: 'DELETE' });
        setIsLoggedIn(false);
        clearCurrentSessionId();
        resetJobSessionId();
        clearActiveProjectId();
        if (JSModule?.handleHeaderPane) {
            JSModule.handleHeaderPane('logout');
        }

        if (response.ok) {
            window.location.href = '/';
        }
    };
    const { messages, history } = messageState;

    // Mirror every turn into this tab's session cache so its real sourceDocs
    // (from /api/chat, not a reconstruction) are available if the user
    // switches tabs and comes back — see utils/sessionMessagesCache.
    // IMPORTANT: depends only on [messages, history], not currentSession.
    // resumeSession() sets currentSession before its history fetch resolves,
    // so there's a transitional render where currentSession already points
    // at the new session but messageState still holds the outgoing session's
    // messages. If currentSession were a dependency here, that render would
    // re-fire this effect and cache the OLD messages under the NEW
    // session's id — which resumeSession then reads back as a false cache
    // hit, showing the wrong conversation.
    useEffect(() => {
        if (!currentSession || messages.length === 0) return;
        cacheSessionMessages(currentSession, messages, history);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, history]);

    // Effect for initializing chat and socket
    useEffect(() => {
        // Function to initialize chat
        const initializeChat = async () => {
            setBotLoading(true);
            if (chatId) {
                if (typeof chatId === 'string') {
                    setNewChatRoom(chatId);
                    if (!currentSession) {
                        const existingSessionId = getCurrentSessionId();
                        if (existingSessionId) {
                            await resumeSession(existingSessionId);
                        } else {
                            startNewChat();
                        }
                    }
                }
                setBotLoading(false);
            }
        };
        initializeChat();
        if (JSModule?.socket_base_url) {
            initializeSocket();
        }
    }, [chatId, JSModule?.socket_base_url]);

    // here we will be updating the messages we are getting from api server through socket io
    useEffect(() => {
        const socket = io({
          path: '/api/socket',
        });
        setRoomId(localStorage?.getItem('conversation_id') || '')
    
        socket.on('connect', () => {
          console.log('Connected to websocket server for the messages from hcinbox');

          if (roomId) {
              socket.emit('joinRoom', roomId);
          }
        });
    
        socket.on('updateMessageState', (message) => {

            console.log('yes we got emitted updateMessageState and now its in client');
            console.log('message is', message);
            
            setMessageState((state: any) => ({
                ...state,
                messages: [
                    ...state.messages,
                    {
                        type: 'apiMessage',
                        message: `${message}`,
                        src: 'talkingDb',
                        step: {},
                        id: Math.random(),
                    },
                ],
            }));
        });
    
        return () => {
          socket.disconnect();
        };
    }, [roomId]);


    // Function to initialize socket
    const initializeSocket = async () => {
        // Logic to set up socket connection
        console.log('socket base url____', JSModule?.socket_base_url)
        await fetch('/api/chat-socket');
        const newSocket = io(`${JSModule?.socket_base_url}`, { path: '/socket.io' });


        console.log('current session----', currentSession);


        newSocket.on('connect', () => {
            console.log('connected');
            newSocket.emit('join-room', currentSession);
        });

        newSocket.on('received-slack-message', (data: any) => {
            console.log('slack-message received', data)
            setMessageState((state: any) => ({
                ...state,
                messages: [
                    ...state.messages,
                    {
                        type: 'apiMessage',
                        message: `${data.message}`,
                        src: 'talkingDb',
                        step: {},
                        id: Math.random(),
                    },
                ],
            }));
            setTypingState(false);
        })

        newSocket.on('received-slack-user-typing', (data: any) => {
            console.log('typing data received =>', data);
            setTypingState(true);
        })

        newSocket.on('close-socket-connection', (data: any) => {
            if (socketState) {
                console.log('socket closed successfully', data)
                setSocketState(false)
                handleSubmit('dummy')
            }
        })

        setSocket(newSocket);

        return () => newSocket.disconnect();
    };


    useEffect(() => {
        if (!initChat && !isCheckingSession && JSModule && JSModule?.conversational && chatId) {
            setInitChat(true);
            handleSubmit();
        } else {
            setInitChat(false);
            setMessageState({
                messages: [],
                history: [],
            });
        }
        if (JSModule) {
            window.handleLeftPanel = JSModule?.handleLeftPanel;
            window.handleHeaderPane = JSModule?.handleHeaderPane;
            window.handleLogout = handleLogout;
        }
    }, [JSModule, isCheckingSession]);

    useEffect(() => {
        if (isLoggedIn && JSModule?.handleHeaderPane) {
            JSModule?.handleHeaderPane('login');
        }
    }, [JSModule?.handleHeaderPane, isLoggedIn]);

    useEffect(() => {
        const controller = new AbortController();

        const fail = (message: string) => {
            setAuthError(message);
            setIsCheckingSession(false);
        };

        const fetchToken = async () => {
            if (oauthError) {
                fail('Authentication was cancelled or interrupted. No account was created.');
                return;
            }

            if (openidCode && JSModule?.openid) {
                const returnedState = router.query.state;
                const savedState = sessionStorage.getItem('oauth_state');
                if (!returnedState || returnedState !== savedState) {
                    fail('Authentication failed due to a security check. Please try again.');
                    return;
                }
                sessionStorage.removeItem('oauth_state');
                try {
                    // Must exactly match the redirect URI used in handleLogin
                    const redirectUri = buildRedirectUri(chatId as string);
                    const response = await fetch(AUTH_SESSION_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code: openidCode,
                            tokenEndpoint: JSModule?.openid?.token_endpoint,
                            clientId: JSModule?.openid?.client_id,
                            redirectUri,
                        }),
                        signal: controller.signal,
                    });

                    if (response.ok) {
                        setIsLoggedIn(true);
                        setIsCheckingSession(false);
                        router.replace(`/?chat-id=${chatId}`, undefined, { shallow: true });
                    } else {
                        fail('We couldn\'t sign you in. Please try again.');
                    }
                } catch (err) {
                    if ((err as Error).name === 'AbortError') return;
                    fail('Something went wrong while trying to sign in. Please try again.');
                }
            }
        };

        fetchToken();
        return () => controller.abort();
    }, [openidCode, JSModule?.openid]);

    async function nextStep() {
        setActiveIndex(1);
        handleSubmit();
    }

    const changeSocketState = async () => {
        setSocketInitstate(!socketInitstate)
    }

    // Function to handle form submission
    const handleSubmit = async (value?: string, update: boolean = false, socketMode: boolean = false) => {
        setLoading(true);
        console.log('socket status', socketState)
        if (socketMode) {
            setLoading(false)
        }
        if (socketState && !value) {
            setQuery('');
            console.log('inside setSocket true', value)
            console.log('inside setSocket query', query)
            await handleSocket(query);
            setLoading(false);
        } else {
            let question = query.trim();
            if (!query) {
                question = value?.trim() || '';
            }
            if (!query && question && JSModule?.showRadioSelection) {
                if (question) {
                    console.log('questionm', question)
                    setMessageState((state: any) => ({
                        ...state,
                        messages: [
                            ...state.messages,
                            {
                                type: 'userMessage',
                                // message: `${question ? question : JSON.parse(question)['label']}`,
                                message: `${value == 'contact us' ? question : JSON.parse(question)['label']}`,
                                src: "test",
                                id: Math.random(),
                            },
                        ],
                    }));
                }
            }

            if (query && JSModule?.showUserResponseFirst) {
                if (question) {
                    console.log('questionm', question)
                    setMessageState((state: any) => ({
                        ...state,
                        messages: [
                            ...state.messages,
                            {
                                type: 'userMessage',
                                message: `${question}`,
                                src: "test",
                                id: Math.random(),
                            },
                        ],
                    }));
                }
            }
            setQuery('');
            // captured now so we can tell, once the response comes back, whether
            // the user has since switched to a different chat tab (startNewChat/
            // resumeSession bump this) — if so, the response must be dropped
            const myEpoch = sessionEpochRef.current;
            try {
                // private mode -> session graph ids; public mode -> active demo doc graph
                const allGraphIds = resolveGraphIds()
                let access_token = localStorage.getItem('access_token');
                const conversation_id = localStorage.getItem('conversation_id')
                const currentSessionId = getCurrentSessionId()
                const response = await fetch(
                    `/api/chat?chatBotId=${newChatRoom}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${access_token}`,
                        },
                        body: JSON.stringify({
                            conversation_id,
                            question,
                            // if no document have selected, senting all the available;
                            graphIds: selectedGraphIds.length? selectedGraphIds: allGraphIds,
                            history,
                            session: currentSessionId,
                            reqQuery: router.query,
                            edit: update,
                        })
                    },
                );
                if (response.status === 401) {
                    fetch(AUTH_SESSION_URL, { method: 'DELETE' });
                    setIsLoggedIn(false);
                    setLoading(false);
                    return;
                }
                if (!response.ok) {
                    throw new Error(`Chat request failed: ${response.status}`);
                }
                let data: any;
                let pushed = false;
                const streamId = Math.random();

                if (response.headers.get('content-type')?.startsWith('text/event-stream') && response.body) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const frames = buffer.split('\n\n');
                        buffer = frames.pop() || '';

                        for (const frame of frames) {
                            const line = frame.trim();
                            if (!line.startsWith('data: ')) continue;
                            let evt: any;
                            try {
                                evt = JSON.parse(line.slice(6));
                            } catch {
                                console.error('Discarding malformed SSE frame', line);
                                continue;
                            }

                            if (evt.type === 'token') {
                                setMessageState((state: any) => ({
                                    ...state,
                                    messages: pushed
                                        ? state.messages.map((m: any) =>
                                              m.id === streamId ? { ...m, message: m.message + evt.chunk } : m
                                          )
                                        : [
                                              ...state.messages,
                                              {
                                                  type: 'apiMessage',
                                                  message: evt.chunk,
                                                  src: 'talkingDb',
                                                  id: streamId,
                                              },
                                          ],
                                }));
                                pushed = true;
                            } else if (evt.type === 'final') {
                                data = evt.payload;
                            }
                        }
                    }
                    if (!data) {
                        throw new Error('Stream ended before the final frame');
                    }
                } else {
                    data = await response.json();
                }
                console.log("data", data)

                if (myEpoch !== sessionEpochRef.current) {
                    // switched to a different chat tab while this request was in
                    // flight — do not apply a stale response to the live state
                    return;
                }

                // it is the case user sent message to human agent;
                if ( data?.messageHandovered) {
                    console.log(`yess message is handovered`);
                    setLoading(false);
                    return
                }

                if (data?.conversationId) {
                    console.log(`yes we got conversationId ${data?.conversationId}`);
                    localStorage.setItem("conversation_id", data?.conversationId)
                    setRoomId(data?.conversationId)
                }
                
                const message: string = data?.errorMessage;
                if ( message && message.includes('For more information,') ){
                    const { documentName, pageNumbers } = getDocumentNameAndPageNumber(message)
                    pageNumbers?.map((pageNumber) => {
                      setReferences((prev) => [ ...prev, { documentName, pageNumber: Number(pageNumber)}])
                    })
                }
                if (data?.redirect) {
                    window.location.href = data.redirect;
                    return;
                }
                if (data?.currentStep?.windowOpen) {
                    window.open(data?.currentStep?.windowOpen, "_blank")
                }
                if (data?.currentStep?.updateLeftPanel) {
                    window.handleLeftPanel = data?.currentStep?.updateLeftPanel;
                }
                if (
                    data?.currentStep?.inputType === 'socket' && data?.src === 'apiMessage'
                ) {
                    setSocketState(true)
                }
                else if (data?.currentStep?.inputType === 'socket') {
                    await changeSocketState()
                    setSocketState(true)
                    handleSubmit('', false, true);
                }
                if (data?.currentStep?.await) {
                    setTimeout(() => {
                        handleSubmit('dummy', false);
                    }, data.currentStep.await);
                }
                if (data.error) {
                    if (data?.currentStep?.hideUserResponse) {
                        let stepInfo = JSON.parse(JSON.stringify(data.currentStep));
                        {
                            /* @ts-ignore */
                        }
                        stepInfo['inputType'] = 'text';
                        if (data.currentStep.showQuestion) {
                            setMessageState((state: any) => ({
                                ...state,
                                messages: [
                                    ...state.messages,
                                    {
                                        type: 'apiMessage',
                                        message: `${data.errorMessage}`,
                                        src: data.src,
                                        step: stepInfo || {},
                                        sourceDocs: data.sourceDocuments,
                                        tokens: data.tokens,
                                        id: Math.random(),
                                    },
                                    {
                                        type: 'apiMessage',
                                        message: data.text,
                                        src: data.src,
                                        step: data.currentStep || {},
                                        sourceDocs: data.sourceDocuments,
                                        tokens: data.tokens,
                                        id: Math.random(),
                                    },
                                ],
                                history: [...state.history, [question, data.text]],
                            }));
                        } else {
                            setMessageState((state: any) => ({
                                ...state,
                                messages: [
                                    ...state.messages,
                                    {
                                        type: 'apiMessage',
                                        message: `${data.errorMessage}`,
                                        src: data.src,
                                        step: data.currentStep || {},
                                        sourceDocs: data.sourceDocuments,
                                        tokens: data.tokens,
                                        id: Math.random(),
                                    },
                                ],
                            }));
                        }
                    } else if (JSModule?.showUserResponseFirst) {
                        setMessageState((state: any) => ({
                            ...state,
                            messages: [
                                ...state.messages,
                                {
                                    type: 'apiMessage',
                                    message: `${data.errorMessage}`,
                                    src: data.src,
                                    step: data.currentStep || {},
                                    sourceDocs: data.sourceDocuments,
                                    tokens: data.tokens,
                                    id: Math.random(),
                                },
                            ],
                            history: [
                                ...state.history,
                                [question, data?.currentStep?.answer || question],
                            ],
                        }));
                    } else {
                        setMessageState((state: any) => ({
                            ...state,
                            messages: [
                                ...state.messages,
                                {
                                    type: 'userMessage',
                                    message: data?.currentStep?.answer || question,
                                    src: 'test',
                                    id: Math.random(),
                                },
                                {
                                    type: 'apiMessage',
                                    message: `${data.errorMessage}`,
                                    src: data.src,
                                    step: data.currentStep || {},
                                    sourceDocs: data.sourceDocuments,
                                    tokens: data.tokens,
                                    id: Math.random(),
                                },
                            ],
                            history: [
                                ...state.history,
                                [question, data?.currentStep?.answer || question],
                            ],
                        }));
                    }
                } else {
                    if (data.currentStep?.fullWidth) {
                        setRegistrationMessage(data.currentStep);
                        setIsSignupPage(true);
                        return;
                    }
                    if (!data.hideAnswer && (data.currentStep?.answer || question) && !JSModule?.showUserResponseFirst) {
                        setMessageState((state: any) => ({
                            ...state,
                            messages: [
                                ...state.messages,
                                {
                                    type: 'userMessage',
                                    message: data?.currentStep?.answer || question,
                                    src: 'test',
                                    id: Math.random(),
                                },
                            ],
                        }));
                    }
                    if (data.currentStep?.update) {
                        JSModule?.leftPanelStateUpdate(+data.currentStep.header.step);
                    }
                    setIsSignupPage(false);
                    const apiMessage = {
                        message: data.text,
                        src: data.src,
                        step: data.currentStep || {},
                        sourceDocs: data.sourceDocuments,
                        tokens: data.tokens,
                    };
                    setMessageState((state: any) => ({
                        ...state,
                        messages: pushed
                            ? state.messages.map((m: any) =>
                                  m.id === streamId ? { ...m, ...apiMessage } : m
                              )
                            : [
                                  ...state.messages,
                                  { type: 'apiMessage', ...apiMessage, id: Math.random() },
                              ],
                        history: [...state.history, [question, data.text]],
                    }));
                    setActiveIndex(data.currentStep.id);
                }

                if (data.currentStep?.inputHidden) {
                    setHiddenInput(true);
                } else {
                    setHiddenInput(false);
                }
                setContent('')
                setLoading(false);
                removeAuthTokenFromURL()
            } catch (error) {
                setLoading(false);
                console.error('Chat request failed:', error);
            }
        }
    };

    // Function to handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setQuery(e.target.value);
    };

    // remove redirect url parameters
    function removeAuthTokenFromURL() {
        let currentUrl = window.location.href;
        if (currentUrl.includes('authtoken=')) {
            const urlParams = new URLSearchParams(window.location.search);
            const chatIdParam = urlParams.get('chat-id');
            const newSearchParams = new URLSearchParams();
            if (chatIdParam) {
                newSearchParams.set('chat-id', chatIdParam);
            }
            const updatedUrl = `${window.location.origin}${window.location.pathname}?${newSearchParams.toString()}${window.location.hash}`;
            window.history.replaceState({ path: updatedUrl }, '', updatedUrl);
        }
    }

    // Function to handle file upload
    const handleFileUpload = async (files: FileList) => {
        for (let item of files) {
            const formData = new FormData();
            formData.append('chatId', newChatRoom);
            formData.append('sessionId', currentSession);
            formData.append('file', item);

            fetch('/api/file-upload', {
                method: 'POST',
                body: formData,
            })
                .then((response) => response.json())
                .catch((error) => {
                    console.error('Error uploading file:', error);
                });
        }
    };

    // Function to get default prompt template
    const getPromptTemplate = async () => {
        const template = await getDefaultPromptTemplate(newChatRoom);
        if (template) {
            setPromptTemplate(template.data);
        }
    };

    // Function to checkSession and disableUserInput
    // const disableUserInput = () => {
    //     if (messages.length > 0 && messages[messages.length - 1]?.step) {
    //     let message = messages[messages.length - 1];
    //     if (message?.step?.inputType && message?.step?.inputDisabled) {
    //         setDisableInput(true);
    //     } else {
    //         setDisableInput(false);
    //     }
    //     }
    // };

    // Function to sendchatbot message
    const sendChatbotMessage = async (message: string, sessionId: string) => {
        if (socket && socket.connected) {
            socket.emit('chatbot-message', { message, sessionId });
            setMessageState((state: any) => ({
                ...state,
                messages: [
                    ...state.messages,
                    {
                        type: 'userMessage',
                        message: `${message}`,
                        src: 'talkingDb',
                        step: {},
                        id: Math.random(),
                    },
                ],
            }));
        } else {
            console.error('Socket not initialized');
        }
    };

    // Function to update prompt template
    const updatePromptTemplate = async () => {
        await submitPromptTemplate(newChatRoom, { template_instructions: promptTemplate });
        await getPromptTemplate();
    };

    // Function to reset prompt template
    const resetPromptTemplateHandler = async () => {
        await resetPromptTemplate(newChatRoom);
        await getPromptTemplate();
    };

    const handleSocket = async (value?: string) => {
        if (!socket || !socket.connected) {
            setSocketState(false)
        }
        if (value && currentSession) {
            await sendChatbotMessage(value, currentSession)
        }
    };

    const startNewChat = () => {
        sessionEpochRef.current += 1;
        const newSessionId = generateRandomString('session_', 9);
        setCurrentSession(newSessionId);
        setCurrentSessionId(newSessionId);
        clearActiveProjectId();
        resetJobSessionId();
        setMessageState({ messages: [], history: [] });
        setReferences([]);
        setQuery('');
        setSeededGraphIds([]);
        setLoading(false);
        if (typeof window !== 'undefined') localStorage.removeItem('conversation_id');
        setRoomId('');
    };
    const resumeSession = async (sessionId: string) => {
        sessionEpochRef.current += 1;
        const myEpoch = sessionEpochRef.current;

        rotateJobSessionId();
        clearActiveProjectId();
        setCachedGraphIds([]);
        setSelectedGraphIds([]);
        setSeededGraphIds([]);
        setHasPrivateDocs(false);

        setCurrentSession(sessionId);
        setCurrentSessionId(sessionId);
        setLoading(false);

        const detail = await getHistorySession(sessionId);
        if (!detail || myEpoch !== sessionEpochRef.current) {
            if (!detail && myEpoch === sessionEpochRef.current) startNewChat();
            return;
        }

        // This tab already has the real messages (with real sourceDocs, as
        // returned by /api/chat) for this session — reuse them as-is.
        // History in Mongo only stores graphIds, not page-level source
        // content, so a session this tab has never chatted in renders
        // without sourceDocs — no reference icon — rather than a fake one.
        const cached = getCachedSessionMessages(sessionId);
        const messages: Message[] = cached
            ? cached.messages
            : detail.chats.flatMap((chat) => [
                { type: 'userMessage', message: chat.question, src: 'talkingDb' } as Message,
                { type: 'apiMessage', message: chat.answer, src: 'talkingDb', tokens: chat.tokens } as Message,
            ]);
        const history: [string, string][] = cached
            ? cached.history
            : detail.chats.map((chat) => [chat.question, chat.answer]);
        const graphIds = Array.from(new Set(detail.documents.map((doc) => doc.graphId).filter(Boolean)));

        setMessageState({ messages, history });
        setReferences([]);
        setQuery('');
        setSelectedGraphIds([]);
        setSeededGraphIds(graphIds);
        setHasPrivateDocs(graphIds.length > 0);
        if (typeof window !== 'undefined') localStorage.removeItem('conversation_id');
        setRoomId('');
        notifySessionResumed(detail.documents);
    };

    return {
        chatId,
        messages,
        loading,
        botLoading,
        query,
        JSModule, 
        styles, 
        setQuery,
        open,
        setOpen,
        typingState,
        promptTemplate,
        handleSubmit,
        handleInputChange,
        handleFileUpload,
        updatePromptTemplate,
        resetPromptTemplateHandler,
        references, 
        setReferences,
        isLoggedIn,
        isCheckingSession,
        hasOpenID,
        handleLogin,
        handleLogout,
        authError,
        setAuthError,
        namespace,
        currentSession,
        startNewChat,
        resumeSession,
        selectedGraphIds,
        setSelectedGraphIds
    };
};