import React, { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import FloatingChat from './FloatingChat';
import './ChatManager.css';

const ChatManager = () => {
    const [user] = useAuthState(auth);
    const [openChats, setOpenChats] = useState([]);
    const [minimizedChats, setMinimizedChats] = useState(new Set());

    const openChat = useCallback((friend) => {
        setOpenChats(prev => {
            const existingChatIndex = prev.findIndex(chat => chat.friend.id === friend.id);

            if (existingChatIndex !== -1) {
                // Chat exists, just unminimize it
                setMinimizedChats(prevMinimized => {
                    const newSet = new Set(prevMinimized);
                    newSet.delete(friend.id);
                    return newSet;
                });
                return prev;
            }

            const newChats = [...prev];

            // Limit to 3 open chats
            if (newChats.length >= 3) {
                newChats.shift();
            }

            newChats.push({
                id: friend.id,
                friend: friend,
                openedAt: Date.now()
            });

            return newChats;
        });

        // Ensure the chat is not minimized when opened
        setMinimizedChats(prev => {
            const newSet = new Set(prev);
            newSet.delete(friend.id);
            return newSet;
        });
    }, []);

    // Listen for global chat events
    useEffect(() => {
        const handleOpenChat = (event) => {
            const { friend } = event.detail;
            openChat(friend);
        };

        window.addEventListener('openFloatingChat', handleOpenChat);

        return () => {
            window.removeEventListener('openFloatingChat', handleOpenChat);
        };
    }, [openChat]);

    const closeChat = (friendId) => {
        setOpenChats(prev => prev.filter(chat => chat.friend.id !== friendId));
        setMinimizedChats(prev => {
            const newSet = new Set(prev);
            newSet.delete(friendId);
            return newSet;
        });
    };

    const toggleMinimizeChat = (friendId) => {
        setMinimizedChats(prev => {
            const newSet = new Set(prev);
            if (newSet.has(friendId)) {
                newSet.delete(friendId);
            } else {
                newSet.add(friendId);
            }
            return newSet;
        });
    };

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    if (!user) return null;

    // Separate minimized and expanded chats
    const minimizedChatsList = openChats.filter(chat => minimizedChats.has(chat.friend.id));
    const expandedChatsList = openChats.filter(chat => !minimizedChats.has(chat.friend.id));

    return (
        <div className="chat-manager">
            {/* Minimized chat bubbles - positioned at bottom right */}
            <div className="minimized-chats-container">
                {minimizedChatsList.map((chat, index) => (
                    <div
                        key={`minimized-${chat.friend.id}`}
                        className="minimized-chat-bubble"
                        onClick={() => toggleMinimizeChat(chat.friend.id)}
                        style={{
                            bottom: 20 + (index * 70), // Stack vertically
                            right: 20
                        }}
                        title={`Chat with ${chat.friend.displayName}`}
                    >
                        <div className="bubble-avatar">
                            {chat.friend.profilePicture ? (
                                <img
                                    src={chat.friend.profilePicture}
                                    alt={chat.friend.displayName}
                                    className="bubble-avatar-img"
                                />
                            ) : (
                                <span className="bubble-avatar-initial">
                                    {getAvatarInitials(chat.friend.displayName)}
                                </span>
                            )}
                            {chat.friend.isOnline && <div className="bubble-online-indicator"></div>}
                        </div>

                        <button
                            className="bubble-close-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                closeChat(chat.friend.id);
                            }}
                            title="Close chat"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {/* Expanded chat windows */}
            <div className="expanded-chats-container">
                {expandedChatsList.map((chat, index) => {
                    // Calculate offset to avoid covering bubbles
                    const bubbleSpace = minimizedChatsList.length > 0 ? 100 : 20; // Extra space if bubbles exist

                    return (
                        <div
                            key={`expanded-${chat.friend.id}`}
                            className="expanded-chat-wrapper"
                            style={{
                                position: 'fixed',
                                bottom: 0,
                                right: bubbleSpace + (index * 340),
                                zIndex: 1000 - index
                            }}
                        >
                            <FloatingChat
                                friend={chat.friend}
                                onClose={() => closeChat(chat.friend.id)}
                                isMinimized={false}
                                onToggleMinimize={() => toggleMinimizeChat(chat.friend.id)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ChatManager;