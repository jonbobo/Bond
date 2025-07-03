// components/modals/UnfriendModal.jsx
import React from 'react';

const UnfriendModal = ({ isOpen, onClose, onConfirm, friendName, isLoading }) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

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
                zIndex: 1000
            }}
        >
            <div
                className="modal-content"
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '24px',
                    maxWidth: '400px',
                    width: '90%',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
                }}
            >
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{
                        margin: '0 0 12px 0',
                        color: '#2d3748',
                        fontSize: '1.25rem',
                        fontWeight: '600'
                    }}>
                        Unfriend {friendName}?
                    </h3>
                    <p style={{
                        margin: 0,
                        color: '#4a5568',
                        lineHeight: '1.5'
                    }}>
                        Are you sure you want to remove <strong>{friendName}</strong> from your friends list?
                        This action cannot be undone, and you'll need to send a new friend request to reconnect.
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        style={{
                            padding: '10px 20px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            background: 'white',
                            color: '#4a5568',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#f7fafc'}
                        onMouseOut={(e) => e.target.style.background = 'white'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        style={{
                            padding: '10px 20px',
                            border: '1px solid #e53e3e',
                            borderRadius: '6px',
                            background: '#e53e3e',
                            color: 'white',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            opacity: isLoading ? 0.7 : 1,
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                            if (!isLoading) {
                                e.target.style.background = '#c53030';
                                e.target.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (!isLoading) {
                                e.target.style.background = '#e53e3e';
                                e.target.style.transform = 'translateY(0)';
                            }
                        }}
                    >
                        {isLoading ? 'Removing...' : 'Unfriend'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnfriendModal;