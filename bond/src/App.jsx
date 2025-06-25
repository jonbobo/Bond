import React from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './components/services/firebase';
import LoginForm from './components/Auth/LoginForm';

function App() {
    const [user, loading, error] = useAuthState(auth);

    // Show loading spinner while checking auth state
    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Show error if there's an auth error
    if (error) {
        return (
            <div className="error-container">
                <p>Error: {error.message}</p>
                <button onClick={() => window.location.reload()}>
                    Retry
                </button>
            </div>
        );
    }

    // If user is logged in, show a simple welcome message for testing
    if (user) {
        return (
            <div className="welcome-container">
                <div className="welcome-card">
                    <h1>Welcome to Bond!</h1>
                    <p>Authentication successful!</p>
                    <div className="user-info">
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>User ID:</strong> {user.uid}</p>
                        <p><strong>Account created:</strong> {user.metadata.creationTime}</p>
                    </div>
                    <button
                        onClick={() => auth.signOut()}
                        className="signout-btn"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    // If no user, show login form
    return <LoginForm />;
}

export default App;