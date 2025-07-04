import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom'; // Add this import
import { auth, db } from '../services/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import './NotificationIcon.css';

const NotificationIcon = () => {
    const [user] = useAuthState(auth);
    const navigate = useNavigate(); // Add this hook
    const [notificationCount, setNotificationCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [friendRequests, setFriendRequests] = useState([]);

    // Real-time listener for notifications
    useEffect(() => {
        if (!user) {
            setNotificationCount(0);
            setFriendRequests([]);
            return;
        }

        console.log('🔔 Setting up real-time notifications for:', user.uid);

        // Listen to user document changes in real-time
        const unsubscribe = onSnapshot(
            doc(db, "users", user.uid),
            async (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const userData = docSnapshot.data();
                    const requestIds = userData.friendRequests || [];

                    console.log('🔔 Real-time notification update:', requestIds.length, 'requests');
                    setNotificationCount(requestIds.length);

                    // Load request details
                    if (requestIds.length > 0) {
                        try {
                            const requestDetails = [];
                            for (const requesterId of requestIds) {
                                const requesterDoc = await getDoc(doc(db, "users", requesterId));
                                if (requesterDoc.exists()) {
                                    const requesterData = requesterDoc.data();
                                    requestDetails.push({
                                        id: requesterId,
                                        displayName: requesterData.displayName || requesterData.username || 'Unknown',
                                        username: requesterData.username || 'unknown'
                                    });
                                }
                            }
                            setFriendRequests(requestDetails);
                        } catch (error) {
                            console.error('Error loading request details:', error);
                        }
                    } else {
                        setFriendRequests([]);
                    }
                } else {
                    console.log('⚠️ User document not found');
                    setNotificationCount(0);
                    setFriendRequests([]);
                }
            },
            (error) => {
                console.error('❌ Notification listener error:', error);
            }
        );

        // Cleanup listener
        return () => {
            console.log('🔔 Cleaning up notification listener');
            unsubscribe();
        };
    }, [user]);

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    if (!user) return null;

    return (
        <div className="notification-container">
            <button
                className="notification-btn"
                onClick={() => setShowDropdown(!showDropdown)}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {notificationCount > 0 && (
                    <span className="notification-badge">{notificationCount}</span>
                )}
            </button>

            {showDropdown && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                        <button
                            className="close-btn"
                            onClick={() => setShowDropdown(false)}
                        >
                            ×
                        </button>
                    </div>

                    <div className="notification-content">
                        {friendRequests.length > 0 ? (
                            <>
                                <h4>Friend Requests</h4>
                                {friendRequests.map(request => (
                                    <div key={request.id} className="notification-item">
                                        <div className="notification-avatar">
                                            {getAvatarInitials(request.displayName)}
                                        </div>
                                        <div className="notification-text">
                                            <strong>{request.displayName}</strong> sent you a friend request
                                        </div>
                                    </div>
                                ))}
                                <div className="notification-footer">
                                    <button
                                        className="view-all-btn"
                                        onClick={() => {
                                            setShowDropdown(false);
                                            navigate('/connections?tab=requests'); // Changed from window.location.href
                                        }}
                                    >
                                        View All Requests
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="no-notifications">
                                <p>No notifications</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationIcon;