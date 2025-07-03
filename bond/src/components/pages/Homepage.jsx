import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { getFeedPosts, togglePostLike } from '../services/postUtils';
import { getCurrentUserProfile } from '../services/authUtils';
import PostModal from '../modals/PostModal';
import './HomePage.css';

const HomePage = () => {
    const [user] = useAuthState(auth);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [showPostModal, setShowPostModal] = useState(false);

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

    // Load user profile and posts
    useEffect(() => {
        const loadData = async () => {
            if (user) {
                const loadingTimeout = setTimeout(() => {
                    setLoading(false);
                    setInitialLoad(false);
                }, 2000);

                try {
                    await loadUserProfile();
                    await loadPosts();
                } finally {
                    clearTimeout(loadingTimeout);
                }
            }
        };
        loadData();
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadUserProfile = async () => {
        try {
            const profile = await getCurrentUserProfile();
            setUserProfile(profile);
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    };

    const loadPosts = async () => {
        if (!user) return;

        try {
            if (initialLoad) {
                setLoading(true);
                setInitialLoad(false);
            }
            const feedPosts = await getFeedPosts(user.uid);
            setPosts(feedPosts);
        } catch (error) {
            console.error('Error loading posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (postId) => {
        try {
            await togglePostLike(postId);
            // Update the local post state
            setPosts(prevPosts =>
                prevPosts.map(post => {
                    if (post.id === postId) {
                        const isLiked = post.likes?.includes(user.uid);
                        const newLikes = isLiked
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
        } catch (error) {
            console.error('Error liking post:', error);
        }
    };

    const handlePostCreated = async () => {
        // Reload posts when a new post is created
        await loadPosts();
    };

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'Just now';

        const now = new Date();
        const postTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInSeconds = Math.floor((now - postTime) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
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

    // Show skeleton loading only during initial load
    if (loading && initialLoad) {
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

                {/* Skeleton Loader */}
                <div className="skeleton-loader">
                    {[1, 2].map(i => (
                        <div key={i} className="skeleton-post">
                            <div className="skeleton-header">
                                <div className="skeleton-avatar"></div>
                                <div>
                                    <div className="skeleton-text skeleton-name"></div>
                                    <div className="skeleton-text skeleton-time"></div>
                                </div>
                            </div>
                            <div className="skeleton-text skeleton-content"></div>
                            <div className="skeleton-text skeleton-content short"></div>
                        </div>
                    ))}
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
                    <select className="feed-filter" onChange={(e) => {
                        loadPosts();
                    }}>
                        <option value="recent">Recent</option>
                        <option value="friends">Friends Only</option>
                    </select>
                </div>

                {/* Posts */}
                {posts.length > 0 ? (
                    posts.map(post => (
                        <div key={post.id} className="post-card">
                            <div className="post-header">
                                <div className="post-author">
                                    <div className="avatar">
                                        {getAvatarInitials(post.author.displayName)}
                                    </div>
                                    <div className="author-info">
                                        <div className="author-name">
                                            {post.author.displayName}
                                        </div>
                                        <div className="post-time">
                                            {formatTimeAgo(post.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="post-content">
                                <p>{post.content}</p>
                            </div>

                            <div className="post-actions">
                                <button
                                    className={`action-btn like ${post.likes?.includes(user.uid) ? 'liked' : ''}`}
                                    onClick={() => handleLike(post.id)}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                    <span>{post.likeCount || 0}</span>
                                </button>

                                <button className="action-btn comment">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                                    </svg>
                                    <span>{post.commentCount || 0}</span>
                                </button>
                            </div>
                        </div>
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