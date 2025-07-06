import React, { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { updateOnlineStatus } from '../services/chatUtils'; // ✅ Uses optimized version
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

    // ✅ OPTIMIZED: Presence management with better intervals
    useEffect(() => {
        if (!user) return;

        let cleanupPresence;

        // ✅ Initial presence update
        updateOnlineStatus(true);

        // ✅ Setup optimized presence tracking (handled in chatUtils.js)
        // The optimized updateOnlineStatus function now handles:
        // - 5-minute throttling instead of 30 seconds
        // - Debouncing rapid calls
        // - Smart visibility change detection

        // ✅ REMOVED: Expensive 30-second heartbeat
        // OLD CODE: setInterval(() => updateOnlineStatus(true), 30000);

        // Handle tab visibility more intelligently
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateOnlineStatus(true);
            } else {
                // ✅ Don't immediately mark offline - user might be switching tabs
                setTimeout(() => {
                    if (document.visibilityState !== 'visible') {
                        updateOnlineStatus(false);
                    }
                }, 30000); // 30 second delay
            }
        };

        const handleBeforeUnload = () => {
            updateOnlineStatus(false);
        };

        const handleOnline = () => {
            updateOnlineStatus(true);
        };

        const handleOffline = () => {
            updateOnlineStatus(false);
        };

        // ✅ Event listeners for presence (optimized updateOnlineStatus handles throttling)
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // ✅ MUCH LESS FREQUENT heartbeat - every 10 minutes instead of 30 seconds
        const heartbeat = setInterval(() => {
            if (!document.hidden && navigator.onLine) {
                updateOnlineStatus(true); // This will be throttled by chatUtils
            }
        }, 600000); // 10 minutes (vs 30 seconds before)

        cleanupPresence = () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(heartbeat);
        };

        return () => {
            cleanupPresence();
            // ✅ Mark offline when component unmounts
            updateOnlineStatus(false);
        };
    }, [user]);

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