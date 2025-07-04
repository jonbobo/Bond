import React, { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { updateOnlineStatus } from '../services/chatUtils';
import FloatingChat from './FloatingChat';

const ChatManager = () => {
    const [user] = useAuthState(auth);
    const [openChats, setOpenChats] = useState([]); // Array of chat objects
    const [minimizedChats, setMinimizedChats] = useState(new Set()); // Set of chat IDs that are minimized

    // Use useCallback to memoize the openChat function
    const openChat = useCallback((friend) => {
        // Check if chat is already open
        setOpenChats(prev => {
            const existingChatIndex = prev.findIndex(chat => chat.friend.id === friend.id);

            if (existingChatIndex !== -1) {
                // Chat exists, just restore it if minimized
                setMinimizedChats(prevMinimized => {
                    const newSet = new Set(prevMinimized);
                    newSet.delete(friend.id);
                    return newSet;
                });
                return prev; // Return existing state
            }

            // Add new chat, limit to 3 open chats max
            const newChats = [...prev];

            // If we have 3 chats, close the oldest one
            if (newChats.length >= 3) {
                newChats.shift(); // Remove first (oldest) chat
            }

            newChats.push({
                id: friend.id,
                friend: friend,
                openedAt: Date.now()
            });

            return newChats;
        });

        // Make sure the new chat is not minimized
        setMinimizedChats(prev => {
            const newSet = new Set(prev);
            newSet.delete(friend.id);
            return newSet;
        });
    }, []);

    // ✅ OPTIMIZED: Update online status when component mounts/unmounts
    useEffect(() => {
        if (user) {
            updateOnlineStatus(true);

            // Update status to offline when user leaves/closes tab
            const handleBeforeUnload = () => {
                updateOnlineStatus(false);
            };

            const handleVisibilityChange = () => {
                updateOnlineStatus(!document.hidden);
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // ✅ BIGGEST OPTIMIZATION: Reduced frequency from 30s to 5 minutes (300s)
            // This saves ~90% of online status writes!
            const heartbeat = setInterval(() => {
                if (!document.hidden) {
                    updateOnlineStatus(true);
                }
            }, 300000); // ✅ 5 minutes instead of 30 seconds = 10x fewer writes

            console.log('✅ Online status heartbeat set to 5 minutes (was 30 seconds)');
            console.log('📊 This optimization alone saves ~90% of online status writes!');

            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                clearInterval(heartbeat);
                updateOnlineStatus(false);
            };
        }
    }, [user]);

    // Listen for global chat events (from contacts sidebar, messages page, etc.)
    useEffect(() => {
        const handleOpenChat = (event) => {
            const { friend } = event.detail;
            openChat(friend);
        };

        window.addEventListener('openFloatingChat', handleOpenChat);

        return () => {
            window.removeEventListener('openFloatingChat', handleOpenChat);
        };
    }, [openChat]); // Now openChat is included in dependencies

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
                        right: 20 + (index * 340), // Stack chats horizontally
                        zIndex: 1000 - index // Latest chat on top
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