import React, { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
// ✅ REMOVED: updateOnlineStatus import - now handled by presenceUtils.js automatically
import FloatingChat from './FloatingChat';

const ChatManager = () => {
    const [user] = useAuthState(auth);
    const [openChats, setOpenChats] = useState([]);
    const [minimizedChats, setMinimizedChats] = useState(new Set());

    const openChat = useCallback((friend) => {
        setOpenChats(prev => {
            const existingChatIndex = prev.findIndex(chat => chat.friend.id === friend.id);

            if (existingChatIndex !== -1) {
                setMinimizedChats(prevMinimized => {
                    const newSet = new Set(prevMinimized);
                    newSet.delete(friend.id);
                    return newSet;
                });
                return prev;
            }

            const newChats = [...prev];

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

        setMinimizedChats(prev => {
            const newSet = new Set(prev);
            newSet.delete(friend.id);
            return newSet;
        });
    }, []);

    // ✅ SIMPLIFIED: Presence is now handled automatically by presenceUtils.js
    // No need for manual presence management in ChatManager
    // presenceUtils.js handles:
    // - Initial online status on login
    // - Automatic offline on disconnect/browser close
    // - Tab visibility changes
    // - Network status changes
    // - Heartbeat and cleanup

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

    if (!user) return null;

    return (
        <div className="chat-manager">
            {openChats.map((chat, index) => (
                <div
                    key={chat.friend.id}
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        right: 20 + (index * 340),
                        zIndex: 1000 - index
                    }}
                >
                    <FloatingChat
                        friend={chat.friend}
                        onClose={() => closeChat(chat.friend.id)}
                        isMinimized={minimizedChats.has(chat.friend.id)}
                        onToggleMinimize={() => toggleMinimizeChat(chat.friend.id)}
                    />
                </div>
            ))}
        </div>
    );
};

export default ChatManager;