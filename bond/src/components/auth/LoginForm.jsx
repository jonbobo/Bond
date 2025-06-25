import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import './LoginForm.css'; // Import your custom CSS

const LoginForm = () => {
    const [currentView, setCurrentView] = useState('login'); // 'login', 'register', 'forgot'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            if (currentView === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
                console.log('Login successful!');
            } else if (currentView === 'register') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log('Account created successfully!', userCredential.user.uid);

                // For now, just log the user info - you can add database logic later
                console.log('User data to store:', {
                    firebase_uid: userCredential.user.uid,
                    email: email,
                    username: username
                });
            } else if (currentView === 'forgot') {
                await sendPasswordResetEmail(auth, email);
                setMessage('Password reset email sent! Check your inbox.');
                console.log('Password reset email sent to:', email);
            }
        } catch (err) {
            console.error('Authentication error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const switchView = (view) => {
        setCurrentView(view);
        setError('');
        setMessage('');
        setEmail('');
        setPassword('');
        setUsername('');
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-container">
                <form onSubmit={handleSubmit}>
                    <h1 id={currentView === 'login' ? "login-page" : currentView === 'register' ? "signup-page" : "forgot-password"}>
                        {currentView === 'login' ? 'Bond' :
                            currentView === 'register' ? 'Join Bond' :
                                'Reset Password'}
                    </h1>

                    <div className="input-box">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                        <i className="bx bxs-user"></i>
                    </div>

                    {currentView === 'register' && (
                        <div className="input-box">
                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <i className="bx bxs-user"></i>
                        </div>
                    )}

                    {(currentView === 'login' || currentView === 'register') && (
                        <div className="input-box">
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength="6"
                                disabled={loading}
                            />
                            <i className="bx bxs-lock-alt"></i>
                        </div>
                    )}

                    {currentView === 'login' && (
                        <div className="remember-forgot">
                            <label>
                                <input type="checkbox" /> Remember me
                            </label>
                            <button
                                type="button"
                                className="link-button"
                                onClick={() => switchView('forgot')}
                                disabled={loading}
                            >
                                Forgot Password?
                            </button>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            color: '#ff6b6b',
                            textAlign: 'center',
                            margin: '15px 0',
                            background: 'rgba(255, 107, 107, 0.1)',
                            padding: '10px',
                            borderRadius: '5px',
                            border: '1px solid rgba(255, 107, 107, 0.3)'
                        }}>
                            {error}
                        </div>
                    )}

                    {message && (
                        <div style={{
                            color: '#48bb78',
                            textAlign: 'center',
                            margin: '15px 0',
                            background: 'rgba(72, 187, 120, 0.1)',
                            padding: '10px',
                            borderRadius: '5px',
                            border: '1px solid rgba(72, 187, 120, 0.3)'
                        }}>
                            {message}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="btn">
                        {loading ? 'Loading...' :
                            currentView === 'login' ? 'Login' :
                                currentView === 'register' ? 'Sign Up' :
                                    'Send Reset Email'}
                    </button>

                    <div className="register-link">
                        <p>
                            {currentView === 'login' ? (
                                <>
                                    Don't have an account?{' '}
                                    <button
                                        type="button"
                                        className="link-button"
                                        onClick={() => switchView('register')}
                                        disabled={loading}
                                    >
                                        Register
                                    </button>
                                </>
                            ) : currentView === 'register' ? (
                                <>
                                    Already have an account?{' '}
                                    <button
                                        type="button"
                                        className="link-button"
                                        onClick={() => switchView('login')}
                                        disabled={loading}
                                    >
                                        Login
                                    </button>
                                </>
                            ) : (
                                <>
                                    Remember your password?{' '}
                                    <button
                                        type="button"
                                        className="link-button"
                                        onClick={() => switchView('login')}
                                        disabled={loading}
                                    >
                                        Back to Login
                                    </button>
                                </>
                            )}
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;