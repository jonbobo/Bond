// components/services/chatUtils.js
import {
    collection,
    addDoc,
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
    setDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';

// Update user online status
export async function updateOnlineStatus(isOnline) {
    if (!auth.currentUser) return;

    try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
            isOnline,
            lastSeen: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating online status:", error);
    }
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

// Send a message in a chat
export async function sendMessage(chatId, content, messageType = 'text') {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to send messages");
    }

    if (!content || content.trim().length === 0) {
        throw new Error("Message content cannot be empty");
    }

    try {
        console.log('📤 Sending message:', { chatId, content: content.trim(), sender: auth.currentUser.uid });

        const messageData = {
            chatId,
            senderId: auth.currentUser.uid,
            content: content.trim(),
            type: messageType,
            createdAt: serverTimestamp(),
            edited: false,
            editedAt: null
        };

        // Add message to messages collection
        console.log('📝 Adding message to Firestore...');
        const messageRef = await addDoc(collection(db, "messages"), messageData);
        console.log('✅ Message added with ID:', messageRef.id);

        // Update chat's last message info
        console.log('📝 Updating chat document...');
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);

        if (chatSnap.exists()) {
            const chatData = chatSnap.data();
            const otherParticipant = chatData.participants.find(id => id !== auth.currentUser.uid);

            await updateDoc(chatRef, {
                lastMessage: content.trim(),
                lastMessageAt: serverTimestamp(),
                [`unreadCount.${otherParticipant}`]: (chatData.unreadCount?.[otherParticipant] || 0) + 1
            });
            console.log('✅ Chat document updated');
        } else {
            console.error('❌ Chat document not found when updating last message');
        }

        return messageRef.id;
    } catch (error) {
        console.error("❌ Error sending message:", error);
        throw error;
    }
}

// Get messages for a chat with real-time updates - COMPLETE FIX
export function subscribeToMessages(chatId, callback, limitCount = 50) {
    if (!chatId) {
        console.error('❌ Cannot subscribe to messages: chatId is required');
        callback([]);
        return () => { };
    }

    try {
        console.log('🔄 Setting up message subscription for chat:', chatId);

        // Use the correct query that matches your index
        const messagesQuery = query(
            collection(db, "messages"),
            where("chatId", "==", chatId),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );

        console.log('📝 Query created, setting up listener...');

        const unsubscribe = onSnapshot(
            messagesQuery,
            async (querySnapshot) => {
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

                // Process each message document
                for (const docSnap of querySnapshot.docs) {
                    const messageData = docSnap.data();
                    console.log('📝 Processing message:', {
                        id: docSnap.id,
                        senderId: messageData.senderId,
                        content: messageData.content?.substring(0, 50) + '...',
                        createdAt: messageData.createdAt
                    });

                    try {
                        // Get sender information
                        const senderDoc = await getDoc(doc(db, "users", messageData.senderId));
                        const senderData = senderDoc.exists() ? senderDoc.data() : null;

                        messages.push({
                            id: docSnap.id,
                            ...messageData,
                            sender: {
                                id: messageData.senderId,
                                username: senderData?.username || 'Unknown',
                                displayName: senderData?.displayName || 'Unknown User',
                                profilePicture: senderData?.profilePicture || null
                            }
                        });
                    } catch (senderError) {
                        console.error('❌ Error getting sender data:', senderError);
                        // Add message with fallback sender data
                        messages.push({
                            id: docSnap.id,
                            ...messageData,
                            sender: {
                                id: messageData.senderId,
                                username: 'Unknown',
                                displayName: 'Unknown User',
                                profilePicture: null
                            }
                        });
                    }
                }

                // Sort by creation time (oldest first for display)
                messages.sort((a, b) => {
                    const aTime = a.createdAt?.toDate?.() || new Date(0);
                    const bTime = b.createdAt?.toDate?.() || new Date(0);
                    return aTime - bTime;
                });

                console.log('✅ Processed messages for display:', {
                    count: messages.length,
                    firstMessage: messages[0]?.content?.substring(0, 30),
                    lastMessage: messages[messages.length - 1]?.content?.substring(0, 30)
                });

                callback(messages);
            },
            (error) => {
                console.error("❌ Error in messages listener:", error);

                // Check if it's an index error
                if (error.code === 'failed-precondition') {
                    console.error("❌ Index missing! Create the index for messages collection:");
                    console.error("Fields: chatId (asc), createdAt (desc)");
                }

                callback([]);
            }
        );

        console.log('✅ Message listener set up successfully');
        return unsubscribe;
    } catch (error) {
        console.error("❌ Error subscribing to messages:", error);
        return () => { };
    }
}

// Get user's chats with real-time updates
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

                for (const docSnap of querySnapshot.docs) {
                    const chatData = docSnap.data();
                    const otherParticipantId = chatData.participants.find(id => id !== userId);

                    // Get other participant's information
                    const participantDoc = await getDoc(doc(db, "users", otherParticipantId));
                    const participantData = participantDoc.exists() ? participantDoc.data() : null;

                    chats.push({
                        id: docSnap.id,
                        ...chatData,
                        otherParticipant: {
                            id: otherParticipantId,
                            username: participantData?.username || 'Unknown',
                            displayName: participantData?.displayName || 'Unknown User',
                            profilePicture: participantData?.profilePicture || null
                        },
                        unreadCount: chatData.unreadCount?.[userId] || 0
                    });
                }

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

// Get user's friends for contacts sidebar
export async function getUserFriendsForChat(userId) {
    try {
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

        return friends;
    } catch (error) {
        console.error("Error getting friends for chat:", error);
        return [];
    }
}

// Search for users (anyone can message anyone)
export async function searchUsers(searchTerm, currentUserId, limitCount = 10) {
    if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
    }

    try {
        const searchTermLower = searchTerm.toLowerCase();

        // Search by username
        const usernameQuery = query(
            collection(db, "users"),
            where("username", ">=", searchTermLower),
            where("username", "<=", searchTermLower + '\uf8ff'),
            limit(limitCount)
        );

        // Search by display name
        const displayNameQuery = query(
            collection(db, "users"),
            where("displayName", ">=", searchTerm),
            where("displayName", "<=", searchTerm + '\uf8ff'),
            limit(limitCount)
        );

        const [usernameSnapshot, displayNameSnapshot] = await Promise.all([
            getDocs(usernameQuery),
            getDocs(displayNameQuery)
        ]);

        const users = new Map(); // Use Map to avoid duplicates

        // Process username results
        usernameSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (doc.id !== currentUserId) { // Exclude current user
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
            if (doc.id !== currentUserId && !users.has(doc.id)) { // Exclude current user and duplicates
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

        return Array.from(users.values()).slice(0, limitCount);
    } catch (error) {
        console.error("Error searching users:", error);
        return [];
    }
}