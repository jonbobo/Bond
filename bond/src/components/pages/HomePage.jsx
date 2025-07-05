// File: src/components/pages/HomePage.jsx - WITH COMMENT SYSTEM
import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFeedPosts, togglePostLike } from '../services/postUtils';
import { getCurrentUserProfile, getUserFriends } from '../services/authUtils';
import PostModal from '../modals/PostModal';
import PostCard from '../common/PostCard';
import './HomePage.css';

const HomePage = () => {
    const [user] = useAuthState(auth);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [showPostModal, setShowPostModal] = useState(false);
    const [realtimeListeners, setRealtimeListeners] = useState([]);

    // Check if modal should open (from URL params or custom event)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('newpost') === 'true') {
            setShowPostModal(true);
            // Clean up URL without causing page reload
            window.history.replaceState({}, '', window.location.pathname);
        }

        // Listen for custom event from sidebar
        const handleOpenPostModal = () => {
            setShowPostModal(true);
        };

        window.addEventListener('openPostModal', handleOpenPostModal);

        return () => {
            window.removeEventListener('openPostModal', handleOpenPostModal);
        };
    }, []);

    // Load user profile and set up real-time posts
    useEffect(() => {
        const loadData = async () => {
            if (user) {
                setLoading(true);
                try {
                    await loadUserProfile();
                    await setupRealtimePosts();
                } finally {
                    setLoading(false);
                }
            }
        };
        loadData();

        // Cleanup listeners when component unmounts or user changes
        return () => {
            cleanupRealtimeListeners();
        };
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    const cleanupRealtimeListeners = () => {
        realtimeListeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        setRealtimeListeners([]);
    };

    // ✅ OPTIMIZED: Real-time posts without additional user queries
    const setupRealtimePosts = async () => {
        if (!user) return;

        try {
            console.log('🔄 Setting up optimized real-time posts listener...');

            // Get user's friends to know which posts to listen to
            const friends = await getUserFriends(user.uid);
            const allowedUserIds = [user.uid, ...friends];

            if (allowedUserIds.length === 0) {
                setPosts([]);
                return;
            }

            // ✅ OPTIMIZED: Real-time listener WITHOUT additional queries
            const postsQuery = query(
                collection(db, "posts"),
                where("authorId", "in", allowedUserIds.slice(0, 10)), // Firestore limit
                where("visibility", "in", ["friends", "public"]),
                orderBy("createdAt", "desc"),
                limit(20)
            );

            const unsubscribe = onSnapshot(
                postsQuery,
                (querySnapshot) => {
                    console.log('🔄 Real-time posts update received');

                    const updatedPosts = [];

                    // ✅ NO ADDITIONAL QUERIES - author data is already in the post
                    querySnapshot.forEach((docSnap) => {
                        const postData = docSnap.data();

                        // ✅ Author data should already be included in post
                        // If not, we have fallback data
                        const authorInfo = postData.author || {
                            id: postData.authorId,
                            username: 'unknown',
                            displayName: 'Unknown User',
                            profilePicture: null
                        };

                        updatedPosts.push({
                            id: docSnap.id,
                            ...postData,
                            author: authorInfo
                        });
                    });

                    // Sort by creation date (newest first)
                    updatedPosts.sort((a, b) => {
                        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
                        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
                        return bTime - aTime;
                    });

                    console.log('✅ Updated posts (no additional queries):', updatedPosts.length);
                    setPosts(updatedPosts);
                },
                (error) => {
                    console.error('❌ Real-time posts listener error:', error);
                    // Fallback to regular loading
                    loadPostsFallback();
                }
            );

            setRealtimeListeners([unsubscribe]);

        } catch (error) {
            console.error('Error setting up real-time posts:', error);
            // Fallback to regular loading
            loadPostsFallback();
        }
    };

    // Fallback to regular post loading if real-time fails
    const loadPostsFallback = async () => {
        if (!user) return;

        try {
            console.log('📄 Loading posts (fallback mode)...');
            const feedPosts = await getFeedPosts(user.uid);
            setPosts(feedPosts);
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    };

    const loadUserProfile = async () => {
        try {
            const profile = await getCurrentUserProfile();
            setUserProfile(profile);
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    };

    // ✅ OPTIMIZED: Better optimistic updates
    const handleLike = async (postId) => {
        try {
            console.log('🔄 Handling like for post:', postId);

            // Find the current post
            const currentPost = posts.find(p => p.id === postId);
            if (!currentPost) return;

            const isCurrentlyLiked = currentPost.likes?.includes(user.uid);

            // ✅ OPTIMISTIC UPDATE with better state management
            setPosts(prevPosts =>
                prevPosts.map(post => {
                    if (post.id === postId) {
                        const newLikes = isCurrentlyLiked
                            ? post.likes.filter(id => id !== user.uid)
                            : [...(post.likes || []), user.uid];

                        return {
                            ...post,
                            likes: newLikes,
                            likeCount: newLikes.length
                        };
                    }
                    return post;
                })
            );

            // Update in Firebase
            await togglePostLike(postId);
            console.log('✅ Like update completed');

        } catch (error) {
            console.error('❌ Error liking post:', error);

            // ✅ REVERT optimistic update on error
            setPosts(prevPosts =>
                prevPosts.map(post => {
                    if (post.id === postId) {
                        const currentPost = posts.find(p => p.id === postId);
                        return currentPost; // Revert to original state
                    }
                    return post;
                })
            );

            alert('Failed to update like. Please try again.');
        }
    };

    // ✅ NEW: Handle post updates (for comments, etc.)
    const handlePostUpdate = (postId, updatedPost) => {
        setPosts(prevPosts =>
            prevPosts.map(post =>
                post.id === postId ? updatedPost : post
            )
        );
    };

    const handlePostCreated = async () => {
        // Real-time listener will automatically pick up new posts
        console.log('✅ New post created - real-time listener will update feed');
    };

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    const getMyDisplayName = () => {
        if (userProfile?.displayName) return userProfile.displayName;
        if (userProfile?.username) return userProfile.username;
        if (user?.email) return user.email.split('@')[0];
        return 'User';
    };

    // Show minimal loading only for actual data loading
    if (loading) {
        return (
            <div className="homepage">
                <div className="page-header">
                    <h1 className="page-title">Welcome to Bond</h1>
                    <p className="page-subtitle">Your distraction-free social space</p>
                </div>
                <div className="loading-message">
                    <p>Loading your feed...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="homepage">
            <div className="page-header">
                <h1 className="page-title">Welcome to Bond</h1>
                <p className="page-subtitle">Your distraction-free social space</p>
            </div>

            {/* Clickable Post Prompt */}
            <div className="post-prompt" onClick={() => setShowPostModal(true)}>
                <div className="prompt-content">
                    <div className="user-avatar small">
                        {getAvatarInitials(getMyDisplayName())}
                    </div>
                    <div className="prompt-text">
                        What's on your mind?
                    </div>
                </div>
            </div>

            {/* Feed */}
            <div className="feed">
                <div className="feed-header">
                    <h2>Recent Posts</h2>
                    <div className="feed-status">
                        <span style={{
                            fontSize: '0.8rem',
                            color: realtimeListeners.length > 0 ? '#48bb78' : '#718096',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: realtimeListeners.length > 0 ? '#48bb78' : '#718096'
                            }}></span>
                            {realtimeListeners.length > 0 ? 'Live Updates' : 'Static Feed'}
                        </span>
                    </div>
                </div>

                {/* Posts using PostCard component */}
                {posts.length > 0 ? (
                    posts.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onLike={handleLike}
                            onPostUpdate={handlePostUpdate}
                        />
                    ))
                ) : (
                    <div className="feed-empty">
                        <p>No posts yet. Be the first to share something or connect with friends to see their posts!</p>
                    </div>
                )}
            </div>

            {/* Post Modal */}
            <PostModal
                isOpen={showPostModal}
                onClose={() => setShowPostModal(false)}
                onPostCreated={handlePostCreated}
            />
        </div>
    );
};

export default HomePage;