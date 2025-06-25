import React from 'react';
import { Link, useLocation } from 'react-router-dom';


const Sidebar = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
                <ul className="nav-list">
                    <li className="nav-item">
                        <Link
                            to="/"
                            className={`nav-link ${isActive('/') ? 'active' : ''}`}
                        >
                            <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                <polyline points="9,22 9,12 15,12 15,22"></polyline>
                            </svg>
                            <span className="nav-text">Home</span>
                        </Link>
                    </li>

                    <li className="nav-item">
                        <Link
                            to="/messages"
                            className={`nav-link ${isActive('/messages') ? 'active' : ''}`}
                        >
                            <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                            </svg>
                            <span className="nav-text">Messages</span>
                        </Link>
                    </li>

                    <li className="nav-item">
                        <Link
                            to="/connections"
                            className={`nav-link ${isActive('/connections') ? 'active' : ''}`}
                        >
                            <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="m22 21-3-3m0 0a5 5 0 1 0-7-7 5 5 0 0 0 7 7z"></path>
                            </svg>
                            <span className="nav-text">Connections</span>
                        </Link>
                    </li>
                </ul>

                {/* Secondary Actions */}
                <div className="sidebar-actions">
                    <button className="action-btn primary">
                        <svg className="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New Post
                    </button>
                </div>

                {/* Privacy Notice */}
                <div className="sidebar-footer">
                    <div className="privacy-badge">
                        <svg className="privacy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <circle cx="12" cy="16" r="1"></circle>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <span>Privacy First</span>
                    </div>
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;