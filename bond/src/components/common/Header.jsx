import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';


const Header = () => {
    const [user] = useAuthState(auth);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const handleSignOut = async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    const toggleProfileMenu = () => {
        setShowProfileMenu(!showProfileMenu);
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
                    <div className="user-profile" onClick={toggleProfileMenu}>
                        <div className="user-avatar">
                            {user?.email?.charAt(0).toUpperCase() && 'default profile picture using first letter of email'}
                        </div>
                        <span className="user-name">
                            {user?.email?.split('@')[0] || 'User'}
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

                    {/* Profile Dropdown */}
                    {showProfileMenu && (
                        <div className="profile-dropdown">
                            <div className="dropdown-header">
                                <div className="user-info">
                                    <div className="user-avatar large">
                                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div className="user-details">
                                        <p className="user-email">{user?.email}</p>
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
                                >
                                    Sign Out
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