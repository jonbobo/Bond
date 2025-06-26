import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import './HomePage.css';

const HomePage = () => {
    const { user } = useUser();
    const [postInput, setPostInput] = useState('');
    const [posts, setPosts] = useState(() => {
        const saved = localStorage.getItem('bond_posts');
        return saved ? JSON.parse(saved) : [];
    });
    const [commentInputs, setCommentInputs] = useState({});
    const [activeCommentBox, setActiveCommentBox] = useState(null); // Track which comment box is open

    useEffect(() => {
        localStorage.setItem('bond_posts', JSON.stringify(posts));
    }, [posts]);

    const handleInputChange = (e) => {
        setPostInput(e.target.value);
    };

    const handleShare = () => {
        if (postInput.trim() === '') return;
        const newPost = {
            id: Date.now(),
            content: postInput,
            author: user?.username || 'You',
            timestamp: new Date().toLocaleString(),
            likes: 0,
            dislikes: 0,
            comments: [],
        };
        setPosts([newPost, ...posts]);
        setPostInput('');
    };

    const handleLike = (id) => {
        setPosts(posts =>
            posts.map(post =>
                post.id === id ? { ...post, likes: post.likes + 1 } : post
            )
        );
    };

    const handleDislike = (id) => {
        setPosts(posts =>
            posts.map(post =>
                post.id === id ? { ...post, dislikes: post.dislikes + 1 } : post
            )
        );
    };

    const handleAddComment = (id, comment) => {
        setPosts(posts =>
            posts.map(post =>
                post.id === id
                    ? { ...post, comments: [...post.comments, comment] }
                    : post
            )
        );
    };

    const handleSharePost = (id) => {
        alert('Share functionality coming soon!');
    };

    const handleCommentInputChange = (id, value) => {
        setCommentInputs(inputs => ({ ...inputs, [id]: value }));
    };

    const handleCommentSubmit = (id) => {
        const comment = commentInputs[id]?.trim();
        if (comment) {
            handleAddComment(id, { author: user?.username || 'You', text: comment });
            setCommentInputs(inputs => ({ ...inputs, [id]: '' }));
        }
    };

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
                        {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <input
                        type="text"
                        placeholder="What's on your mind?"
                        className="composer-input"
                        value={postInput}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="composer-actions">
                    <button className="composer-btn" onClick={handleShare}>Share</button>
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

                {posts.length === 0 ? (
                    <div className="feed-empty">
                        <p>No posts yet. Be the first to share something!</p>
                    </div>
                ) : (
                    <div className="feed-list">
                        {posts.map(post => (
                            <div key={post.id} className="post-card">
                                <div className="post-header">
                                    <div className="post-author">
                                        <div className="user-avatar small">
                                            {typeof post.author === 'string' && post.author.length > 0
                                                ? post.author[0].toUpperCase()
                                                : 'U'}
                                        </div>
                                        <div className="author-info">
                                            <span className="author-name">{post.author}</span>
                                            <span className="post-time">{post.timestamp}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="post-content">
                                    <p>{post.content}</p>
                                </div>
                                <div className="post-actions">
                                    <button className="action-btn like" onClick={() => handleLike(post.id)}>
                                        👍 Like ({post.likes})
                                    </button>
                                    <button className="action-btn dislike" onClick={() => handleDislike(post.id)}>
                                        👎 Dislike ({post.dislikes})
                                    </button>
                                    <button
                                        className="action-btn comment"
                                        onClick={() => setActiveCommentBox(activeCommentBox === post.id ? null : post.id)}
                                    >
                                        💬 Comment
                                    </button>
                                    <button className="action-btn share" onClick={() => handleSharePost(post.id)}>
                                        🔗 Share
                                    </button>
                                </div>
                                {/* Show comment input only if this post's comment box is active */}
                                {activeCommentBox === post.id && (
                                    <div className="post-comments">
                                        <input
                                            type="text"
                                            className="composer-input"
                                            placeholder="Add a comment..."
                                            value={commentInputs[post.id] || ''}
                                            onChange={e => handleCommentInputChange(post.id, e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleCommentSubmit(post.id);
                                            }}
                                        />
                                        <button
                                            className="composer-btn"
                                            style={{ marginLeft: 8 }}
                                            onClick={() => handleCommentSubmit(post.id)}
                                        >
                                            Post
                                        </button>
                                        <div className="comments-list">
                                            {post.comments.map((c, idx) => (
                                                <div key={idx} className="comment">
                                                    <span className="author-name">{c.author}:</span> {c.text}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePage;