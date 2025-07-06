// ChatContext.jsx - OPTIMIZED: Click-to-load messages (no real-time listeners)
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import {
    subscribeToUserChats,
    sendMessage as sendMessageService,
    markChatAsRead as markChatAsReadService,
    createOrGetChat as createOrGetChatService,
    getMessagesOnce // ✅ NEW: Get messages without listener
} from '../services/chatUtils';

// Action types
const CHAT_ACTIONS = {
    SET_CHATS: 'SET_CHATS',
    SET_MESSAGES: 'SET_MESSAGES',
    SET_LOADING: 'SET_LOADING',
    SET_MESSAGES_LOADING: 'SET_MESSAGES_LOADING', // ✅ NEW: Separate loading for messages
    SET_SENDING: 'SET_SENDING',
    MARK_AS_READ: 'MARK_AS_READ',
    SET_ERROR: 'SET_ERROR',
    RESET_STATE: 'RESET_STATE'
};

// Initial state
const initialState = {
    chats: [],
    messagesByChat: {}, // { chatId: { messages: [], loading: false, lastFetch: timestamp } }
    loading: false,
    sending: {},
    error: null
};

// Reducer
const chatReducer = (state, action) => {
    switch (action.type) {
        case CHAT_ACTIONS.SET_CHATS:
            return {
                ...state,
                chats: action.payload,
                loading: false
            };

        case CHAT_ACTIONS.SET_MESSAGES:
            return {
                ...state,
                messagesByChat: {
                    ...state.messagesByChat,
                    [action.payload.chatId]: {
                        messages: action.payload.messages,
                        loading: false,
                        lastFetch: Date.now()
                    }
                }
            };

        case CHAT_ACTIONS.SET_MESSAGES_LOADING:
            return {
                ...state,
                messagesByChat: {
                    ...state.messagesByChat,
                    [action.payload.chatId]: {
                        ...(state.messagesByChat[action.payload.chatId] || { messages: [] }),
                        loading: action.payload.loading
                    }
                }
            };

        case CHAT_ACTIONS.SET_LOADING:
            return {
                ...state,
                loading: action.payload
            };

        case CHAT_ACTIONS.SET_SENDING:
            return {
                ...state,
                sending: {
                    ...state.sending,
                    [action.payload.chatId]: action.payload.sending
                }
            };

        case CHAT_ACTIONS.MARK_AS_READ:
            return {
                ...state,
                chats: state.chats.map(chat =>
                    chat.id === action.payload
                        ? { ...chat, unreadCount: 0 }
                        : chat
                )
            };

        case CHAT_ACTIONS.SET_ERROR:
            return {
                ...state,
                error: action.payload,
                loading: false
            };

        case CHAT_ACTIONS.RESET_STATE:
            return initialState;

        default:
            return state;
    }
};

// Create contexts
const ChatStateContext = createContext();
const ChatDispatchContext = createContext();

// Provider component
export const ChatProvider = ({ children }) => {
    const [user] = useAuthState(auth);
    const [state, dispatch] = useReducer(chatReducer, initialState);
    const chatUnsubscribe = React.useRef(null);

    // Reset state when user logs out
    useEffect(() => {
        if (!user) {
            console.log('🧹 User logged out, cleaning up chat state');
            dispatch({ type: CHAT_ACTIONS.RESET_STATE });

            if (chatUnsubscribe.current) {
                try {
                    chatUnsubscribe.current();
                } catch (error) {
                    console.error('Error cleaning up chat listener:', error);
                }
                chatUnsubscribe.current = null;
            }
        }
    }, [user]);

    // ✅ OPTIMIZED: Only chat list listener (no message listeners)
    useEffect(() => {
        if (!user) return;

        console.log('🔄 Setting up chat list listener for user:', user.uid);
        dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: true });

        try {
            const unsubscribe = subscribeToUserChats(user.uid, (chats) => {
                console.log('📝 Chats updated:', chats.length);

                const validChats = chats.filter(chat =>
                    chat && chat.id && chat.otherParticipant
                ).map(chat => ({
                    ...chat,
                    otherParticipant: chat.otherParticipant || {
                        id: 'unknown',
                        username: 'unknown',
                        displayName: 'Unknown User',
                        profilePicture: null
                    },
                    unreadCount: typeof chat.unreadCount === 'number' ? chat.unreadCount : 0,
                    lastMessage: chat.lastMessage || '',
                    lastMessageAt: chat.lastMessageAt || null
                }));

                dispatch({ type: CHAT_ACTIONS.SET_CHATS, payload: validChats });
            });

            chatUnsubscribe.current = unsubscribe;

            return () => {
                if (unsubscribe) {
                    console.log('🧹 Cleaning up chat list listener');
                    try {
                        unsubscribe();
                    } catch (error) {
                        console.error('Error cleaning up chat listener:', error);
                    }
                }
            };
        } catch (error) {
            console.error('❌ Error setting up chat listener:', error);
            dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: 'Failed to connect to chat service' });
            dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: false });
        }
    }, [user]);

    // Provide state and dispatch
    const contextValue = {
        state,
        dispatch
    };

    return (
        <ChatStateContext.Provider value={state}>
            <ChatDispatchContext.Provider value={contextValue}>
                {children}
            </ChatDispatchContext.Provider>
        </ChatStateContext.Provider>
    );
};

