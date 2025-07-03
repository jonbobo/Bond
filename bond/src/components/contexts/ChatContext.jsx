// contexts/ChatContext.jsx
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import {
    subscribeToUserChats,
    subscribeToMessages,
    sendMessage as sendMessageService,
    markChatAsRead as markChatAsReadService,
    createOrGetChat as createOrGetChatService
} from '../services/chatUtils';

// Action types
const CHAT_ACTIONS = {
    SET_CHATS: 'SET_CHATS',
    SET_MESSAGES: 'SET_MESSAGES',
    SET_LOADING: 'SET_LOADING',
    SET_SENDING: 'SET_SENDING',
    MARK_AS_READ: 'MARK_AS_READ',
    SET_ERROR: 'SET_ERROR',
    RESET_STATE: 'RESET_STATE'
};

// Initial state
const initialState = {
    chats: [],
    messagesByChat: {}, // { chatId: messages[] }
    loading: false,
    sending: {},  // { chatId: boolean }
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
                    [action.payload.chatId]: action.payload.messages
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
                error: action.payload
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
    const messageListeners = useRef(new Map()); // Track message listeners
    const chatUnsubscribe = useRef(null);

    // Reset state when user logs out
    useEffect(() => {
        if (!user) {
            console.log('🧹 User logged out, cleaning up chat state');
            dispatch({ type: CHAT_ACTIONS.RESET_STATE });

            // Cleanup all listeners
            messageListeners.current.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            messageListeners.current.clear();

            if (chatUnsubscribe.current) {
                chatUnsubscribe.current();
                chatUnsubscribe.current = null;
            }
        }
    }, [user]);

    // Set up chat list listener
    useEffect(() => {
        if (!user) return;

        console.log('🔄 Setting up chat list listener for user:', user.uid);
        dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: true });

        const unsubscribe = subscribeToUserChats(user.uid, (chats) => {
            console.log('📝 Chats updated via context:', chats.length);
            dispatch({ type: CHAT_ACTIONS.SET_CHATS, payload: chats });
        });

        chatUnsubscribe.current = unsubscribe;

        return () => {
            if (unsubscribe) {
                console.log('🧹 Cleaning up chat list listener');
                unsubscribe();
            }
        };
    }, [user]);

    // Provide state and dispatch
    const contextValue = {
        state,
        dispatch,
        messageListeners: messageListeners.current
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
    const { dispatch, messageListeners } = useContext(ChatDispatchContext);
    const [user] = useAuthState(auth);

    if (!dispatch) {
        throw new Error('useChatActions must be used within a ChatProvider');
    }

    // Subscribe to messages for a specific chat
    const subscribeToMessagesForChat = (chatId) => {
        if (!chatId || messageListeners.has(chatId)) {
            console.log('🔄 Already subscribed to chat or invalid chatId:', chatId);
            return;
        }

        console.log('🔄 Setting up message listener for chat:', chatId);

        const unsubscribe = subscribeToMessages(chatId, (messages) => {
            console.log('📝 Messages updated for chat:', chatId, messages.length);
            dispatch({
                type: CHAT_ACTIONS.SET_MESSAGES,
                payload: { chatId, messages }
            });
        });

        messageListeners.set(chatId, unsubscribe);
    };

    // Unsubscribe from messages for a specific chat
    const unsubscribeFromMessages = (chatId) => {
        const unsubscribe = messageListeners.get(chatId);
        if (unsubscribe) {
            console.log('🧹 Cleaning up message listener for chat:', chatId);
            unsubscribe();
            messageListeners.delete(chatId);
        }
    };

    // Send message
    const sendMessage = async (chatId, content) => {
        if (!user || !chatId || !content.trim()) {
            throw new Error('Invalid message parameters');
        }

        dispatch({
            type: CHAT_ACTIONS.SET_SENDING,
            payload: { chatId, sending: true }
        });

        try {
            console.log('📤 Sending message via context:', { chatId, content: content.trim() });
            await sendMessageService(chatId, content.trim());
            console.log('✅ Message sent successfully');
        } catch (error) {
            console.error('❌ Error sending message:', error);
            dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: error.message });
            throw error;
        } finally {
            dispatch({
                type: CHAT_ACTIONS.SET_SENDING,
                payload: { chatId, sending: false }
            });
        }
    };

    // Mark chat as read
    const markAsRead = async (chatId) => {
        if (!chatId) return;

        try {
            console.log('✅ Marking chat as read:', chatId);
            await markChatAsReadService(chatId);
            dispatch({ type: CHAT_ACTIONS.MARK_AS_READ, payload: chatId });
        } catch (error) {
            console.error('❌ Error marking chat as read:', error);
            dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: error.message });
        }
    };

    // Create or get chat
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
            dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: error.message });
            throw error;
        }
    };

    // Clear error
    const clearError = () => {
        dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: null });
    };

    return {
        subscribeToMessagesForChat,
        unsubscribeFromMessages,
        sendMessage,
        markAsRead,
        createOrGetChat,
        clearError
    };
};

// Hook to get messages for a specific chat
export const useChatMessages = (chatId) => {
    const { messagesByChat, sending } = useChatState();
    const { subscribeToMessagesForChat, unsubscribeFromMessages } = useChatActions();

    useEffect(() => {
        if (!chatId) return;

        subscribeToMessagesForChat(chatId);

        // Cleanup on unmount or chat change
        return () => {
            // Delay cleanup to allow for quick navigation between components
            const timeoutId = setTimeout(() => {
                unsubscribeFromMessages(chatId);
            }, 5000);

            // Return cleanup function
            return () => clearTimeout(timeoutId);
        };
    }, [chatId, subscribeToMessagesForChat, unsubscribeFromMessages]);

    return {
        messages: messagesByChat[chatId] || [],
        sending: sending[chatId] || false
    };
};

// Hook to find chat by participant
export const useFindChatByParticipant = () => {
    const { chats } = useChatState();

    const findChatByParticipant = (participantId) => {
        return chats.find(chat =>
            chat.otherParticipant?.id === participantId
        );
    };

    return { findChatByParticipant, chats };
};