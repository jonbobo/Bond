// components/services/chatUtils.js - OPTIMIZED VERSION
import {
    collection,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    getDocs,
    setDoc,
    writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';

// ✅ DEBOUNCED online status updates to prevent excessive writes
let statusUpdateTimeout = null;
export async function updateOnlineStatus(isOnline) {
    if (!auth.currentUser) return;

    // ✅ DEBOUNCE: Only update after 5 seconds of no new calls
    if (statusUpdateTimeout) {
        clearTimeout(statusUpdateTimeout);
    }

    statusUpdateTimeout = setTimeout(async () => {
        try {
            const userRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userRef, {
                isOnline,
                lastSeen: serverTimestamp()
            });
            console.log('✅ Online status updated (debounced)');
        } catch (error) {
            console.error("Error updating online status:", error);
        }
    }, 5000); // 5 second debounce
}

// Create or get existing chat between two users
export async function createOrGetChat(participantId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to start a chat");
    }

    const currentUserId = auth.currentUser.uid;
    console.log('🔍 Creating/getting chat:', { currentUserId, participantId });

    if (currentUserId === participantId) {
        throw new Error("You cannot chat with yourself");
    }

    try {
        // Create a consistent chat ID regardless of who initiates
        const chatId = [currentUserId, participantId].sort().join('_');
        console.log('📝 Generated chat ID:', chatId);

        // Check if chat already exists
        const chatRef = doc(db, "chats", chatId);
        console.log('🔍 Checking if chat exists...');

        const chatSnap = await getDoc(chatRef);
        console.log('📊 Chat exists:', chatSnap.exists());

        if (chatSnap.exists()) {
            console.log('✅ Returning existing chat');
            return { chatId, chatData: chatSnap.data() };
        }

        // Create new chat
        console.log('🆕 Creating new chat...');
        const chatData = {
            participants: [currentUserId, participantId],
            createdAt: serverTimestamp(),
            lastMessage: null,
            lastMessageAt: serverTimestamp(),
            unreadCount: {
                [currentUserId]: 0,
                [participantId]: 0
            }
        };

        console.log('📝 Creating chat with data:', {
            participants: chatData.participants,
            chatId
        });

        await setDoc(chatRef, chatData);
        console.log('✅ New chat created successfully:', chatId);
        return { chatId, chatData };

    } catch (error) {
        console.error("❌ Detailed error creating/getting chat:", {
            error: error,
            code: error.code,
            message: error.message,
            currentUserId,
            participantId
        });
        throw error;
    }
}

// ✅ OPTIMIZED: Send message with batch write for chat update
export async function sendMessage(chatId, content, messageType = 'text') {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to send messages");
    }

    if (!content || content.trim().length === 0) {
        throw new Error("Message content cannot be empty");
    }

    try {
        console.log('📤 Sending message:', { chatId, content: content.trim(), sender: auth.currentUser.uid });

        // Get current user data for denormalized message
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        const messageData = {
            chatId,
            senderId: auth.currentUser.uid,
            content: content.trim(),
            type: messageType,
            createdAt: serverTimestamp(),
            edited: false,
            editedAt: null,
            // ✅ DENORMALIZED: Include sender info in message
            sender: {
                id: auth.currentUser.uid,
                username: userData.username || 'Unknown',
                displayName: userData.displayName || 'Unknown User',
                profilePicture: userData.profilePicture || null
            }
        };

        // ✅ BATCH WRITE: Message creation and chat update in single transaction
        const batch = writeBatch(db);

        // Add message
        const messageRef = doc(collection(db, "messages"));
        batch.set(messageRef, messageData);

        // Update chat's last message info
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);

        if (chatSnap.exists()) {
            const chatData = chatSnap.data();
            const otherParticipant = chatData.participants.find(id => id !== auth.currentUser.uid);

            batch.update(chatRef, {
                lastMessage: content.trim(),
                lastMessageAt: serverTimestamp(),
                [`unreadCount.${otherParticipant}`]: (chatData.unreadCount?.[otherParticipant] || 0) + 1
            });
        }

        // ✅ COMMIT BATCH - Single write operation
        await batch.commit();
        console.log('✅ Message and chat update completed in batch');

        return messageRef.id;
    } catch (error) {
        console.error("❌ Error sending message:", error);
        throw error;
    }
}

