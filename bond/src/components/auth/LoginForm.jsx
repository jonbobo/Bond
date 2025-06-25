import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

const LoginForm = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                console.log('Login successful!');
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log('Account created successfully!', userCredential.user.uid);

                // For now, just log the user info - you can add database logic later
                console.log('User data to store:', {
                    firebase_uid: userCredential.user.uid,
                    email: email,
                    username: username
                });
            }
        } catch (err) {
            console.error('Authentication error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="app-title">Bond</h1>
                <p className="app-subtitle">Connect without the clutter</p>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength="6"
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" disabled={loading} className="submit-btn">
                        {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <p className="toggle-text">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                            setEmail('');
                            setPassword('');
                            setUsername('');
                        }}
                        className="toggle-btn"
                        disabled={loading}
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LoginForm;