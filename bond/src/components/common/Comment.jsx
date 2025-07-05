// components/common/Comment.jsx - OPTIMIZED WITH INLINE STYLES
import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { toggleCommentLike, deleteComment } from '../services/postUtils';

const Comment = ({ comment, postId, onCommentUpdate, onCommentDelete }) => {
    const [user] = useAuthState(auth);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'Just now';

        const now = new Date();
        const commentTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInSeconds = Math.floor((now - commentTime) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        return `${Math.floor(diffInSeconds / 86400)}d`;
    };

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    const handleLike = async () => {
        try {
            // ✅ OPTIMIZED: Direct comment update, no post rewrite (1 write only)
            const updatedComment = await toggleCommentLike(postId, comment.id);
            if (onCommentUpdate) {
                onCommentUpdate(comment.id, updatedComment);
            }
        } catch (error) {
            console.error('Error liking comment:', error);
            alert('Failed to update like. Please try again.');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this comment?')) {
            return;
        }

        try {
            setIsDeleting(true);
            // ✅ OPTIMIZED: Batch delete comment + decrement count (2 writes only)
            await deleteComment(postId, comment.id);
            if (onCommentDelete) {
                onCommentDelete(comment.id);
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            alert('Failed to delete comment. Please try again.');
        } finally {
            setIsDeleting(false);
            setShowMenu(false);
        }
    };

    const canDelete = user && (comment.authorId === user.uid);
    const isLiked = comment.likes?.includes(user?.uid);

    return (
        <div style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 0',
            opacity: isDeleting ? 0.5 : 1,
            transition: 'opacity 0.2s ease'
        }}>
            {/* Avatar */}
            <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                fontSize: '0.75rem',
                flexShrink: 0
            }}>
                {getAvatarInitials(comment.author?.displayName)}
            </div>

            {/* Comment Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Comment Bubble */}
                <div style={{
                    background: '#f7fafc',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    marginBottom: '4px',
                    position: 'relative',
                    transition: 'background-color 0.2s ease'
                }}>
                    {/* Author and Menu */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '2px'
                    }}>
                        <span style={{
                            fontWeight: '600',
                            fontSize: '0.8rem',
                            color: '#2d3748'
                        }}>
                            {comment.author?.displayName || 'Unknown User'}
                        </span>

                        {/* Menu Button */}
                        {canDelete && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    disabled={isDeleting}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        color: '#718096',
                                        fontSize: '0.75rem',
                                        transition: 'background-color 0.2s ease',
                                        opacity: isDeleting ? 0.6 : 1
                                    }}
                                >
                                    ⋯
                                </button>

                                {/* Dropdown Menu */}
                                {showMenu && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        background: 'white',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                        zIndex: 10,
                                        minWidth: '80px',
                                        overflow: 'hidden'
                                    }}>
                                        <button
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            style={{
                                                width: '100%',
                                                padding: '6px 12px',
                                                border: 'none',
                                                background: 'none',
                                                textAlign: 'left',
                                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                                fontSize: '0.8rem',
                                                color: '#e53e3e',
                                                borderRadius: '6px',
                                                transition: 'background-color 0.2s ease',
                                                opacity: isDeleting ? 0.6 : 1
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isDeleting) e.target.style.background = '#fed7d7';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.background = 'none';
                                            }}
                                        >
                                            {isDeleting ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Comment Text */}
                    <div style={{
                        fontSize: '0.9rem',
                        color: '#2d3748',
                        lineHeight: '1.4',
                        wordBreak: 'break-word',
                        marginTop: '2px'
                    }}>
                        {comment.content}
                    </div>
                </div>

                {/* Comment Actions */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    paddingLeft: '12px',
                    fontSize: '0.75rem',
                    color: '#718096'
                }}>
                    <span>{formatTimeAgo(comment.createdAt)}</span>

                    <button
                        onClick={handleLike}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isLiked ? '#e53e3e' : '#718096',
                            fontWeight: isLiked ? '600' : '400',
                            fontSize: '0.75rem',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                        }}
                        onMouseEnter={(e) => {
                            if (!isLiked) e.target.style.background = '#f7fafc';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'none';
                        }}
                    >
                        {isLiked ? '❤️' : '🤍'} {comment.likeCount > 0 && comment.likeCount}
                    </button>
                </div>
            </div>

            {/* Click outside to close menu */}
            {showMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 5
                    }}
                    onClick={() => setShowMenu(false)}
                />
            )}
        </div>
    );
};

export default Comment;