import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import './LoginForm.css'; // Import your custom CSS

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
        <div className="login-page-wrapper">
            <div className="login-container">
                <form onSubmit={handleSubmit}>
                    <h1 id={isLogin ? "login-page" : "signup-page"}>
                        {isLogin ? 'Bond' : 'Join Bond'}
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

                    {!isLogin && (
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

                    {isLogin && (
                        <div className="remember-forgot">
                            <label>
                                <input type="checkbox" /> Remember me
                            </label>
                            <a href="#forgot">Forgot Password?</a>
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

                    <button type="submit" disabled={loading} className="btn">
                        {loading ? 'Loading...' : (isLogin ? 'Login' : 'Sign Up')}
                    </button>

                    <div className="register-link">
                        <p>
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <button
                                type="button"
                                className="link-button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                    setEmail('');
                                    setPassword('');
                                    setUsername('');
                                }}
                            >
                                {isLogin ? 'Register' : 'Login'}
                            </button>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;