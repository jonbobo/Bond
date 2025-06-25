import React, { useState } from 'react';
import { registerUser, loginUser, resetPassword } from '../services/authUtils';
import './LoginForm.css';

const LoginForm = () => {
    const [currentView, setCurrentView] = useState('login'); // 'login', 'register', 'forgot'
    const [formData, setFormData] = useState({
        emailOrUsername: '',
        email: '',
        password: '',
        username: '',
        rememberMe: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            if (currentView === 'login') {
                await loginUser(formData.emailOrUsername, formData.password, formData.rememberMe);
                console.log('Login successful!');
            } else if (currentView === 'register') {
                await registerUser(formData.email, formData.password, formData.username, formData.rememberMe);
                setMessage('Account created successfully! You are now logged in.');
                console.log('Registration successful!');
            } else if (currentView === 'forgot') {
                await resetPassword(formData.emailOrUsername);
                setMessage('Password reset email sent! Check your inbox.');
                console.log('Password reset email sent');
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
        setFormData({
            emailOrUsername: '',
            email: '',
            password: '',
            username: '',
            rememberMe: false
        });
    };

    const getPasswordStrength = (password) => {
        if (password.length === 0) return { strength: 0, text: '' };

        let score = 0;
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[@$!%*?&]/.test(password)
        };

        score = Object.values(checks).filter(Boolean).length;

        if (score < 3) return { strength: 1, text: 'Weak', color: '#ff6b6b' };
        if (score < 5) return { strength: 2, text: 'Medium', color: '#ffd93d' };
        return { strength: 3, text: 'Strong', color: '#6bcf7f' };
    };

    const passwordStrength = currentView === 'register' ? getPasswordStrength(formData.password) : null;

    return (
        <div className="login-page-wrapper">
            <div className="login-container">
                <form onSubmit={handleSubmit}>
                    <h1 id={currentView === 'login' ? "login-page" : currentView === 'register' ? "signup-page" : "forgot-password"}>
                        {currentView === 'login' ? 'Bond' :
                            currentView === 'register' ? 'Join Bond' :
                                'Reset Password'}
                    </h1>

                    {/* Email or Username field for login/forgot */}
                    {(currentView === 'login' || currentView === 'forgot') && (
                        <div className="input-box">
                            <input
                                type="text"
                                name="emailOrUsername"
                                placeholder={currentView === 'forgot' ? "Email or Username" : "Email or Username"}
                                value={formData.emailOrUsername}
                                onChange={handleInputChange}
                                required
                                disabled={loading}
                            />
                            <i className="bx bxs-user"></i>
                        </div>
                    )}

                    {/* Email field for registration */}
                    {currentView === 'register' && (
                        <div className="input-box">
                            <input
                                type="email"
                                name="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                                disabled={loading}
                            />
                            <i className="bx bxs-envelope"></i>
                        </div>
                    )}

                    {/* Username field for registration */}
                    {currentView === 'register' && (
                        <div className="input-box">
                            <input
                                type="text"
                                name="username"
                                placeholder="Username (3-20 characters)"
                                value={formData.username}
                                onChange={handleInputChange}
                                required
                                disabled={loading}
                                pattern="[a-zA-Z0-9_]{3,20}"
                                title="Username must be 3-20 characters long and contain only letters, numbers, and underscores"
                            />
                            <i className="bx bxs-user"></i>
                        </div>
                    )}

                    {/* Password field for login/register */}
                    {(currentView === 'login' || currentView === 'register') && (
                        <div className="input-box">
                            <input
                                type="password"
                                name="password"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleInputChange}
                                required
                                minLength={currentView === 'register' ? "8" : "1"}
                                disabled={loading}
                            />
                            <i className="bx bxs-lock-alt"></i>
                        </div>
                    )}

                    {/* Password strength indicator */}
                    {currentView === 'register' && formData.password && (
                        <div className="password-strength">
                            <div className="strength-bar">
                                <div
                                    className="strength-fill"
                                    style={{
                                        width: `${(passwordStrength.strength / 3) * 100}%`,
                                        backgroundColor: passwordStrength.color
                                    }}
                                ></div>
                            </div>
                            <span style={{ color: passwordStrength.color, fontSize: '12px' }}>
                                {passwordStrength.text}
                            </span>
                        </div>
                    )}

                    {/* Remember me and forgot password */}
                    {currentView === 'login' && (
                        <div className="remember-forgot">
                            <label>
                                <input
                                    type="checkbox"
                                    name="rememberMe"
                                    checked={formData.rememberMe}
                                    onChange={handleInputChange}
                                /> Remember me
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

                    {/* Remember me for registration */}
                    {currentView === 'register' && (
                        <div className="remember-forgot">
                            <label>
                                <input
                                    type="checkbox"
                                    name="rememberMe"
                                    checked={formData.rememberMe}
                                    onChange={handleInputChange}
                                /> Keep me logged in
                            </label>
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {/* Success message */}
                    {message && (
                        <div className="success-message">
                            {message}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="btn">
                        {loading ? 'Loading...' :
                            currentView === 'login' ? 'Login' :
                                currentView === 'register' ? 'Create Account' :
                                    'Send Reset Email'}
                    </button>

                    <div className="register-link">
                        <p>
                            {currentView === 'login' ? (
                                <>
                                    Don't have an account?
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
                                    Already have an account?
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
                                    Remember your password?
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