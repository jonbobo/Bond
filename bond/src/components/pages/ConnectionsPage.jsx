import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useLocation } from 'react-router-dom'; // Add this import
import { auth, db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
    getUserFriendsWithDetails,
    getPendingRequestsWithDetails,
    getFriendSuggestions,
    searchUsers,
    acceptFriendRequest,
    declineFriendRequest,
    sendFriendRequest,
    removeFriend,
    cancelFriendRequest
} from '../services/connectionUtils';
import './ConnectionsPage.css';

// Simple in-memory cache for instant loading
const dataCache = {
    friends: [],
    requests: [],
    suggestions: [],
    lastUpdated: null,
    userId: null
};

const ConnectionsPage = () => {
    const [user] = useAuthState(auth);
    const location = useLocation(); // Add this hook

    // Get initial tab from URL parameter
    const getInitialTab = () => {
        const urlParams = new URLSearchParams(location.search); // Use location.search
        const tabParam = urlParams.get('tab');
        return ['friends', 'requests', 'suggestions'].includes(tabParam) ? tabParam : 'friends';
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [friends, setFriends] = useState(dataCache.userId === user?.uid ? dataCache.friends : []);
    const [requests, setRequests] = useState(dataCache.userId === user?.uid ? dataCache.requests : []);
    const [suggestions, setSuggestions] = useState(dataCache.userId === user?.uid ? dataCache.suggestions : []);
    const [searchResults, setSearchResults] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState({});
    const [userState, setUserState] = useState({});

    // Handle URL parameter changes - listen to location changes
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam && ['friends', 'requests', 'suggestions'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [location.search]); // Dependency on location.search will trigger when URL params change

    useEffect(() => {
        const loadData = async () => {
            if (user) {
                // If we have fresh cached data for this user, use it immediately
                if (dataCache.userId === user.uid && dataCache.lastUpdated &&
                    (Date.now() - dataCache.lastUpdated) < 30000) { // 30 seconds cache
                    console.log('📦 Using cached data');
                    setFriends(dataCache.friends);
                    setRequests(dataCache.requests);
                    setSuggestions(dataCache.suggestions);
                }

                // Always load fresh data in background
                await loadAllData();
            }
        };
        loadData();
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // Real-time listener for user document changes
    useEffect(() => {
        if (!user) {
            setUserState({});
            return;
        }

        console.log('🔄 Setting up real-time user state listener for:', user.uid);

        const unsubscribe = onSnapshot(
            doc(db, "users", user.uid),
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const userData = docSnapshot.data();
                    const sentRequests = userData.sentRequests || [];
                    const currentFriends = userData.friends || [];
                    const receivedRequests = userData.friendRequests || [];

                    console.log('🔄 Real-time user state update:', {
                        friends: currentFriends.length,
                        sentRequests: sentRequests.length,
                        receivedRequests: receivedRequests.length
                    });

                    // Update user state for button display
                    const newUserState = {};

                    // Mark friends
                    currentFriends.forEach(friendId => {
                        newUserState[friendId] = 'friend';
                    });

                    // Mark sent requests  
                    sentRequests.forEach(requestId => {
                        newUserState[requestId] = 'requestSent';
                    });

                    // Mark received requests
                    receivedRequests.forEach(requestId => {
                        newUserState[requestId] = 'requestReceived';
                    });

                    setUserState(newUserState);

                    // Also refresh the friends and requests lists
                    loadAllData();
                } else {
                    console.log('⚠️ User document not found');
                    setUserState({});
                }
            },
            (error) => {
                console.error('❌ User state listener error:', error);
            }
        );

        return () => {
            console.log('🔄 Cleaning up user state listener');
            unsubscribe();
        };
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const searchTimeout = setTimeout(() => {
            if (searchTerm.trim().length >= 2) {
                performSearch();
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadAllData = async () => {
        if (!user) return;

        try {
            console.log('📊 Loading connection data...');

            const [friendsData, requestsData, suggestionsData] = await Promise.all([
                getUserFriendsWithDetails(user.uid),
                getPendingRequestsWithDetails(user.uid),
                getFriendSuggestions(user.uid, 10)
            ]);

            setFriends(friendsData);
            setRequests(requestsData);
            setSuggestions(suggestionsData);

            // Update cache
            dataCache.friends = friendsData;
            dataCache.requests = requestsData;
            dataCache.suggestions = suggestionsData;
            dataCache.lastUpdated = Date.now();
            dataCache.userId = user.uid;

            console.log('📊 Data loaded and cached:', {
                friends: friendsData.length,
                requests: requestsData.length,
                suggestions: suggestionsData.length
            });

        } catch (error) {
            console.error('Error loading connection data:', error);
        }
    };

    const performSearch = async () => {
        if (!user || searchTerm.trim().length < 2) return;

        try {
            const results = await searchUsers(searchTerm, user.uid, 10);
            setSearchResults(results);
        } catch (error) {
            console.error('Error searching users:', error);
        }
    };

    const handleAcceptRequest = async (requesterId) => {
        try {
            setActionLoading(prev => ({ ...prev, [requesterId]: true }));

            console.log('✅ Accepting friend request from:', requesterId);
            await acceptFriendRequest(requesterId);

            // Update local state immediately for better UX
            setUserState(prev => ({ ...prev, [requesterId]: 'friend' }));

            console.log('✅ Friend request accepted successfully');

        } catch (error) {
            console.error('Error accepting friend request:', error);
            alert('Failed to accept friend request');
        } finally {
            setActionLoading(prev => ({ ...prev, [requesterId]: false }));
        }
    };

    const handleDeclineRequest = async (requesterId) => {
        try {
            setActionLoading(prev => ({ ...prev, [requesterId]: true }));

            console.log('❌ Declining friend request from:', requesterId);
            await declineFriendRequest(requesterId);

            // Update local state immediately
            setUserState(prev => {
                const newState = { ...prev };
                delete newState[requesterId];
                return newState;
            });

            console.log('❌ Friend request declined successfully');

        } catch (error) {
            console.error('Error declining friend request:', error);
            alert('Failed to decline friend request');
        } finally {
            setActionLoading(prev => ({ ...prev, [requesterId]: false }));
        }
    };

    const handleSendFriendRequest = async (targetUserId) => {
        try {
            setActionLoading(prev => ({ ...prev, [targetUserId]: true }));

            console.log('📤 Sending friend request to:', targetUserId);
            await sendFriendRequest(targetUserId);

            // Update local state immediately to show "Request Sent"
            setUserState(prev => ({ ...prev, [targetUserId]: 'requestSent' }));

            console.log('✅ Friend request sent successfully');

        } catch (error) {
            console.error('Error sending friend request:', error);
            alert(error.message || 'Failed to send friend request');

            // Revert local state on error
            setUserState(prev => {
                const newState = { ...prev };
                delete newState[targetUserId];
                return newState;
            });
        } finally {
            setActionLoading(prev => ({ ...prev, [targetUserId]: false }));
        }
    };

    const handleCancelFriendRequest = async (targetUserId) => {
        console.log('❌ Cancel request clicked for user:', targetUserId);

        try {
            setActionLoading(prev => ({ ...prev, [targetUserId]: true }));

            console.log('📤 Canceling friend request to:', targetUserId);
            await cancelFriendRequest(targetUserId);

            // Update local state immediately to remove request sent status
            setUserState(prev => {
                const newState = { ...prev };
                delete newState[targetUserId];
                return newState;
            });

            console.log('✅ Friend request canceled successfully');

        } catch (error) {
            console.error('Error canceling friend request:', error);
            alert('Failed to cancel friend request: ' + error.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [targetUserId]: false }));
        }
    };

    const handleRemoveFriend = async (friendId) => {
        // Get friend's name for the confirmation dialog
        const friend = friends.find(f => f.id === friendId);
        const friendName = friend ? friend.displayName : 'this friend';

        if (!window.confirm(`Are you sure you want to unfriend ${friendName}? This action cannot be undone.`)) {
            return;
        }

        try {
            setActionLoading(prev => ({ ...prev, [friendId]: true }));

            console.log('💔 Removing friend:', friendId);
            await removeFriend(friendId);

            // Update local state immediately
            setUserState(prev => {
                const newState = { ...prev };
                delete newState[friendId];
                return newState;
            });

            // Remove from friends list immediately for better UX
            setFriends(prev => prev.filter(friend => friend.id !== friendId));

            console.log('✅ Friend removed successfully');

        } catch (error) {
            console.error('Error removing friend:', error);
            alert('Failed to remove friend. Please try again.');

            // Refresh data to revert any optimistic updates
            await loadAllData();
        } finally {
            setActionLoading(prev => ({ ...prev, [friendId]: false }));
        }
    };

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    const PersonCard = ({ person, type, onAccept, onDecline, onAddFriend, onCancelRequest, onRemove, onMessage }) => {
        const relationshipState = userState[person.id];

        return (
            <div className="person-card">
                <div className="person-info">
                    <div className="person-avatar">
                        <div className="avatar">
                            {getAvatarInitials(person.displayName)}
                        </div>
                        <div className="status-indicator online"></div>
                    </div>
                    <div className="person-details">
                        <h3 className="person-name">{person.displayName}</h3>
                        <p className="person-username">@{person.username}</p>
                        {person.mutualFriends > 0 && (
                            <p className="mutual-friends">{person.mutualFriends} mutual friends</p>
                        )}
                        {person.bio && (
                            <p className="suggestion-reason">{person.bio}</p>
                        )}
                    </div>
                </div>

                <div className="person-actions">
                    {type === 'friend' && (
                        <>
                            <button
                                className="action-btn message"
                                onClick={() => onMessage && onMessage(person.id)}
                            >
                                Message
                            </button>
                            <button
                                className="action-btn unfriend"
                                onClick={() => onRemove && onRemove(person.id)}
                                disabled={actionLoading[person.id]}
                            >
                                {actionLoading[person.id] ? 'Removing...' : 'Unfriend'}
                            </button>
                        </>
                    )}

                    {type === 'request' && (
                        <>
                            <button
                                className="action-btn accept"
                                onClick={() => onAccept && onAccept(person.id)}
                                disabled={actionLoading[person.id]}
                            >
                                {actionLoading[person.id] ? 'Accepting...' : 'Accept'}
                            </button>
                            <button
                                className="action-btn decline"
                                onClick={() => onDecline && onDecline(person.id)}
                                disabled={actionLoading[person.id]}
                            >
                                {actionLoading[person.id] ? 'Declining...' : 'Decline'}
                            </button>
                        </>
                    )}

                    {(type === 'suggestion' || type === 'search') && (
                        <>
                            {relationshipState === 'requestSent' ? (
                                <button
                                    className="action-btn cancel-request"
                                    onClick={() => {
                                        onCancelRequest && onCancelRequest(person.id);
                                    }}
                                    disabled={actionLoading[person.id]}
                                >
                                    {actionLoading[person.id] ? 'Canceling...' : 'Cancel Request'}
                                </button>
                            ) : relationshipState === 'friend' ? (
                                <button className="action-btn already-friends" disabled>
                                    Friends
                                </button>
                            ) : (
                                <button
                                    className="action-btn add-friend"
                                    onClick={() => onAddFriend && onAddFriend(person.id)}
                                    disabled={actionLoading[person.id]}
                                >
                                    {actionLoading[person.id] ? 'Sending...' : 'Add Friend'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    // Never show loading screen - always render content immediately
    return (
        <div className="connections-page">
            <div className="page-header">
                <h1 className="page-title">Connections</h1>
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Search people..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Show search results if searching */}
            {searchTerm.trim().length >= 2 && (
                <div className="search-results">
                    <h3>Search Results</h3>
                    {searchResults.length > 0 ? (
                        <div className="search-list">
                            {searchResults.map(person => (
                                <PersonCard
                                    key={person.id}
                                    person={person}
                                    type="search"
                                    onAddFriend={handleSendFriendRequest}
                                    onCancelRequest={handleCancelFriendRequest}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>No users found matching "{searchTerm}"</p>
                        </div>
                    )}
                </div>
            )}

            {/* Tabs - only show when not searching */}
            {searchTerm.trim().length < 2 && (
                <>
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

                    <div className="connections-content">
                        {activeTab === 'friends' && (
                            <div className="friends-list">
                                {friends.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No friends yet. Start connecting with people!</p>
                                    </div>
                                ) : (
                                    friends.map(friend => (
                                        <PersonCard
                                            key={friend.id}
                                            person={friend}
                                            type="friend"
                                            onRemove={handleRemoveFriend}
                                            onMessage={(friendId) => {
                                                console.log('Message friend:', friendId);
                                            }}
                                        />
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
                                        <PersonCard
                                            key={request.id}
                                            person={request}
                                            type="request"
                                            onAccept={handleAcceptRequest}
                                            onDecline={handleDeclineRequest}
                                        />
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
                                        <PersonCard
                                            key={suggestion.id}
                                            person={suggestion}
                                            type="suggestion"
                                            onAddFriend={handleSendFriendRequest}
                                            onCancelRequest={handleCancelFriendRequest}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ConnectionsPage;