// components/common/PostCard.jsx
import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import CommentSection from './CommentSection';

const PostCard = ({ post, onLike, onPostUpdate }) => {
    const [user] = useAuthState(auth);
    const [showComments, setShowComments] = useState(false);

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

    const handleLike = () => {
        if (onLike) {
            onLike(post.id);
        }
    };

    const handleCommentToggle = () => {
        setShowComments(!showComments);
    };

    const isLiked = post.likes?.includes(user?.uid);
    const likeCount = post.likeCount || 0;
    const commentCount = post.commentCount || 0;

    return (
        <div className="post-card" style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '16px',
            overflow: 'hidden',
            transition: 'box-shadow 0.2s ease'
        }}>
            {/* Post Header */}
            <div className="post-header" style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 16px 12px',
                gap: '12px'
            }}>
                <div className="post-author" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: 1
                }}>
                    <div className="avatar" style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '1rem',
                        flexShrink: 0
                    }}>
                        {getAvatarInitials(post.author?.displayName)}
                    </div>
                    <div className="author-info">
                        <div className="author-name" style={{
                            fontWeight: '600',
                            color: '#2d3748',
                            fontSize: '0.95rem'
                        }}>
                            {post.author?.displayName || 'Unknown User'}
                        </div>
                        <div className="post-time" style={{
                            color: '#718096',
                            fontSize: '0.8rem'
                        }}>
                            {formatTimeAgo(post.createdAt)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Post Content */}
            <div className="post-content" style={{
                padding: '0 16px 12px',
                fontSize: '1rem',
                lineHeight: '1.5',
                color: '#2d3748',
                wordBreak: 'break-word'
            }}>
                <p style={{ margin: 0 }}>{post.content}</p>
            </div>

            {/* Post Stats */}
            {(likeCount > 0 || commentCount > 0) && (
                <div style={{
                    padding: '0 16px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: '#718096'
                }}>
                    <div>
                        {likeCount > 0 && (
                            <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
                        )}
                    </div>
                    <div>
                        {commentCount > 0 && (
                            <button
                                onClick={handleCommentToggle}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#667eea',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    padding: 0
                                }}
                            >
                                {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Post Actions */}
            <div className="post-actions" style={{
                display: 'flex',
                borderTop: '1px solid #f7fafc',
                marginTop: '8px'
            }}>
                <button
                    className={`action-btn like ${isLiked ? 'liked' : ''}`}
                    onClick={handleLike}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '12px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: isLiked ? '#e53e3e' : '#718096',
                        fontWeight: isLiked ? '600' : '500',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s ease',
                        borderRadius: 0
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span>Like</span>
                </button>

                <button
                    className="action-btn comment"
                    onClick={handleCommentToggle}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '12px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: showComments ? '#667eea' : '#718096',
                        fontWeight: showComments ? '600' : '500',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s ease',
                        borderRadius: 0,
                        borderLeft: '1px solid #f7fafc'
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                    </svg>
                    <span>Comment</span>
                </button>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div style={{ padding: '0 16px 16px' }}>
                    <CommentSection
                        post={post}
                        onPostUpdate={onPostUpdate}
                        isVisible={showComments}
                    />
                </div>
            )}
        </div>
    );
};

export default PostCard;