// ✅ OPTIMIZED: Messages subscription without additional user queries
export function subscribeToMessages(chatId, callback, limitCount = 50) {
    if (!chatId) {
        console.error('❌ Cannot subscribe to messages: chatId is required');
        callback([]);
        return () => { };
    }

    try {
        console.log('🔄 Setting up optimized message subscription for chat:', chatId);

        const messagesQuery = query(
            collection(db, "messages"),
            where("chatId", "==", chatId),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );

        console.log('📝 Query created, setting up listener...');

        const unsubscribe = onSnapshot(
            messagesQuery,
            (querySnapshot) => {
                console.log('📝 Messages snapshot received:', {
                    empty: querySnapshot.empty,
                    size: querySnapshot.size,
                    docs: querySnapshot.docs.length
                });

                if (querySnapshot.empty) {
                    console.log('📝 No messages found for chat:', chatId);
                    callback([]);
                    return;
                }

                const messages = [];

                // ✅ NO ADDITIONAL QUERIES - sender data is denormalized in message
                querySnapshot.docs.forEach((docSnap) => {
                    const messageData = docSnap.data();
                    console.log('📝 Processing message:', {
                        id: docSnap.id,
                        senderId: messageData.senderId,
                        content: messageData.content?.substring(0, 50) + '...',
                        createdAt: messageData.createdAt
                    });

                    // ✅ Use denormalized sender data or fallback
                    const senderInfo = messageData.sender || {
                        id: messageData.senderId,
                        username: 'Unknown',
                        displayName: 'Unknown User',
                        profilePicture: null
                    };

                    messages.push({
                        id: docSnap.id,
                        ...messageData,
                        sender: senderInfo
                    });
                });

                // Sort by creation time (oldest first for display)
                messages.sort((a, b) => {
                    const aTime = a.createdAt?.toDate?.() || new Date(0);
                    const bTime = b.createdAt?.toDate?.() || new Date(0);
                    return aTime - bTime;
                });

                console.log('✅ Processed messages without additional queries:', {
                    count: messages.length,
                    firstMessage: messages[0]?.content?.substring(0, 30),
                    lastMessage: messages[messages.length - 1]?.content?.substring(0, 30)
                });

                callback(messages);
            },
            (error) => {
                console.error("❌ Error in messages listener:", error);

                if (error.code === 'failed-precondition') {
                    console.error("❌ Index missing! Create the index for messages collection:");
                    console.error("Fields: chatId (asc), createdAt (desc)");
                }

                callback([]);
            }
        );

        console.log('✅ Optimized message listener set up successfully');
        return unsubscribe;
    } catch (error) {
        console.error("❌ Error subscribing to messages:", error);
        return () => { };
    }
}

// ✅ OPTIMIZED: User chats subscription with participant data caching
const participantCache = new Map(); // Simple in-memory cache

export function subscribeToUserChats(userId, callback) {
    try {
        const chatsQuery = query(
            collection(db, "chats"),
            where("participants", "array-contains", userId),
            orderBy("lastMessageAt", "desc")
        );

        const unsubscribe = onSnapshot(
            chatsQuery,
            async (querySnapshot) => {
                const chats = [];

                // ✅ OPTIMIZED: Batch participant lookups and use caching
                const participantLookups = new Map();

                querySnapshot.docs.forEach((docSnap) => {
                    const chatData = docSnap.data();
                    const otherParticipantId = chatData.participants.find(id => id !== userId);

                    if (!participantCache.has(otherParticipantId)) {
                        participantLookups.set(otherParticipantId, null);
                    }
                });

                // Batch fetch uncached participants
                const lookupPromises = Array.from(participantLookups.keys()).map(async (participantId) => {
                    const participantDoc = await getDoc(doc(db, "users", participantId));
                    const participantData = participantDoc.exists() ? participantDoc.data() : null;

                    // Cache the result
                    participantCache.set(participantId, participantData);
                    return { participantId, participantData };
                });

                await Promise.all(lookupPromises);

                // Build chats with cached participant data
                querySnapshot.docs.forEach((docSnap) => {
                    const chatData = docSnap.data();
                    const otherParticipantId = chatData.participants.find(id => id !== userId);
                    const participantData = participantCache.get(otherParticipantId);

                    const participantInfo = participantData ? {
                        id: otherParticipantId,
                        username: participantData.username || 'Unknown',
                        displayName: participantData.displayName || 'Unknown User',
                        profilePicture: participantData.profilePicture || null
                    } : {
                        id: otherParticipantId,
                        username: 'Unknown',
                        displayName: 'Unknown User',
                        profilePicture: null
                    };

                    chats.push({
                        id: docSnap.id,
                        ...chatData,
                        otherParticipant: participantInfo,
                        unreadCount: chatData.unreadCount?.[userId] || 0
                    });
                });

                callback(chats);
            },
            (error) => {
                console.error("Error listening to chats:", error);
                callback([]);
            }
        );

        return unsubscribe;
    } catch (error) {
        console.error("Error subscribing to chats:", error);
        return () => { };
    }
}

