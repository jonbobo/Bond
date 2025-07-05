// components/common/CommentSection.jsx - COST-OPTIMIZED WITH PAGINATION
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { addComment, getPostComments, subscribeToComments } from '../services/postUtils';
import Comment from './Comment';

const CommentSection = ({ post, onPostUpdate, isVisible }) => {
    const [user] = useAuthState(auth);
    const [comments, setComments] = useState([]);
    const [commentContent, setCommentContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [showAllComments, setShowAllComments] = useState(false);
    const [realtimeUnsubscribe, setRealtimeUnsubscribe] = useState(null);
    const [hasLoadedComments, setHasLoadedComments] = useState(false);
    const [hasMoreComments, setHasMoreComments] = useState(false);
    const [lastCommentDoc, setLastCommentDoc] = useState(null);

    // 💰 COST OPTIMIZATION: Load initial batch of comments (20 at a time)
    const loadComments = useCallback(async (isLoadMore = false) => {
        if ((hasLoadedComments && !isLoadMore) || isLoading || isLoadingMore) return;

        try {
            if (isLoadMore) {
                setIsLoadingMore(true);
            } else {
                setIsLoading(true);
                setComments([]); // Clear existing comments
            }

            // Load 20 comments at a time for cost control
            const { comments: newComments, hasMore, lastDoc } = await getPostComments(
                post.id,
                20,
                isLoadMore ? lastCommentDoc : null
            );

            if (isLoadMore) {
                setComments(prev => [...(prev || []), ...(newComments || [])]);
            } else {
                setComments(newComments || []);
                setHasLoadedComments(true);
            }

            setHasMoreComments(hasMore || false);
            setLastCommentDoc(lastDoc);

        } catch (error) {
            console.error('Error loading comments:', error);
            // Ensure we don't set comments to undefined on error
            if (!isLoadMore && !hasLoadedComments) {
                setComments([]);
                setHasLoadedComments(true);
            }
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [post.id, hasLoadedComments, isLoading, isLoadingMore, lastCommentDoc]);

    // 💰 COST OPTIMIZATION: Setup real-time listener for recent comments only
    const setupRealtimeComments = useCallback(() => {
        if (realtimeUnsubscribe || !hasLoadedComments) return;

        try {
            // Only listen to the most recent 20 comments for cost control
            const unsubscribe = subscribeToComments(post.id, (updatedComments) => {
                setComments(prevComments => {
                    // Merge real-time updates with existing comments
                    const commentMap = new Map();

                    // Add existing comments (ensure it's an array)
                    const currentComments = prevComments || [];
                    currentComments.forEach(comment => {
                        commentMap.set(comment.id, comment);
                    });

                    // Update with real-time data (only recent 20)
                    const newComments = updatedComments || [];
                    newComments.forEach(comment => {
                        commentMap.set(comment.id, comment);
                    });

                    return Array.from(commentMap.values()).sort((a, b) => {
                        const aTime = new Date(a.createdAt?.toDate?.() || a.createdAt);
                        const bTime = new Date(b.createdAt?.toDate?.() || b.createdAt);
                        return aTime - bTime; // Oldest first
                    });
                });
            });

            setRealtimeUnsubscribe(() => unsubscribe);
        } catch (error) {
            console.error('Failed to setup real-time listener:', error);
            // Don't crash the component if real-time setup fails
        }
    }, [post.id, realtimeUnsubscribe, hasLoadedComments]);

    // Load comments when section becomes visible
    useEffect(() => {
        if (isVisible && post.id && !hasLoadedComments) {
            loadComments();
        }
    }, [isVisible, post.id, loadComments, hasLoadedComments]);

    // Setup real-time only after initial load
    useEffect(() => {
        if (isVisible && hasLoadedComments && !realtimeUnsubscribe) {
            setupRealtimeComments();
        }

        return () => {
            if (realtimeUnsubscribe) {
                realtimeUnsubscribe();
                setRealtimeUnsubscribe(null);
            }
        };
    }, [isVisible, hasLoadedComments, setupRealtimeComments, realtimeUnsubscribe]);

    const getAvatarInitials = (displayName) => {
        if (!displayName) return 'U';
        return displayName.charAt(0).toUpperCase();
    };

    const getUserDisplayName = () => {
        if (user?.displayName) return user.displayName;
        if (user?.email) return user.email.split('@')[0];
        return 'User';
    };

    const handleSubmitComment = async (e) => {
        e.preventDefault();

        if (!commentContent.trim() || isSubmitting) return;

        try {
            setIsSubmitting(true);

            // 💰 WRITE-OPTIMIZED: Only 2 writes (comment + increment counter)
            const newComment = await addComment(post.id, commentContent);

            // 💰 OPTIMIZATION: Update local state immediately (no extra reads)
            if (newComment) {
                setComments(prevComments => {
                    const currentComments = prevComments || [];
                    return [...currentComments, newComment];
                });
            }

            // Update post count in parent
            if (onPostUpdate) {
                const updatedPost = {
                    ...post,
                    commentCount: (post.commentCount || 0) + 1
                };
                onPostUpdate(post.id, updatedPost);
            }

            setCommentContent('');

        } catch (error) {
            console.error('Error adding comment:', error);
            // Don't add undefined comment to state on error
            alert('Failed to add comment: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLoadMoreComments = () => {
        loadComments(true);
    };

    const handleCommentUpdate = (commentId, updatedComment) => {
        setComments(prevComments => {
            const currentComments = prevComments || [];
            return currentComments.map(comment =>
                comment.id === commentId ? updatedComment : comment
            );
        });
    };

    const handleCommentDelete = (commentId) => {
        setComments(prevComments => {
            const currentComments = prevComments || [];
            return currentComments.filter(comment => comment.id !== commentId);
        });

        if (onPostUpdate) {
            const updatedPost = {
                ...post,
                commentCount: Math.max(0, (post.commentCount || 0) - 1)
            };
            onPostUpdate(post.id, updatedPost);
        }
    };

    // Don't render anything if not visible
    if (!isVisible) return null;

    // ✅ FIX: Ensure comments is always an array
    const safeComments = comments || [];
    const displayComments = showAllComments ? safeComments : safeComments.slice(0, 3);
    const hasCommentsToShow = safeComments.length > 3;

    return (
        <div style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: '12px',
            marginTop: '8px'
        }}>
            {/* Loading State */}
            {isLoading && (
                <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#718096',
                    fontSize: '0.9rem'
                }}>
                    Loading comments...
                </div>
            )}

            {/* Comments List */}
            {!isLoading && safeComments.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                    {/* Load More Older Comments */}
                    {hasMoreComments && (
                        <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                            <button
                                onClick={handleLoadMoreComments}
                                disabled={isLoadingMore}
                                style={{
                                    background: 'none',
                                    border: '1px solid #e2e8f0',
                                    color: '#667eea',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    padding: '6px 12px',
                                    borderRadius: '16px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {isLoadingMore ? 'Loading...' : 'Load older comments'}
                            </button>
                        </div>
                    )}

                    {/* Show more/less comments button for display */}
                    {hasCommentsToShow && !showAllComments && (
                        <button
                            onClick={() => setShowAllComments(true)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#667eea',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: '500',
                                marginBottom: '8px',
                                padding: '4px 0'
                            }}
                        >
                            View all {safeComments.length} comments
                        </button>
                    )}

                    {/* Comments */}
                    {displayComments.map(comment => (
                        <Comment
                            key={comment.id}
                            comment={comment}
                            postId={post.id}
                            onCommentUpdate={handleCommentUpdate}
                            onCommentDelete={handleCommentDelete}
                        />
                    ))}

                    {/* Collapse comments button */}
                    {showAllComments && hasCommentsToShow && (
                        <button
                            onClick={() => setShowAllComments(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#667eea',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: '500',
                                marginTop: '4px',
                                padding: '4px 0'
                            }}
                        >
                            Show fewer comments
                        </button>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && safeComments.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '12px',
                    color: '#718096',
                    fontSize: '0.9rem',
                    fontStyle: 'italic'
                }}>
                    No comments yet. Be the first to comment!
                </div>
            )}

            {/* Comment Input */}
            {user && (
                <form onSubmit={handleSubmitComment}>
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start'
                    }}>
                        {/* User Avatar */}
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
                            flexShrink: 0,
                            marginTop: '8px'
                        }}>
                            {getAvatarInitials(getUserDisplayName())}
                        </div>

                        {/* Comment Input */}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                background: '#f7fafc',
                                borderRadius: '20px',
                                border: '1px solid #e2e8f0',
                                transition: 'border-color 0.2s ease'
                            }}>
                                <textarea
                                    value={commentContent}
                                    onChange={(e) => setCommentContent(e.target.value)}
                                    placeholder="Write a comment..."
                                    disabled={isSubmitting}
                                    style={{
                                        width: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        padding: '8px 12px',
                                        borderRadius: '20px',
                                        outline: 'none',
                                        resize: 'none',
                                        fontSize: '0.9rem',
                                        fontFamily: 'inherit',
                                        minHeight: '36px',
                                        maxHeight: '100px',
                                        overflow: 'auto'
                                    }}
                                    rows={1}
                                    maxLength={500} // Reasonable limit
                                    onInput={(e) => {
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmitComment(e);
                                        }
                                    }}
                                />
                            </div>

                            {/* Submit button */}
                            {commentContent.trim() && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    marginTop: '4px'
                                }}>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !commentContent.trim()}
                                        style={{
                                            background: isSubmitting || !commentContent.trim()
                                                ? '#cbd5e0'
                                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '16px',
                                            padding: '4px 12px',
                                            fontSize: '0.8rem',
                                            fontWeight: '500',
                                            cursor: isSubmitting || !commentContent.trim() ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {isSubmitting ? 'Posting...' : 'Post'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Character count */}
                    {commentContent.length > 400 && (
                        <div style={{
                            textAlign: 'right',
                            fontSize: '0.75rem',
                            color: commentContent.length > 480 ? '#e53e3e' : '#718096',
                            marginTop: '4px',
                            paddingRight: '36px'
                        }}>
                            {commentContent.length}/500
                        </div>
                    )}
                </form>
            )}

            {/* Login prompt */}
            {!user && (
                <div style={{
                    textAlign: 'center',
                    padding: '12px',
                    color: '#718096',
                    fontSize: '0.9rem',
                    fontStyle: 'italic'
                }}>
                    Please log in to comment
                </div>
            )}
        </div>
    );
};

export default CommentSection;