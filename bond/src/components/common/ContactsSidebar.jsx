import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { getUserFriendsForChat, searchUsers } from '../services/chatUtils';
import { subscribeToMultipleUsersPresence } from '../services/presenceUtils'; // ✅ NEW: Realtime DB presence

const ContactsSidebar = () => {
    const [user] = useAuthState(auth);
    const [friends, setFriends] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [presenceData, setPresenceData] = useState({}); // ✅ NEW: Real-time presence data

    // Real-time listener for user's friends list changes
    useEffect(() => {
        if (!user) {
            setFriends([]);
            setPresenceData({});
            return;
        }

        console.log('🔄 Setting up real-time friends listener for contacts sidebar');

        // Listen to user document changes (for friends list updates)
        const unsubscribeUser = onSnapshot(
            doc(db, "users", user.uid),
            async (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const userData = docSnapshot.data();
                    const currentFriends = userData.friends || [];

                    console.log('🔄 Friends list updated in real-time:', currentFriends.length);

                    // Reload friends with their details
                    try {
                        const friendsList = await getUserFriendsForChat(user.uid);
                        setFriends(friendsList);
                        console.log('✅ Friends list refreshed with details:', friendsList.length);
                    } catch (error) {
                        console.error('❌ Error refreshing friends list:', error);
                    }
                } else {
                    console.log('⚠️ User document not found');
                    setFriends([]);
                }
            },
            (error) => {
                console.error('❌ Friends listener error:', error);
            }
        );

        return () => {
            console.log('🔄 Cleaning up friends listener');
            unsubscribeUser();
        };
    }, [user]);

    // Initial load of friends
    useEffect(() => {
        const loadFriends = async () => {
            if (!user) return;

            setLoading(true);
            try {
                const friendsList = await getUserFriendsForChat(user.uid);
                setFriends(friendsList);
                console.log('📊 Initial friends load:', friendsList.length);
            } catch (error) {
                console.error('Error loading friends for chat:', error);
            } finally {
                setLoading(false);
            }
        };

        loadFriends();
    }, [user]);

    // ✅ NEW: Real-time presence tracking for friends
    useEffect(() => {
        if (!user || friends.length === 0) {
            setPresenceData({});
            return;
        }

        console.log('🔄 Setting up real-time presence for', friends.length, 'friends');

        const friendIds = friends.map(friend => friend.id);

        // Subscribe to real-time presence updates
        const unsubscribePresence = subscribeToMultipleUsersPresence(
            friendIds,
            (newPresenceData) => {
                console.log('📡 Presence data updated:', Object.keys(newPresenceData).length, 'users');
                setPresenceData(newPresenceData);
            }
        );

        return () => {
            console.log('🧹 Cleaning up presence listeners');
            unsubscribePresence();
        };
    }, [user, friends]);

    // Search for users (friends and non-friends)
    useEffect(() => {
        const searchTimeout = setTimeout(async () => {
            if (searchTerm.trim().length >= 2) {
                setLoading(true);
                try {
                    const results = await searchUsers(searchTerm, user.uid, 10);
                    setSearchResults(results);
                    setShowSearchResults(true);
                } catch (error) {
                    console.error('Error searching users:', error);
                    setSearchResults([]);
                } finally {
                    setLoading(false);
                }
            } else {
                setSearchResults([]);
                setShowSearchResults(false);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [searchTerm, user]);

    const handleChatClick = (person) => {
        // Dispatch custom event to open floating chat
        window.dispatchEvent(new CustomEvent('openFloatingChat', {
            detail: { friend: person }
        }));
    };

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    const formatLastSeen = (lastSeen) => {
        if (!lastSeen) return 'Long ago';

        // Handle both Firebase timestamp and regular timestamp
        const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));

        if (diffInMinutes < 5) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    };

    // ✅ NEW: Get real-time online status for a friend
    const getFriendOnlineStatus = (friendId) => {
        const presence = presenceData[friendId];
        return presence ? presence.isOnline : false;
    };

    // ✅ NEW: Get last seen from real-time presence data
    const getFriendLastSeen = (friendId) => {
        const presence = presenceData[friendId];
        return presence ? presence.lastSeen : null;
    };

    if (!user) return null;

    // Show search results if searching, otherwise show friends
    const displayList = showSearchResults ? searchResults : friends;
    const isSearching = showSearchResults;

    return (
        <div className="contacts-sidebar">
            <div className="contacts-header">
                <h3>Contacts</h3>
                <div className="contacts-search">
                    <input
                        type="text"
                        placeholder="Search people to message..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="contacts-list">
                {loading && displayList.length === 0 ? (
                    <div className="contacts-loading">
                        <p>Loading...</p>
                    </div>
                ) : displayList.length === 0 ? (
                    <div className="no-contacts">
                        {searchTerm ? (
                            <p>No users found matching "{searchTerm}"</p>
                        ) : (
                            <p>No friends to chat with yet. Search for people above or add some friends first!</p>
                        )}
                    </div>
                ) : (
                    <>
                        {isSearching ? (
                            /* Search Results */
                            <div className="contacts-section">
                                <div className="section-header">
                                    <span className="section-title">Search Results</span>
                                    <span className="section-count">{displayList.length}</span>
                                </div>
                                {displayList.map(person => (
                                    <div
                                        key={person.id}
                                        className="contact-item"
                                        onClick={() => handleChatClick(person)}
                                    >
                                        <div className="contact-avatar">
                                            {getAvatarInitials(person.displayName)}
                                            {/* ✅ Use search results' isOnline (if available) */}
                                            {person.isOnline && <div className="online-indicator"></div>}
                                        </div>
                                        <div className="contact-info">
                                            <div className="contact-name">
                                                {person.displayName}
                                            </div>
                                            <div className="contact-status">
                                                @{person.username}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Friends List with Real-time Presence */
                            <>
                                {/* Online Friends First */}
                                {friends.filter(friend => getFriendOnlineStatus(friend.id)).length > 0 && (
                                    <div className="contacts-section">
                                        <div className="section-header">
                                            <span className="section-title">Online</span>
                                            <span className="section-count">
                                                {friends.filter(friend => getFriendOnlineStatus(friend.id)).length}
                                            </span>
                                        </div>
                                        {friends
                                            .filter(friend => getFriendOnlineStatus(friend.id))
                                            .map(friend => (
                                                <div
                                                    key={friend.id}
                                                    className="contact-item online"
                                                    onClick={() => handleChatClick(friend)}
                                                >
                                                    <div className="contact-avatar">
                                                        {getAvatarInitials(friend.displayName)}
                                                        <div className="online-indicator"></div>
                                                    </div>
                                                    <div className="contact-info">
                                                        <div className="contact-name">
                                                            {friend.displayName}
                                                        </div>
                                                        <div className="contact-status">
                                                            Active now
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}

                                {/* Offline Friends */}
                                {friends.filter(friend => !getFriendOnlineStatus(friend.id)).length > 0 && (
                                    <div className="contacts-section">
                                        <div className="section-header">
                                            <span className="section-title">Offline</span>
                                            <span className="section-count">
                                                {friends.filter(friend => !getFriendOnlineStatus(friend.id)).length}
                                            </span>
                                        </div>
                                        {friends
                                            .filter(friend => !getFriendOnlineStatus(friend.id))
                                            .sort((a, b) => {
                                                // Sort by last seen (most recent first)
                                                const aTime = getFriendLastSeen(a.id) || 0;
                                                const bTime = getFriendLastSeen(b.id) || 0;
                                                return bTime - aTime;
                                            })
                                            .map(friend => (
                                                <div
                                                    key={friend.id}
                                                    className="contact-item offline"
                                                    onClick={() => handleChatClick(friend)}
                                                >
                                                    <div className="contact-avatar">
                                                        {getAvatarInitials(friend.displayName)}
                                                    </div>
                                                    <div className="contact-info">
                                                        <div className="contact-name">
                                                            {friend.displayName}
                                                        </div>
                                                        <div className="contact-status">
                                                            {formatLastSeen(getFriendLastSeen(friend.id))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ContactsSidebar;