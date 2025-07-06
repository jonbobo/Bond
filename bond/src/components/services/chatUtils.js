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

// ✅ REMOVED: All presence-related code - now handled by presenceUtils.js

// ✅ OPTIMIZED: Include participant data in chat document (denormalized)
export async function createOrGetChat(participantId) {
    if (!auth.currentUser) throw new Error("You must be logged in");

    const currentUserId = auth.currentUser.uid;
    if (currentUserId === participantId) throw new Error("Cannot chat with yourself");

    const chatId = [currentUserId, participantId].sort().join('_');
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
        return { chatId, chatData: chatSnap.data() };
    }

    // ✅ Get both users' data to denormalize
    const [currentUserSnap, participantSnap] = await Promise.all([
        getDoc(doc(db, "users", currentUserId)),
        getDoc(doc(db, "users", participantId))
    ]);

    const currentUserData = currentUserSnap.exists() ? currentUserSnap.data() : {};
    const participantData = participantSnap.exists() ? participantSnap.data() : {};

    const chatData = {
        participants: [currentUserId, participantId],
        // ✅ DENORMALIZED: Include participant info to avoid lookups
        participantData: {
            [currentUserId]: {
                id: currentUserId,
                username: currentUserData.username || 'unknown',
                displayName: currentUserData.displayName || 'Unknown',
                profilePicture: currentUserData.profilePicture || null
            },
            [participantId]: {
                id: participantId,
                username: participantData.username || 'unknown',
                displayName: participantData.displayName || 'Unknown',
                profilePicture: participantData.profilePicture || null
            }
        },
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: serverTimestamp(),
        unreadCount: {
            [currentUserId]: 0,
            [participantId]: 0
        }
    };

    await setDoc(chatRef, chatData);
    return { chatId, chatData };
}

// ✅ OPTIMIZED: Batch message send + chat update 
export async function sendMessage(chatId, content, messageType = 'text') {
    if (!auth.currentUser) throw new Error("You must be logged in");
    if (!content?.trim()) throw new Error("Message cannot be empty");

    // Get sender data once
    const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    const batch = writeBatch(db);

    // ✅ DENORMALIZED: Include sender data in message
    const messageData = {
        chatId,
        senderId: auth.currentUser.uid,
        sender: {
            id: auth.currentUser.uid,
            username: userData.username || 'unknown',
            displayName: userData.displayName || 'Unknown',
            profilePicture: userData.profilePicture || null
        },
        content: content.trim(),
        type: messageType,
        createdAt: serverTimestamp(),
        edited: false,
        editedAt: null
    };

    // Add message
    const messageRef = doc(collection(db, "messages"));
    batch.set(messageRef, messageData);

    // Update chat metadata
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const otherUser = chatData.participants.find(id => id !== auth.currentUser.uid);

        batch.update(chatRef, {
            lastMessage: content.trim(),
            lastMessageAt: serverTimestamp(),
            [`unreadCount.${otherUser}`]: (chatData.unreadCount?.[otherUser] || 0) + 1
        });
    }

    // ✅ SINGLE BATCH WRITE instead of 2 separate writes
    await batch.commit();
    return messageRef.id;
}

// ✅ NEW: Get messages once without real-time listener (cost optimization)
export async function getMessagesOnce(chatId, limitCount = 50) {
    if (!chatId) return [];

    try {
        const messagesQuery = query(
            collection(db, "messages"),
            where("chatId", "==", chatId),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(messagesQuery);
        const messages = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            messages.push({
                id: docSnap.id,
                ...data
            });
        });

        // Sort oldest to newest for display
        messages.sort((a, b) =>
            (a.createdAt?.toDate?.() || new Date(0)) -
            (b.createdAt?.toDate?.() || new Date(0))
        );

        console.log(`✅ Fetched ${messages.length} messages for chat ${chatId} (one-time read)`);
        return messages;
    } catch (error) {
        console.error("❌ Error fetching messages:", error);
        return [];
    }
}