// Mark chat as read (reset unread count)
export async function markChatAsRead(chatId) {
    if (!auth.currentUser) return;

    try {
        const chatRef = doc(db, "chats", chatId);
        await updateDoc(chatRef, {
            [`unreadCount.${auth.currentUser.uid}`]: 0
        });
    } catch (error) {
        console.error("Error marking chat as read:", error);
    }
}

// Get user's friends for contacts sidebar (with caching)
const friendsCache = new Map();

export async function getUserFriendsForChat(userId) {
    try {
        // Check cache first
        if (friendsCache.has(userId)) {
            const cached = friendsCache.get(userId);
            // Cache for 5 minutes
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
                return cached.data;
            }
        }

        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            return [];
        }

        const friendIds = userDoc.data().friends || [];
        if (friendIds.length === 0) {
            return [];
        }

        const friends = [];
        for (const friendId of friendIds) {
            const friendDoc = await getDoc(doc(db, "users", friendId));
            if (friendDoc.exists()) {
                const friendData = friendDoc.data();
                friends.push({
                    id: friendId,
                    username: friendData.username,
                    displayName: friendData.displayName,
                    profilePicture: friendData.profilePicture,
                    lastSeen: friendData.lastSeen || null,
                    isOnline: friendData.isOnline || false
                });
            }
        }

        // Cache the result
        friendsCache.set(userId, {
            data: friends,
            timestamp: Date.now()
        });

        return friends;
    } catch (error) {
        console.error("Error getting friends for chat:", error);
        return [];
    }
}

// Search for users (with result limiting)
export async function searchUsers(searchTerm, currentUserId, limitCount = 10) {
    if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
    }

    try {
        const searchTermLower = searchTerm.toLowerCase();

        // ✅ OPTIMIZED: Smaller limit to reduce reads
        const actualLimit = Math.min(limitCount, 5); // Max 5 results

        // Search by username
        const usernameQuery = query(
            collection(db, "users"),
            where("username", ">=", searchTermLower),
            where("username", "<=", searchTermLower + '\uf8ff'),
            limit(actualLimit)
        );

        // Search by display name
        const displayNameQuery = query(
            collection(db, "users"),
            where("displayName", ">=", searchTerm),
            where("displayName", "<=", searchTerm + '\uf8ff'),
            limit(actualLimit)
        );

        const [usernameSnapshot, displayNameSnapshot] = await Promise.all([
            getDocs(usernameQuery),
            getDocs(displayNameQuery)
        ]);

        const users = new Map(); // Use Map to avoid duplicates

        // Process username results
        usernameSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (doc.id !== currentUserId) {
                users.set(doc.id, {
                    id: doc.id,
                    username: userData.username,
                    displayName: userData.displayName,
                    profilePicture: userData.profilePicture,
                    bio: userData.bio,
                    isOnline: userData.isOnline || false,
                    lastSeen: userData.lastSeen || null
                });
            }
        });

        // Process display name results
        displayNameSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (doc.id !== currentUserId && !users.has(doc.id)) {
                users.set(doc.id, {
                    id: doc.id,
                    username: userData.username,
                    displayName: userData.displayName,
                    profilePicture: userData.profilePicture,
                    bio: userData.bio,
                    isOnline: userData.isOnline || false,
                    lastSeen: userData.lastSeen || null
                });
            }
        });

        return Array.from(users.values()).slice(0, actualLimit);
    } catch (error) {
        console.error("Error searching users:", error);
        return [];
    }
}