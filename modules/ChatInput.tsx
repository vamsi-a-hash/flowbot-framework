import React, { useContext, useRef } from "react";
import ThemeContext from "@/contexts/ThemeContext";
import LoadingDots from "@/components/ui/LoadingDots";
import { ChatInputProps } from "@/types/chat";

export const ChatInput: React.FC<ChatInputProps> = ({ onSubmit, typingState, query, loading, onChange, messages, onAddClick }) => {

    const { JSModule, styles } = useContext(ThemeContext);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    //prevent empty submissions
    const handleEnter = (e: any) => {
        if (e.key === 'Enter' && query.trim()) {
            onSubmit();
        } else if (e.key == 'Enter') {
            e.preventDefault();
        }
    };

    return (
        <div className={styles?.center}>
            <div className={styles?.cloudform}>
                {JSModule?.hideTextArea ? (
                    <></>
                ) : (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            onSubmit();
                        }}
                    >
                        {typingState && (
                            <span style={{ marginLeft: '10px' }}>
                                Typing
                                <LoadingDots color="#000" />
                            </span>
                        )}
                        {JSModule?.drawerEnabled && onAddClick && (
                            <button
                                type="button"
                                onClick={onAddClick}
                                disabled={loading}
                                className={styles?.addButton}
                                title="Add documents"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        )}
                        <textarea
                            disabled={loading}
                            onKeyDown={handleEnter}
                            ref={textAreaRef}
                            autoFocus={false}
                            rows={1}
                            maxLength={10000}
                            id="userInput"
                            name="userInput"
                            placeholder={
                                loading
                                    ? 'Waiting for response...'
                                    : JSModule?.getInputPlaceholder
                            }
                            value={query}
                            onChange={(e) => onChange(e.target.value)}
                            className={
                                messages[messages.length - 1]?.step?.inputType ===
                                    'password'
                                    ? `${styles?.textarea} ${styles?.passwordTextarea}`
                                    : styles?.textarea
                            }
                        />
                        <button
                            type="submit"
                            disabled={!query.trim() || loading}
                            className={styles?.generatebutton}
                            style={{
                                background:
                                    JSModule?.sendIcon && !loading
                                        ? JSModule?.themeColor
                                        : '',
                            }}
                        >
                            {loading ? (
                                <div className={styles?.loadingwheel}>
                                    <LoadingDots color="#000" />
                                </div>
                            ) : (
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html:
                                            JSModule?.sendIcon ??
                                            `
                        <svg viewBox="0 0 20 20" class="Home_svgicon__PLaWz" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z">
                            </path>
                        </svg>
                        `,
                                    }}
                                />
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}