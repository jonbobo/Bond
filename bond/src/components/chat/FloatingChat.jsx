import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import {
    createOrGetChat,
    sendMessage,
    subscribeToMessages,
    markChatAsRead
} from '../services/chatUtils';
import { subscribeToUserPresence } from '../services/presenceUtils'; // ✅ NEW: Real-time presence
import './FloatingChat.css';

const FloatingChat = ({ friend, onClose, isMinimized, onToggleMinimize }) => {
    const [user] = useAuthState(auth);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatId, setChatId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [friendIsOnline, setFriendIsOnline] = useState(false); // ✅ NEW: Real-time online status
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const unsubscribeRef = useRef(null);
    const presenceUnsubscribeRef = useRef(null); // ✅ NEW: Presence cleanup

    // ✅ NEW: Subscribe to friend's real-time presence
    useEffect(() => {
        if (!friend?.id) {
            setFriendIsOnline(false);
            return;
        }

        console.log('🔄 Setting up presence listener for friend:', friend.id);

        const unsubscribePresence = subscribeToUserPresence(
            friend.id,
            (isOnline, lastSeen) => {
                console.log('📡 Friend presence updated:', { friendId: friend.id, isOnline });
                setFriendIsOnline(isOnline);
            }
        );

        presenceUnsubscribeRef.current = unsubscribePresence;

        return () => {
            console.log('🧹 Cleaning up presence listener for friend:', friend.id);
            if (unsubscribePresence) {
                unsubscribePresence();
            }
        };
    }, [friend?.id]);

    // Initialize chat when friend changes
    useEffect(() => {
        if (!user || !friend) {
            console.log('❌ Missing user or friend:', { user: !!user, friend: !!friend });
            return;
        }

        const initializeChat = async () => {
            console.log('🚀 Initializing chat with friend:', friend.id);
            setLoading(true);
            setInitialized(false);

            try {
                const { chatId: newChatId } = await createOrGetChat(friend.id);
                console.log('✅ Chat initialized:', newChatId);
                setChatId(newChatId);
                setInitialized(true);

                // Mark chat as read when opened
                await markChatAsRead(newChatId);
            } catch (error) {
                console.error('❌ Error initializing chat:', error);
                setInitialized(false);
            } finally {
                setLoading(false);
            }
        };

        initializeChat();

        // Cleanup function
        return () => {
            if (unsubscribeRef.current) {
                console.log('🔄 Cleaning up message listener');
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [user, friend]);

    // Subscribe to messages when chatId is available
    useEffect(() => {
        if (!chatId || !initialized) {
            console.log('❌ Cannot subscribe to messages:', { chatId: !!chatId, initialized });
            return;
        }

        console.log('🔄 Setting up message listener for chat:', chatId);

        const unsubscribe = subscribeToMessages(
            chatId,
            (newMessages) => {
                console.log('📝 Messages updated in FloatingChat:', {
                    count: newMessages.length,
                    chatId,
                    firstMessage: newMessages[0]?.content?.substring(0, 30)
                });
                setMessages(newMessages);

                // Mark as read when new messages arrive and chat is open
                if (newMessages.length > 0 && !isMinimized) {
                    markChatAsRead(chatId);
                }
            }
        );

        // Store unsubscribe function
        unsubscribeRef.current = unsubscribe;

        return () => {
            if (unsubscribe) {
                console.log('🔄 Cleaning up message listener on chatId change');
                unsubscribe();
            }
        };
    }, [chatId, initialized, isMinimized]);

    // Auto scroll to bottom when messages change
    useEffect(() => {
        if (messages.length > 0 && !isMinimized) {
            scrollToBottom();
        }
    }, [messages, isMinimized]);

    // Focus input when chat opens or is restored
    useEffect(() => {
        if (!isMinimized && inputRef.current && initialized) {
            inputRef.current.focus();
        }
    }, [isMinimized, initialized]);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || !chatId || sending || !initialized) {
            console.log('❌ Cannot send message:', {
                hasMessage: !!newMessage.trim(),
                hasChatId: !!chatId,
                sending,
                initialized
            });
            return;
        }

        const messageContent = newMessage.trim();
        console.log('📤 Attempting to send message:', { chatId, content: messageContent });

        setSending(true);
        try {
            await sendMessage(chatId, messageContent);
            console.log('✅ Message sent successfully');
            setNewMessage('');

            // Focus back to input
            if (inputRef.current) {
                inputRef.current.focus();
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;

        return date.toLocaleDateString();
    };

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    if (!friend) {
        console.log('❌ No friend provided to FloatingChat');
        return null;
    }

    return (
        <div className={`floating-chat ${isMinimized ? 'minimized' : ''}`}>
            {/* Chat Header */}
            <div className="chat-header" onClick={onToggleMinimize}>
                <div className="chat-header-info">
                    <div className="chat-avatar">
                        {getAvatarInitials(friend.displayName)}
                        {/* ✅ FIXED: Use real-time presence data */}
                        {friendIsOnline && <div className="online-indicator"></div>}
                    </div>
                    <div className="chat-user-info">
                        <span className="chat-username">{friend.displayName}</span>
                        <span className="chat-status">
                            {/* ✅ SIMPLE: Just show Active now or Offline */}
                            {friendIsOnline ? 'Active now' : 'Offline'}
                        </span>
                    </div>
                </div>
                <div className="chat-actions">
                    <button
                        className="minimize-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleMinimize();
                        }}
                        title={isMinimized ? 'Expand' : 'Minimize'}
                    >
                        {isMinimized ? '▲' : '▼'}
                    </button>
                    <button
                        className="close-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        title="Close"
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Chat Body */}
            {!isMinimized && (
                <>
                    <div className="chat-messages">
                        {loading ? (
                            <div className="chat-loading">
                                <p>Loading messages...</p>
                            </div>
                        ) : !initialized ? (
                            <div className="chat-error">
                                <p>Failed to initialize chat. Please try again.</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="no-messages">
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`message ${message.senderId === user.uid ? 'sent' : 'received'}`}
                                    >
                                        <div className="message-content">
                                            <p>{message.content}</p>
                                        </div>
                                        <div className="message-time">
                                            {formatTime(message.createdAt)}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Message Input */}
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <div className="chat-input-container">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={`Message ${friend.displayName}...`}
                                className="chat-input"
                                disabled={sending || !initialized}
                            />
                            <button
                                type="submit"
                                className="send-btn"
                                disabled={!newMessage.trim() || sending || !initialized}
                            >
                                {sending ? (
                                    <span className="sending-spinner">⏳</span>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22,2 15,22 11,13 2,9"></polygon>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
};

export default FloatingChat;