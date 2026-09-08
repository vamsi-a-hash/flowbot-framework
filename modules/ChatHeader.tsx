import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import ThemeContext from '@/contexts/ThemeContext';
import PanelIcon from '@/assets/svgs/PanelIcon';
import ChevronDownIcon from '@/assets/svgs/ChevronDownIcon';
import LogoutIcon from '@/assets/svgs/LogoutIcon';
import ShareIcon from '@/assets/svgs/ShareIcon';
import { ToggleButton } from '@/components/ui/Buttons/ToggleButton';
import { toast } from 'react-toastify';
import { getPublicChatLink, submitFeedback } from '@/apiRequests';
import { getCurrentSessionId } from '@/utils/sessionJobs';
import config from '@/config/constants';
import { ChatHeaderProps } from '@/types/chat';
import { Menu, ArrowLeftRight } from 'lucide-react';
import CustomModal from '@/components/ui/customModal';
import FeedbackForm from '@/components/FeedbackForm';
import { FeedbackPayload } from '@/types/feedback';
import ChatTabs from './ChatTabs';

export const ChatHeader: React.FC<ChatHeaderProps> = ({ drawerOpen = false, onDrawerToggle, leftPanelExpanded = true, onToggleLeftPanel, messages, manageProjectsOpen = false, onToggleManageProjects, sessions, setSessions, activeSessionId, onSelectSession, onNewChat, totalTokensOverride, user = {}, onLogout }) => {
    const { JSModule, styles } = useContext(ThemeContext);
    const headerRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [canShareChat, setCanShareChat] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

    // if messages contain at-least one message from user and bot;
    useEffect(() => {
        const hasUserMessage = messages?.some((msg) => msg.type === "userMessage") || false;
        const hasBotMessage = messages?.some((msg) => msg.type === "apiMessage") || false;


        setCanShareChat(hasUserMessage && hasBotMessage);
    }, [messages, messages?.length]);

    const liveTotalTokens = useMemo(
        () => messages?.reduce((sum, msg) => sum + (msg.tokens?.total_tokens ?? 0), 0) ?? 0,
        [messages]
    );
    const totalTokens = totalTokensOverride ?? liveTotalTokens;

    const copyToClipboard = async (text: string) => {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return;
        }


        // to support older browsers, where the clipboard api might not be available;
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return;
    };

    const handleShareChat = async () => {
        const sessionId = getCurrentSessionId()
        const response = await getPublicChatLink(sessionId)
        if (response?.status == 200) {
            const publicChatId = response.data._id;
            const publiclyShareableURL = `${config.HOST}/share/${publicChatId}`
            await copyToClipboard(publiclyShareableURL)
            toast.success("Public link copied to your clipboard")
        } else {
            toast.error("Unable to share chat. Please try again in a moment.")
        }
    }

    const handleFeedback = async (action?: string, feedback?: FeedbackPayload) => {
        if (action === "close modal" || !feedback) {
            setFeedbackModalOpen(false);
            return;
        }

        const response = await submitFeedback(feedback);
        if (response?.status === 201) {
            // closing the modal only if the feedback is successfully submitted
            // if  anything goes wrong, modal would stay as opened - user can chose to close or retry
            setFeedbackModalOpen(false);
            toast.success("Thanks for your feedback")
        } else {
            toast.error("Sorry, something went wrong in submitting feedback")
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                userMenuRef.current &&
                !userMenuRef.current.contains(target)
            ) {
                setIsUserMenuOpen(false);
            }
            if (
                menuRef.current &&
                !menuRef.current.contains(target)
            ) {
                setShowMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

    // Bot-level override: full custom header HTML
    if (JSModule?.headerPaneHtml) {
        return (
            <div
                ref={headerRef}
                className={styles?.['main-header']}
                dangerouslySetInnerHTML={{ __html: JSModule.headerPaneHtml }}
            />
        );
    }

    return (
        <div className="flex justify-between w-full items-center border border-b border-gray-200 bg-white px-4 py-2 gap-1">
            {
                feedbackModalOpen && (
                    <CustomModal
                        id={"feedback"}
                        title={"Feedback"}
                        onClose={handleFeedback}
                        status={feedbackModalOpen}
                        showOptionsButton={false}
                    >
                        <FeedbackForm
                            onSubmit={handleFeedback}
                        />
                    </CustomModal>
                )
            }
            <div className="flex flex-1 min-w-0 items-center gap-4 overflow-hidden">
                <button
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white p-1 transition-all duration-200 hover:border-blue-500 hover:bg-gray-50"
                    onClick={onToggleLeftPanel}
                    title="Toggle Sidebar"
                >
                    <PanelIcon size={20} stroke={leftPanelExpanded ? "#2563eb" : "#6b7280"} />
                </button>

                <span className="flex-shrink-0 text-base font-semibold text-gray-900">
                    {JSModule?.botName || "AI Document Chat"}
                </span>
                {totalTokens > 0 && (
                    <span
                        className="flex-shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500"
                        title="Total tokens used across this conversation"
                    >
                        {totalTokens.toLocaleString()} tokens
                    </span>
                )}
                <ChatTabs
                    messages={messages}
                    sessions={sessions || []}
                    setSessions={setSessions}
                    activeSessionId={activeSessionId}
                    onSelectSession={onSelectSession}
                    onNewChat={onNewChat}
                />
            </div>

            <div className="flex items-center gap-4">
                {onToggleManageProjects && (
                    <ToggleButton
                        open={manageProjectsOpen}
                        onToggle={onToggleManageProjects}
                        label="Manage Projects"
                        icon={<ArrowLeftRight size={16} className="text-blue-500" />}
                    />
                )}
                {canShareChat && (
                    <div onClick={handleShareChat} className="cursor-pointer">
                        <ShareIcon />
                    </div>
                )}
                <button
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white p-1 transition-all duration-200 hover:border-blue-500 hover:bg-gray-50"
                    onClick={onDrawerToggle}
                    title="Toggle Documents"
                >
                    <PanelIcon size={20} stroke={drawerOpen ? "#2563eb" : "#6b7280"} />
                </button>

                {/* logged-out visitors (e.g. a shared public chat) get no avatar and no sign-out */}
                {user?.email && (
                <div className="relative" ref={userMenuRef}>
                    <div
                        className="flex cursor-pointer select-none items-center gap-2 rounded-full border border-gray-200 px-2 py-1 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 overflow-visible"
                        onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    >
                        <div className="h-8 w-8 flex justify-center items-center text-center rounded-full text-sm font-semibold text-black border border-black bg-white">
                            {user?.name?.charAt(0).toUpperCase() || "U"}
                        </div>

                        <div className="flex flex-col text-left leading-[1.2]">
                            <span className="text-sm font-medium text-gray-700">
                                {user.name || "User"}
                            </span>
                            <span className="text-xs font-normal text-gray-400">
                                {user.email || ""}
                            </span>
                        </div>
                        <ChevronDownIcon />
                    </div>

                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-14 z-[200] min-w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 ">
                            <button
                                className="flex w-full items-center gap-2 bg-transparent px-4 py-2.5 text-left text-sm text-red-500 transition-colors duration-150 hover:bg-gray-50"
                                onClick={onLogout}
                            >
                                <LogoutIcon />
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
                )}
                <div
                    ref={menuRef}
                    className='relative block'
                >
                    <button
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white p-1 transition-all duration-200 hover:border-blue-500 hover:bg-gray-50"
                        onClick={() => setShowMenu((prev) => !prev)}
                        title="Header Menu"
                    >
                        <Menu size={24} stroke={showMenu ? '#2563eb' : '#6b7280'} />
                    </button>
 
                    {showMenu && (
                        <div
                            className="absolute block right-0 top-14 z-[200] overflow-hidden rounded-lg border border-gray-200 bg-white py-1"
                        >
                            <button
                                className="flex items-center gap-2 whitespace-nowrap bg-transparent px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-gray-50"
                                onClick={() => {
                                    setFeedbackModalOpen(true);
                                    setShowMenu(false);
                                }}
                            >
                                Share Feedback
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};