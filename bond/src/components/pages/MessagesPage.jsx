import React, { useState } from 'react';
import './MessagesPage.css';

const MessagesPage = () => {
    const [selectedChat, setSelectedChat] = useState(null);

    // Real data will be loaded from Firebase/database
    const chats = []; // Empty array - will be populated with real data

    return (
        <div className="messages-page">
            <div className="page-header">
                <h1 className="page-title">Messages</h1>
                <button className="new-message-btn">
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
                        />
                    </div>

                    <div className="chats">
                        {chats.length === 0 ? (
                            <div className="empty-state">
                                <p>No conversations yet. Start a new message!</p>
                            </div>
                        ) : (
                            chats.map(chat => (
                                <div
                                    key={chat.id}
                                    className={`chat-item ${selectedChat === chat.id ? 'active' : ''}`}
                                    onClick={() => setSelectedChat(chat.id)}
                                >
                                    {/* Chat items will be rendered here */}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Window */}
                <div className="chat-window">
                    <div className="no-chat-selected">
                        <div className="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                            </svg>
                            <h3>Welcome to Messages</h3>
                            <p>Start a conversation to begin messaging</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessagesPage;