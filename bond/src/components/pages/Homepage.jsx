import React from 'react';
import './HomePage.css';

const HomePage = () => {
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
                        Profile image
                    </div>
                    <input
                        type="text"
                        placeholder="What's on your mind?"
                        className="composer-input"
                    />
                </div>
                <div className="composer-actions">
                    <button className="composer-btn">Share</button>
                </div>
            </div>

            {/* Feed */}
            <div className="feed">
                <div className="feed-header">
                    <h2>Recent Posts</h2>
                    <select className="feed-filter">
                        <option>Recent</option>
                        <option>Friends</option>
                        <option>Popular</option>
                    </select>
                </div>

                {/* Posts will be loaded dynamically here */}

                {/* Empty State */}
                <div className="feed-empty">
                    <p>No posts yet. Be the first to share something!</p>
                </div>
            </div>
        </div>
    );
};

export default HomePage;