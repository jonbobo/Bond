import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import {
    useChatState,
    useChatActions,
    useChatMessages,
    useFindChatByParticipant
} from '../contexts/ChatContext';
import { searchUsers } from '../services/chatUtils';
import './MessagesPage.css';

const MessagesPage = () => {
    const [user] = useAuthState(auth);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showNewMessageModal, setShowNewMessageModal] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Chat context hooks
    const { chats, loading } = useChatState();
    const { sendMessage, markAsRead, createOrGetChat } = useChatActions();
    const { messages, sending } = useChatMessages(selectedChatId);
    const { findChatByParticipant } = useFindChatByParticipant();

    // Listen for floating chat events to sync active chat
    useEffect(() => {
        const handleFloatingChatOpen = (event) => {
            const { friend } = event.detail;
            console.log('🔄 FloatingChat opened for friend:', friend.id);

            // Find existing chat or prepare to create one
            const existingChat = findChatByParticipant(friend.id);
            if (existingChat) {
                console.log('✅ Found existing chat, syncing to MessagesPage:', existingChat.id);
                setSelectedChatId(existingChat.id);
            }
        };

        window.addEventListener('openFloatingChat', handleFloatingChatOpen);

        return () => {
            window.removeEventListener('openFloatingChat', handleFloatingChatOpen);
        };
    }, [findChatByParticipant]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages]);

    // Mark as read when chat is selected
    useEffect(() => {
        if (selectedChatId && !selectedChatId.startsWith('temp_')) {
            markAsRead(selectedChatId);
        }
    }, [selectedChatId, markAsRead]);

    // Focus input when chat is selected
    useEffect(() => {
        if (selectedChatId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [selectedChatId]);

    // Search for users when typing in new message modal
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
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [searchTerm, user]);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleChatSelect = (chatId) => {
        console.log('📱 Chat selected in MessagesPage:', chatId);
        setSelectedChatId(chatId);


    };

    /*************  ✨ Windsurf Command ⭐  *************/
    /**
     * Handles sending a message for the currently selected chat.
     * Prevents default form submission, checks if a message is being sent,
     * and if a chat is selected. If valid, sends the message and clears
     * the input field. If an error occurs, alerts the user to try again.
     *
     * @param {Event} e The event object from the form submission.
     */
    /*******  bd82e8ef-548e-4721-a1fb-a60064d35324  *******/
    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || !selectedChatId || sending) {
            return;
        }

        try {
            await sendMessage(selectedChatId, newMessage.trim());
            setNewMessage('');

            // Focus back to input
            if (inputRef.current) {
                inputRef.current.focus();
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const handleStartNewChat = async (person) => {
        try {
            console.log('🆕 Starting new chat with:', person.id);
            const { chatId } = await createOrGetChat(person.id);
            setSelectedChatId(chatId);
            setShowNewMessageModal(false);
            setSearchTerm('');
            setSearchResults([]);

        } catch (error) {
            console.error('Error creating chat:', error);
            alert('Failed to start chat. Please try again.');
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

    const formatChatTime = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

        if (diffInHours < 24) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } else if (diffInHours < 168) { // Within a week
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    };

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    const selectedChat = chats.find(chat => chat.id === selectedChatId);

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
                        ) : chats.length === 0 ? (
                            <div className="empty-state">
                                <p>No conversations yet. Start a new message!</p>
                            </div>
                        ) : (
                            chats
                                .filter(chat =>
                                    !searchTerm ||
                                    chat.otherParticipant?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    chat.otherParticipant?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    chat.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map(chat => (
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
                                <p>Start a conversation to begin messaging</p>
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
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="chat-messages">
                                {messages.length === 0 ? (
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