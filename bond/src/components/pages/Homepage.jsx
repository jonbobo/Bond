import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { createPost, getFeedPosts, togglePostLike } from '../services/postUtils';
import { getCurrentUserProfile } from '../services/authUtils';
import './HomePage.css';

const HomePage = () => {
    const [user] = useAuthState(auth);
    const [postContent, setPostContent] = useState('');
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false); // Change from true to false
    const [initialLoad, setInitialLoad] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Load user profile and posts
    useEffect(() => {
        const loadData = async () => {
            if (user) {
                // Set a timeout to avoid long loading states
                const loadingTimeout = setTimeout(() => {
                    setLoading(false);
                    setInitialLoad(false);
                }, 2000); // Max 2 seconds of loading

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

    const handlePostSubmit = async () => {
        if (!postContent.trim() || submitting) return;

        try {
            setSubmitting(true);
            await createPost(postContent, 'friends');
            setPostContent('');
            // Reload posts to show the new one
            await loadPosts();
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post. Please try again.');
        } finally {
            setSubmitting(false);
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

    // Show skeleton loading only during initial load
    if (loading && initialLoad) {
        return (
            <div className="homepage">
                <div className="page-header">
                    <h1 className="page-title">Welcome to Bond</h1>
                    <p className="page-subtitle">Your distraction-free social space</p>
                </div>

                {/* Post Composer */}
                <div className="post-composer">
                    <div className="composer-header">
                        <div className="user-avatar small">
                            {getAvatarInitials(userProfile?.displayName)}
                        </div>
                        <textarea
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            placeholder="What's on your mind?"
                            className="composer-input"
                            maxLength={500}
                            rows="1"
                            onInput={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                        />
                    </div>
                    <div className="composer-actions">
                        <span className="character-count">
                            {postContent.length}/500
                        </span>
                        <button
                            className="composer-btn"
                            onClick={handlePostSubmit}
                            disabled={!postContent.trim() || submitting}
                        >
                            {submitting ? 'Sharing...' : 'Share'}
                        </button>
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

            {/* Post Creation Area */}
            <div className="post-composer">
                <div className="composer-header">
                    <div className="user-avatar small">
                        {getAvatarInitials(userProfile?.displayName)}
                    </div>
                    <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="What's on your mind?"
                        className="composer-input"
                        maxLength={500}
                        rows="1"
                        onInput={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                    />
                </div>
                <div className="composer-actions">
                    <span className="character-count">
                        {postContent.length}/500
                    </span>
                    <button
                        className="composer-btn"
                        onClick={handlePostSubmit}
                        disabled={!postContent.trim() || submitting}
                    >
                        {submitting ? 'Sharing...' : 'Share'}
                    </button>
                </div>
            </div>

            {/* Feed */}
            <div className="feed">
                <div className="feed-header">
                    <h2>Recent Posts</h2>
                    <select className="feed-filter" onChange={(e) => {
                        // You can implement different filtering logic here
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
        </div>
    );
};

export default HomePage;