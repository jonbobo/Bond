import React, { useState } from 'react';
import './ConnectionsPage.css';

const ConnectionsPage = () => {
    const [activeTab, setActiveTab] = useState('friends');

    // Real data will be loaded from Firebase/database
    const friends = []; // Empty array - will be populated with real data
    const requests = []; // Empty array - will be populated with real data
    const suggestions = []; // Empty array - will be populated with real data

    return (
        <div className="connections-page">
            <div className="page-header">
                <h1 className="page-title">Connections</h1>
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Search people..."
                        className="search-input"
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="connections-tabs">
                <button
                    className={`tab ${activeTab === 'friends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('friends')}
                >
                    Friends ({friends.length})
                </button>
                <button
                    className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    Requests ({requests.length})
                </button>
                <button
                    className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suggestions')}
                >
                    Suggestions
                </button>
            </div>

            {/* Content */}
            <div className="connections-content">
                {activeTab === 'friends' && (
                    <div className="friends-list">
                        {friends.length === 0 ? (
                            <div className="empty-state">
                                <p>No friends yet. Start connecting with people!</p>
                            </div>
                        ) : (
                            friends.map(friend => (
                                <div key={friend.id} className="person-card">
                                    {/* Friend cards will be rendered here */}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="requests-list">
                        {requests.length === 0 ? (
                            <div className="empty-state">
                                <p>No friend requests</p>
                            </div>
                        ) : (
                            requests.map(request => (
                                <div key={request.id} className="person-card">
                                    {/* Request cards will be rendered here */}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'suggestions' && (
                    <div className="suggestions-list">
                        {suggestions.length === 0 ? (
                            <div className="empty-state">
                                <p>No suggestions available. Check back later!</p>
                            </div>
                        ) : (
                            suggestions.map(suggestion => (
                                <div key={suggestion.id} className="person-card">
                                    {/* Suggestion cards will be rendered here */}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionsPage;