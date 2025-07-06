import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import {
    useChatState,
    useChatActions,
    useFindChatByParticipant
} from '../contexts/ChatContext';
import {
    searchUsers,
    subscribeToMessages, // ✅ NEW: Import real-time listener
    getMessagesOnce
} from '../services/chatUtils';
import './MessagesPage.css';

const MessagesPage = () => {
    const [user] = useAuthState(auth);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showNewMessageModal, setShowNewMessageModal] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // ✅ NEW: Separate state for messages (real-time for active chat)
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const messageListenerRef = useRef(null); // ✅ NEW: Track active listener

    // Chat context hooks (only for chat list and actions)
    const { chats, loading } = useChatState();
    const { sendMessage, markAsRead, createOrGetChat } = useChatActions();
    const { findChatByParticipant } = useFindChatByParticipant();

    // ✅ NEW: Setup real-time listener for selected chat
    useEffect(() => {
        if (!selectedChatId) {
            // Clear messages when no chat selected
            setMessages([]);

            // Cleanup existing listener
            if (messageListenerRef.current) {
                messageListenerRef.current();
                messageListenerRef.current = null;
            }
            return;
        }

        console.log('🔄 Setting up real-time listener for chat:', selectedChatId);
        setMessagesLoading(true);

        // ✅ Real-time listener for active chat (like FloatingChat)
        const unsubscribe = subscribeToMessages(selectedChatId, (newMessages) => {
            console.log('📝 Real-time messages update:', newMessages.length);
            setMessages(newMessages);
            setMessagesLoading(false);

            // Auto-scroll to bottom
            setTimeout(() => {
                if (messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        });

        messageListenerRef.current = unsubscribe;

        // Cleanup on chat change or unmount
        return () => {
            if (unsubscribe) {
                console.log('🧹 Cleaning up message listener for:', selectedChatId);
                unsubscribe();
            }
        };
    }, [selectedChatId]);

    // Listen for floating chat events
    const handleFloatingChatOpen = React.useCallback((event) => {
        try {
            const { friend } = event.detail;
            console.log('🔄 FloatingChat opened for friend:', friend.id);

            const existingChat = findChatByParticipant(friend.id);
            if (existingChat) {
                console.log('✅ Found existing chat, syncing to MessagesPage:', existingChat.id);
                setSelectedChatId(existingChat.id);
                // ✅ No need to manually load - real-time listener will handle it
            }
        } catch (error) {
            console.error('❌ Error handling floating chat open:', error);
        }
    }, [findChatByParticipant]);

    useEffect(() => {
        window.addEventListener('openFloatingChat', handleFloatingChatOpen);
        return () => {
            window.removeEventListener('openFloatingChat', handleFloatingChatOpen);
        };
    }, [handleFloatingChatOpen]);

    // Mark as read when chat is selected
    useEffect(() => {
        if (selectedChatId && !selectedChatId.startsWith('temp_')) {
            const markReadTimeout = setTimeout(() => {
                markAsRead(selectedChatId);
            }, 500);
            return () => clearTimeout(markReadTimeout);
        }
    }, [selectedChatId, markAsRead]);

    // Focus input when chat is selected
    useEffect(() => {
        if (selectedChatId && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [selectedChatId]);

    // Debounced user search
    useEffect(() => {
        const searchTimeout = setTimeout(async () => {
            if (searchTerm.trim().length >= 2) {
                setIsSearching(true);
                try {
                    const results = await searchUsers(searchTerm, user.uid, 10);
                    setSearchResults(results);
                } catch (error) {
                    console.error('Error searching users:', error);
                    setSearchResults([]);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(searchTimeout);
    }, [searchTerm, user.uid]);

    // ✅ IMPROVED: Chat selection with real-time listener
    const handleChatSelect = React.useCallback((chatId) => {
        console.log('📱 Chat selected in MessagesPage:', chatId);

        if (selectedChatId === chatId) {
            console.log('🔄 Same chat already selected');
            return;
        }

        const chatExists = chats.find(chat => chat.id === chatId);
        if (!chatExists) {
            console.error('❌ Chat not found:', chatId);
            return;
        }

        setSelectedChatId(chatId);
        // ✅ Real-time listener will handle loading messages automatically
    }, [selectedChatId, chats]);

    // ✅ IMPROVED: Send message with immediate UI update
    const handleSendMessage = React.useCallback(async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || !selectedChatId || sending) {
            return;
        }

        const messageToSend = newMessage.trim();
        setNewMessage(''); // Clear immediately
        setSending(true);

        try {
            await sendMessage(selectedChatId, messageToSend);
            // ✅ No need to manually refresh - real-time listener will show the message

            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } catch (error) {
            console.error('Error sending message:', error);
            setNewMessage(messageToSend); // Restore on error
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    }, [newMessage, selectedChatId, sending, sendMessage]);

    const handleKeyPress = React.useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    }, [handleSendMessage]);

    const handleStartNewChat = React.useCallback(async (person) => {
        try {
            console.log('🆕 Starting new chat with:', person.id);
            const { chatId } = await createOrGetChat(person.id);
            setSelectedChatId(chatId);
            setShowNewMessageModal(false);
            setSearchTerm('');
            setSearchResults([]);
            // ✅ Real-time listener will load messages automatically
        } catch (error) {
            console.error('Error creating chat:', error);
            alert('Failed to start chat. Please try again.');
        }
    }, [createOrGetChat]);

    // ✅ NEW: Manual refresh using getMessagesOnce (for troubleshooting)
    const handleRefreshMessages = React.useCallback(async () => {
        if (selectedChatId) {
            console.log('🔄 Manually refreshing messages');
            setMessagesLoading(true);
            try {
                const freshMessages = await getMessagesOnce(selectedChatId, 50);
                setMessages(freshMessages);
            } catch (error) {
                console.error('Error refreshing messages:', error);
            } finally {
                setMessagesLoading(false);
            }
        }
    }, [selectedChatId]);

    // Formatting functions
    const formatTime = React.useCallback((timestamp) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diffInMinutes = Math.floor((now - date) / (1000 * 60));

            if (diffInMinutes < 1) return 'Just now';
            if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
            if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;

            return date.toLocaleDateString();
        } catch (error) {
            return '';
        }
    }, []);

    const formatChatTime = React.useCallback((timestamp) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

            if (diffInHours < 24) {
                return date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            } else if (diffInHours < 168) {
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            } else {
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            }
        } catch (error) {
            return '';
        }
    }, []);

    const getAvatarInitials = React.useCallback((displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    }, []);

    // Memoized selected chat and filtered chats
    const selectedChat = React.useMemo(() => {
        return chats.find(chat => chat.id === selectedChatId) || null;
    }, [chats, selectedChatId]);

    const filteredChats = React.useMemo(() => {
        if (!searchTerm) return chats;

        const searchLower = searchTerm.toLowerCase();
        return chats.filter(chat =>
            chat.otherParticipant?.displayName?.toLowerCase().includes(searchLower) ||
            chat.otherParticipant?.username?.toLowerCase().includes(searchLower) ||
            chat.lastMessage?.toLowerCase().includes(searchLower)
        );
    }, [chats, searchTerm]);

    if (!user) return null;

    return (
        <div className="messages-page">
            <div className="page-header">
                <h1 className="page-title">Messages</h1>
                <button
                    className="new-message-btn"
                    onClick={() => setShowNewMessageModal(true)}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New Message
                </button>
            </div>

            <div className="messages-container">
                {/* Chat List */}
                <div className="chat-list">
                    <div className="chat-search">
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="chats">
                        {loading ? (
                            <div className="empty-state">
                                <p>Loading conversations...</p>
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="empty-state">
                                <p>No conversations yet. Start a new message!</p>
                            </div>
                        ) : (
                            filteredChats.map(chat => (
                                <div
                                    key={chat.id}
                                    className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                                    onClick={() => handleChatSelect(chat.id)}
                                >
                                    <div className="chat-avatar">
                                        {getAvatarInitials(chat.otherParticipant?.displayName)}
                                    </div>
                                    <div className="chat-info">
                                        <div className="chat-header">
                                            <div className="chat-name">
                                                {chat.otherParticipant?.displayName || 'Unknown User'}
                                            </div>
                                            <div className="chat-time">
                                                {formatChatTime(chat.lastMessageAt)}
                                            </div>
                                        </div>
                                        <div className="chat-preview">
                                            <div className="last-message">
                                                {chat.lastMessage || 'No messages yet'}
                                            </div>
                                            {chat.unreadCount > 0 && (
                                                <div className="unread-count">
                                                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Window */}
                <div className="chat-window">
                    {!selectedChatId ? (
                        <div className="no-chat-selected">
                            <div className="empty-state">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                                </svg>
                                <h3>Welcome to Messages</h3>
                                <p>Click on a conversation to start messaging</p>

                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="chat-header">
                                <div className="chat-user">
                                    <div className="chat-avatar">
                                        {getAvatarInitials(selectedChat?.otherParticipant?.displayName)}
                                    </div>
                                    <div className="user-info">
                                        <div className="user-name">
                                            {selectedChat?.otherParticipant?.displayName || 'Unknown User'}
                                        </div>
                                        <div className="user-status">
                                            @{selectedChat?.otherParticipant?.username || 'unknown'}
                                            {/* ✅ Show real-time indicator */}
                                            <span style={{
                                                marginLeft: '8px',
                                                color: '#48bb78',
                                                fontSize: '0.8rem'
                                            }}>
                                                • Live
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {/* ✅ Keep manual refresh for troubleshooting */}
                                <button
                                    onClick={handleRefreshMessages}
                                    disabled={messagesLoading}
                                    style={{
                                        background: 'none',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '0.8rem',
                                        color: '#667eea'
                                    }}
                                >
                                    {messagesLoading ? '⏳' : '🔄'} Refresh
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="chat-messages">
                                {messagesLoading ? (
                                    <div className="empty-state">
                                        <p>Loading messages...</p>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="empty-state">
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
                            <form className="chat-input" onSubmit={handleSendMessage}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder={`Message ${selectedChat?.otherParticipant?.displayName || 'user'}...`}
                                    className="message-input"
                                    disabled={sending}
                                />
                                <button
                                    type="submit"
                                    className="send-btn"
                                    disabled={!newMessage.trim() || sending}
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
                            </form>
                        </>
                    )}
                </div>
            </div>

            {/* New Message Modal */}
            {showNewMessageModal && (
                <div className="modal-overlay" onClick={() => setShowNewMessageModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>New Message</h3>
                            <button
                                className="modal-close"
                                onClick={() => setShowNewMessageModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <input
                                type="text"
                                placeholder="Search people to message..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                                autoFocus
                            />

                            <div className="search-results">
                                {isSearching ? (
                                    <div className="search-loading">
                                        <p>Searching...</p>
                                    </div>
                                ) : searchResults.length === 0 && searchTerm ? (
                                    <div className="no-results">
                                        <p>No users found matching "{searchTerm}"</p>
                                    </div>
                                ) : (
                                    searchResults.map(person => (
                                        <div
                                            key={person.id}
                                            className="search-result-item"
                                            onClick={() => handleStartNewChat(person)}
                                        >
                                            <div className="result-avatar">
                                                {getAvatarInitials(person.displayName)}
                                                {person.isOnline && <div className="online-indicator"></div>}
                                            </div>
                                            <div className="result-info">
                                                <div className="result-name">
                                                    {person.displayName}
                                                </div>
                                                <div className="result-username">
                                                    @{person.username}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessagesPage;