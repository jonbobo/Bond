import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { getUserFriendsForChat, searchUsers } from '../services/chatUtils';

const ContactsSidebar = () => {
    const [user] = useAuthState(auth);
    const [friends, setFriends] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);

    // Real-time listener for user's friends list changes
    useEffect(() => {
        if (!user) {
            setFriends([]);
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

    // Periodic refresh for online status updates
    useEffect(() => {
        if (!user) return;

        const refreshOnlineStatus = async () => {
            try {
                const friendsList = await getUserFriendsForChat(user.uid);
                setFriends(prev => {
                    // Only update if there are actual changes to prevent unnecessary re-renders
                    const hasChanges = prev.length !== friendsList.length ||
                        prev.some((friend, index) => {
                            const newFriend = friendsList[index];
                            return !newFriend || friend.isOnline !== newFriend.isOnline;
                        });

                    if (hasChanges) {
                        console.log('🔄 Online status updated');
                        return friendsList;
                    }
                    return prev;
                });
            } catch (error) {
                console.error('Error refreshing online status:', error);
            }
        };

        // Refresh online status every 30 seconds
        const interval = setInterval(refreshOnlineStatus, 30000);

        return () => clearInterval(interval);
    }, [user]);

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

        const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));

        if (diffInMinutes < 5) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
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
                            /* Friends List */
                            <>
                                {/* Online Friends First */}
                                {friends.filter(friend => friend.isOnline).length > 0 && (
                                    <div className="contacts-section">
                                        <div className="section-header">
                                            <span className="section-title">Online</span>
                                            <span className="section-count">
                                                {friends.filter(friend => friend.isOnline).length}
                                            </span>
                                        </div>
                                        {friends
                                            .filter(friend => friend.isOnline)
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
                                {friends.filter(friend => !friend.isOnline).length > 0 && (
                                    <div className="contacts-section">
                                        <div className="section-header">
                                            <span className="section-title">Offline</span>
                                            <span className="section-count">
                                                {friends.filter(friend => !friend.isOnline).length}
                                            </span>
                                        </div>
                                        {friends
                                            .filter(friend => !friend.isOnline)
                                            .sort((a, b) => {
                                                // Sort by last seen (most recent first)
                                                const aTime = a.lastSeen?.toDate?.() || new Date(0);
                                                const bTime = b.lastSeen?.toDate?.() || new Date(0);
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
                                                            {formatLastSeen(friend.lastSeen)}
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