// Hook to use chat state
export const useChatState = () => {
    const context = useContext(ChatStateContext);
    if (!context) {
        throw new Error('useChatState must be used within a ChatProvider');
    }
    return context;
};

// Hook to use chat actions
export const useChatActions = () => {
    const { dispatch } = useContext(ChatDispatchContext);
    const [user] = useAuthState(auth);

    if (!dispatch) {
        throw new Error('useChatActions must be used within a ChatProvider');
    }

    // ✅ NEW: Load messages on demand (no real-time listener)
    const loadMessages = async (chatId, forceRefresh = false) => {
        if (!chatId) return;

        try {
            dispatch({
                type: CHAT_ACTIONS.SET_MESSAGES_LOADING,
                payload: { chatId, loading: true }
            });

            console.log('📥 Loading messages for chat:', chatId);
            const messages = await getMessagesOnce(chatId, 50);

            const safeMessages = messages.map(message => ({
                id: message.id || `temp_${Date.now()}`,
                chatId: message.chatId || chatId,
                senderId: message.senderId || 'unknown',
                sender: message.sender || {
                    id: message.senderId || 'unknown',
                    username: 'unknown',
                    displayName: 'Unknown User',
                    profilePicture: null
                },
                content: message.content || '',
                createdAt: message.createdAt || new Date(),
                type: message.type || 'text'
            }));

            dispatch({
                type: CHAT_ACTIONS.SET_MESSAGES,
                payload: { chatId, messages: safeMessages }
            });

            console.log(`✅ Loaded ${safeMessages.length} messages for chat: ${chatId}`);
        } catch (error) {
            console.error('❌ Error loading messages:', error);
            dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: 'Failed to load messages' });
            dispatch({
                type: CHAT_ACTIONS.SET_MESSAGES_LOADING,
                payload: { chatId, loading: false }
            });
        }
    };

    // ✅ OPTIMIZED: Send message + refresh messages once
    const sendMessage = async (chatId, content) => {
        if (!user || !chatId || !content.trim()) {
            throw new Error('Invalid message parameters');
        }

        dispatch({
            type: CHAT_ACTIONS.SET_SENDING,
            payload: { chatId, sending: true }
        });

        try {
            console.log('📤 Sending message:', { chatId, content: content.trim() });
            await sendMessageService(chatId, content.trim());

            // ✅ Refresh messages after sending (to see the new message)
            setTimeout(() => {
                loadMessages(chatId, true);
            }, 500);

            console.log('✅ Message sent successfully');
        } catch (error) {
            console.error('❌ Error sending message:', error);
            dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: 'Failed to send message' });
            throw error;
        } finally {
            dispatch({
                type: CHAT_ACTIONS.SET_SENDING,
                payload: { chatId, sending: false }
            });
        }
    };

    // Mark as read with error handling
    const markAsRead = async (chatId) => {
        if (!chatId) return;

        try {
            await markChatAsReadService(chatId);
            dispatch({ type: CHAT_ACTIONS.MARK_AS_READ, payload: chatId });
        } catch (error) {
            console.error('❌ Error marking chat as read (non-critical):', error);
        }
    };

    // Create or get chat with error handling
    const createOrGetChat = async (participantId) => {
        if (!participantId) {
            throw new Error('Participant ID is required');
        }

        try {
            console.log('🆕 Creating/getting chat for participant:', participantId);
            const result = await createOrGetChatService(participantId);
            console.log('✅ Chat created/retrieved:', result.chatId);
            return result;
        } catch (error) {
            console.error('❌ Error creating/getting chat:', error);
            dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: 'Failed to start conversation' });
            throw error;
        }
    };

    // Clear error
    const clearError = () => {
        dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: null });
    };

    return {
        loadMessages, // ✅ NEW: Load messages on demand
        sendMessage,
        markAsRead,
        createOrGetChat,
        clearError
    };
};

// ✅ SIMPLIFIED: Hook to get messages (no auto-subscription)
export const useChatMessages = (chatId) => {
    const { messagesByChat, sending } = useChatState();

    const chatData = messagesByChat[chatId] || {
        messages: [],
        loading: false,
        lastFetch: null
    };

    return {
        messages: chatData.messages,
        loading: chatData.loading,
        sending: sending[chatId] || false,
        lastFetch: chatData.lastFetch
    };
};

// Hook to find chat by participant
export const useFindChatByParticipant = () => {
    const { chats } = useChatState();

    const findChatByParticipant = (participantId) => {
        try {
            if (!participantId || !Array.isArray(chats)) {
                return null;
            }

            return chats.find(chat => {
                try {
                    return chat &&
                        chat.otherParticipant &&
                        chat.otherParticipant.id === participantId;
                } catch (error) {
                    console.error('❌ Error checking chat participant:', error);
                    return false;
                }
            });
        } catch (error) {
            console.error('❌ Error finding chat by participant:', error);
            return null;
        }
    };

    return { findChatByParticipant, chats };
};