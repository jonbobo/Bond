import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { getCurrentUserProfile, signOut } from '../services/authUtils'; // ✅ FIXED: Import signOut from authUtils
import NotificationIcon from '../icons/NotificationIcon';

const Header = () => {
    const [user] = useAuthState(auth);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [isSigningOut, setIsSigningOut] = useState(false); // ✅ NEW: Track signing out state

    useEffect(() => {
        const loadUserProfile = async () => {
            if (user) {
                try {
                    const profile = await getCurrentUserProfile();
                    setUserProfile(profile);
                } catch (error) {
                    console.error('Error loading user profile:', error);
                }
            }
        };
        loadUserProfile();
    }, [user]);

    // ✅ FIXED: Use the proper signOut function from authUtils
    const handleSignOut = async () => {
        if (isSigningOut) return; // Prevent double-clicking

        try {
            setIsSigningOut(true);
            console.log('🚪 Header: Starting sign out process...');

            // ✅ This will now properly:
            // - Set user offline in Realtime Database
            // - Cancel disconnect handlers
            // - Clean up presence system
            // - Sign out from Firebase Auth
            await signOut();

            console.log('✅ Header: Sign out completed');
            setShowProfileMenu(false); // Close dropdown
        } catch (error) {
            console.error('❌ Header: Sign out error:', error);
            // Optionally show user-friendly error message
            alert('Error signing out. Please try again.');
        } finally {
            setIsSigningOut(false);
        }
    };

    const toggleProfileMenu = () => {
        setShowProfileMenu(!showProfileMenu);
    };

    const getDisplayName = () => {
        if (userProfile?.displayName) {
            return userProfile.displayName;
        }
        if (userProfile?.username) {
            return userProfile.username;
        }
        if (user?.email) {
            return user.email.split('@')[0];
        }
        return 'User';
    };

    const getAvatarInitials = () => {
        const displayName = getDisplayName();
        return displayName.charAt(0).toUpperCase();
    };

    return (
        <header className="header">
            <div className="header-container">
                {/* Logo/Brand */}
                <div className="header-brand">
                    <h1 className="brand-title">Bond</h1>
                    <span className="brand-tagline">Connect without clutter</span>
                </div>

                {/* Search Bar */}
                <div className="header-search">
                    <input
                        type="text"
                        placeholder="Search Bond..."
                        className="search-input"
                    />
                </div>

                {/* User Menu */}
                <div className="header-user">
                    {/* Notification Icon - positioned before profile */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        position: 'relative'
                    }}>
                        <NotificationIcon />

                        <div className="user-profile" onClick={toggleProfileMenu}>
                            <div className="user-avatar">
                                {getAvatarInitials()}
                            </div>
                            <span className="user-name">
                                {getDisplayName()}
                            </span>
                            <svg
                                className={`dropdown-icon ${showProfileMenu ? 'open' : ''}`}
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <polyline points="6,9 12,15 18,9"></polyline>
                            </svg>
                        </div>
                    </div>

                    {/* Profile Dropdown */}
                    {showProfileMenu && (
                        <div className="profile-dropdown">
                            <div className="dropdown-header">
                                <div className="user-info">
                                    <div className="user-avatar large">
                                        {getAvatarInitials()}
                                    </div>
                                    <div className="user-details">
                                        <p className="user-email">{getDisplayName()}</p>
                                        <p className="user-id">Email: {user?.email}</p>
                                        <p className="user-id">ID: {user?.uid?.slice(0, 8)}...</p>
                                    </div>
                                </div>
                            </div>
                            <div className="dropdown-menu">
                                <button className="dropdown-item">
                                    Profile Settings
                                </button>
                                <button className="dropdown-item">
                                    Privacy Settings
                                </button>
                                <button className="dropdown-item">
                                    Help & Support
                                </button>
                                <hr className="dropdown-divider" />
                                <button
                                    className="dropdown-item signout"
                                    onClick={handleSignOut}
                                    disabled={isSigningOut} // ✅ NEW: Prevent double-clicking
                                >
                                    {/* ✅ NEW: Show loading state */}
                                    {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;