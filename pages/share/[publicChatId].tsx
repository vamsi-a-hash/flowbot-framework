import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { useChatbot } from '@/hooks/useChatbot';
import { ChatHeader } from '@/modules/ChatHeader';
import { ChatMessages } from '@/modules/ChatMessages';
import { getPublicChatData } from '@/apiRequests';

const PublicChat: React.FC = () => {
    const router = useRouter();
    const { publicChatId } = router.query;
    const {
        loading,
        typingState,
        handleSubmit,
        handleFileUpload,
        JSModule,
        open,
        setOpen,
        references,
        chatId,
        user,
        handleLogout,
    } = useChatbot();

    const [messages, setMessages] = useState<any[]>([]);

    useEffect(() => {
        if (!router.isReady || typeof publicChatId !== 'string') {
            return;
        }

        const fetchPublicChat = async () => {
            const response = await getPublicChatData(publicChatId);
            if (response?.status === 200) {
                // converting the messages to expected format and setting it;
                setMessages(
                    response.data.chats.flatMap((item: any) => [
                        {
                            type: "userMessage",
                            message: item.question,
                            src: "test",
                            id: Math.random(),
                        },
                        {
                            type: "apiMessage",
                            message: item.answer,
                            src: "talkingDb",
                            id: Math.random(),
                        },
                    ])
                );
            }
        };
        fetchPublicChat();
    }, [router.isReady, publicChatId]);

    return (
        <Layout>
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
                    user={user}
                    onLogout={handleLogout}
                />
                <div style={{
                    flex: 1,
                    display: 'flex',
                    overflow: 'hidden',
                }}>
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
                                    {
                                        messages && messages.length > 0 && (

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
                                        )
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}

export default PublicChat;