// ✅ OPTIMIZED: No more individual getDoc calls for senders
export function subscribeToMessages(chatId, callback, limitCount = 50) {
    if (!chatId) return () => { };

    const messagesQuery = query(
        collection(db, "messages"),
        where("chatId", "==", chatId),
        orderBy("createdAt", "desc"),
        limit(limitCount)
    );

    const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
        const messages = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // ✅ OPTIMIZED: Sender data is already in the message!
            messages.push({
                id: docSnap.id,
                ...data
            });
        });

        messages.sort((a, b) =>
            (a.createdAt?.toDate?.() || new Date(0)) -
            (b.createdAt?.toDate?.() || new Date(0))
        );

        callback(messages);
    }, (err) => {
        console.error("Messages listener error:", err);
        callback([]);
    });

    return unsubscribe;
}

// ✅ OPTIMIZED: No more individual getDoc calls for participants
export function subscribeToUserChats(userId, callback) {
    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", userId),
        orderBy("lastMessageAt", "desc")
    );

    return onSnapshot(chatsQuery, (querySnapshot) => {
        const chats = [];

        querySnapshot.forEach((docSnap) => {
            const chatData = docSnap.data();
            const otherId = chatData.participants.find(id => id !== userId);

            // ✅ OPTIMIZED: Use denormalized participant data
            const otherParticipant = chatData.participantData?.[otherId] || {
                id: otherId,
                username: 'unknown',
                displayName: 'Unknown',
                profilePicture: null
            };

            chats.push({
                id: docSnap.id,
                ...chatData,
                otherParticipant,
                unreadCount: chatData.unreadCount?.[userId] || 0
            });
        });

        callback(chats);
    }, (err) => {
        console.error("Chat listener error:", err);
        callback([]);
    });
}

// ✅ OPTIMIZED: Debounced mark as read
let markAsReadTimeouts = new Map();

export async function markChatAsRead(chatId) {
    if (!auth.currentUser || !chatId) return;

    // ✅ Debounce multiple mark-as-read calls
    if (markAsReadTimeouts.has(chatId)) {
        clearTimeout(markAsReadTimeouts.get(chatId));
    }

    const timeoutId = setTimeout(async () => {
        try {
            const chatRef = doc(db, "chats", chatId);
            await updateDoc(chatRef, {
                [`unreadCount.${auth.currentUser.uid}`]: 0
            });
            markAsReadTimeouts.delete(chatId);
            console.log('✅ Chat marked as read (debounced):', chatId);
        } catch (error) {
            console.error('❌ Error marking chat as read:', error);
        }
    }, 1000); // 1 second debounce

    markAsReadTimeouts.set(chatId, timeoutId);
}

// ✅ UPDATED: Get friends for chat without presence data (presence handled separately)
export async function getUserFriendsForChat(userId) {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const friendIds = userDoc.data().friends || [];
    const friends = [];

    for (const id of friendIds) {
        const docSnap = await getDoc(doc(db, "users", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            friends.push({
                id,
                username: data.username,
                displayName: data.displayName,
                profilePicture: data.profilePicture,
                bio: data.bio || '',
                // ✅ REMOVED: isOnline, lastSeen - now handled by presenceUtils.js
            });
        }
    }

    return friends;
}

// ✅ UPDATED: Search users without presence data (presence handled separately)
export async function searchUsers(searchTerm, currentUserId, limitCount = 10) {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    const searchTermLower = searchTerm.toLowerCase();

    const usernameQuery = query(
        collection(db, "users"),
        where("username", ">=", searchTermLower),
        where("username", "<=", searchTermLower + '\uf8ff'),
        limit(limitCount)
    );

    const displayNameQuery = query(
        collection(db, "users"),
        where("displayName", ">=", searchTerm),
        where("displayName", "<=", searchTerm + '\uf8ff'),
        limit(limitCount)
    );

    const [usernameSnap, displayNameSnap] = await Promise.all([
        getDocs(usernameQuery),
        getDocs(displayNameQuery)
    ]);

    const users = new Map();

    for (const docSnap of usernameSnap.docs.concat(displayNameSnap.docs)) {
        if (docSnap.id === currentUserId) continue;
        const data = docSnap.data();
        users.set(docSnap.id, {
            id: docSnap.id,
            username: data.username,
            displayName: data.displayName,
            profilePicture: data.profilePicture,
            bio: data.bio,
            // ✅ REMOVED: isOnline, lastSeen - presence handled by presenceUtils.js
        });
    }

    return Array.from(users.values()).slice(0, limitCount);
}