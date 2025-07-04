import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChatProvider } from './components/contexts/ChatContext';
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import HomePage from './components/pages/HomePage';
import MessagesPage from './components/pages/MessagesPage';
import ConnectionsPage from './components/pages/ConnectionsPage';
import ContactsSidebar from './components/common/ContactsSidebar';
import ChatManager from './components/chat/ChatManager';

function App() {
    // ✅ Log optimization status on app start (development only)
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('🔥 FIRESTORE OPTIMIZATIONS ACTIVE:');
            console.log('✅ Online status: 5min heartbeat (was 30s)');
            console.log('✅ Core functionality: RESTORED');
            console.log('📊 Expected: ~90% reduction in online status writes');
        }
    }, []);

    return (
        <Router>
            <ChatProvider>
                <div className="app">
                    <Header />

                    <div className="app-content">
                        <Sidebar />

                        <main className="main-content">
                            <Routes>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/messages" element={<MessagesPage />} />
                                <Route path="/connections" element={<ConnectionsPage />} />
                            </Routes>
                        </main>

                        <ContactsSidebar />
                    </div>

                    <ChatManager />
                </div>
            </ChatProvider>
        </Router>
    );
}

export default App;