import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './components/services/firebase';
import LoginForm from './components/auth/LoginForm';

// ✅ CRITICAL: Import presence system to initialize it
import './components/services/presenceUtils';

// Context Providers
import { ChatProvider } from './components/contexts/ChatContext';

// Layout Components
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import ContactsSidebar from './components/common/ContactsSidebar';

// Page Components
import HomePage from './components/pages/HomePage';
import MessagesPage from './components/pages/MessagesPage';
import ConnectionsPage from './components/pages/ConnectionsPage';

// Chat Components
import ChatManager from './components/chat/ChatManager';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const [user, loading] = useAuthState(auth);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return user ? children : <Navigate to="/login" />;
};

// Public Route Component (redirect if already logged in)
const PublicRoute = ({ children }) => {
    const [user, loading] = useAuthState(auth);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return user ? <Navigate to="/" /> : children;
};

// Main Layout Component - Now wrapped with ChatProvider
const MainLayout = ({ children }) => {
    return (
        <ChatProvider>
            <div className="app-layout">
                <Header />
                <div className="app-content">
                    <Sidebar />
                    <main className="main-content">
                        {children}
                    </main>
                    <ContactsSidebar />
                </div>
                <ChatManager />
            </div>
        </ChatProvider>
    );
};

function App() {
    return (
        <Router>
            <div className="App">
                <Routes>
                    {/* Public Routes */}
                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                <LoginForm />
                            </PublicRoute>
                        }
                    />

                    {/* Protected Routes - ChatProvider now wraps the entire MainLayout */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <MainLayout>
                                    <HomePage />
                                </MainLayout>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/messages"
                        element={
                            <ProtectedRoute>
                                <MainLayout>
                                    <MessagesPage />
                                </MainLayout>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/connections"
                        element={
                            <ProtectedRoute>
                                <MainLayout>
                                    <ConnectionsPage />
                                </MainLayout>
                            </ProtectedRoute>
                        }
                    />

                    {/* Redirect any unknown routes to home */}
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;