// components/modals/PostModal.jsx
import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { createPost } from '../services/postUtils';
import { getCurrentUserProfile } from '../services/authUtils';

const PostModal = ({ isOpen, onClose, onPostCreated }) => {
    const [user] = useAuthState(auth);
    const [postContent, setPostContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userProfile, setUserProfile] = useState(null);

    // Load user profile when modal opens
    React.useEffect(() => {
        const loadProfile = async () => {
            if (isOpen && user) {
                try {
                    const profile = await getCurrentUserProfile();
                    setUserProfile(profile);
                } catch (error) {
                    console.error('Error loading user profile:', error);
                }
            }
        };
        loadProfile();
    }, [isOpen, user]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!postContent.trim() || isSubmitting) return;

        try {
            setIsSubmitting(true);
            await createPost(postContent, 'friends');

            // Clear form and close modal
            setPostContent('');
            onClose();

            // Notify parent to refresh posts
            if (onPostCreated) {
                onPostCreated();
            }

            console.log('✅ Post created successfully');
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
            onClose();
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setPostContent('');
            onClose();
        }
    };

    const getAvatarInitials = () => {
        if (userProfile?.displayName) {
            return userProfile.displayName.charAt(0).toUpperCase();
        }
        if (user?.email) {
            return user.email.charAt(0).toUpperCase();
        }
        return 'U';
    };

    const getDisplayName = () => {
        if (userProfile?.displayName) return userProfile.displayName;
        if (userProfile?.username) return userProfile.username;
        if (user?.email) return user.email.split('@')[0];
        return 'User';
    };

    if (!isOpen) return null;

    return (
        <div
            className="modal-backdrop"
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px'
            }}
        >
            <div
                className="modal-content"
                style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '0',
                    maxWidth: '600px',
                    width: '100%',
                    maxHeight: '80vh',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                    overflow: 'hidden'
                }}
            >
                {/* Modal Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: '#2d3748'
                    }}>
                        Create Post
                    </h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem',
                            color: '#718096',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px'
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit}>
                    <div style={{ padding: '24px' }}>
                        {/* User Info */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '16px'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '1.1rem'
                            }}>
                                {getAvatarInitials()}
                            </div>
                            <div>
                                <p style={{
                                    margin: 0,
                                    fontWeight: '600',
                                    color: '#2d3748',
                                    fontSize: '1rem'
                                }}>
                                    {getDisplayName()}
                                </p>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.875rem',
                                    color: '#718096'
                                }}>
                                    Sharing with friends
                                </p>
                            </div>
                        </div>

                        {/* Post Content */}
                        <div style={{ marginBottom: '20px' }}>
                            <textarea
                                value={postContent}
                                onChange={(e) => setPostContent(e.target.value)}
                                placeholder="What's on your mind?"
                                disabled={isSubmitting}
                                style={{
                                    width: '100%',
                                    minHeight: '120px',
                                    padding: '16px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    resize: 'vertical',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    lineHeight: '1.5'
                                }}
                                maxLength={500}
                                autoFocus
                            />
                        </div>

                        {/* Character Count */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <span style={{
                                fontSize: '0.875rem',
                                color: postContent.length > 450 ? '#e53e3e' : '#718096'
                            }}>
                                {postContent.length}/500 characters
                            </span>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}>
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            style={{
                                padding: '10px 20px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                background: 'white',
                                color: '#4a5568',
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!postContent.trim() || isSubmitting || postContent.length > 500}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: '8px',
                                background: (!postContent.trim() || isSubmitting || postContent.length > 500)
                                    ? '#cbd5e0'
                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                cursor: (!postContent.trim() || isSubmitting || postContent.length > 500)
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {isSubmitting ? 'Sharing...' : 'Share Post'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PostModal;