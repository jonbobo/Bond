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
import { onAuthStateChanged } from 'firebase/auth';

// 🧠 Throttling config for online presence
let lastOnlineUpdate = null;
let lastOnlineValue = null;

// ✅ Efficiently update user presence only when needed
export async function updateOnlineStatus(isOnline) {
    if (!auth.currentUser) return;

    const now = Date.now();

    // 🛑 Skip if status hasn't changed and it's been less than 5 minutes
    if (
        lastOnlineValue === isOnline &&
        lastOnlineUpdate &&
        (now - lastOnlineUpdate) < 300000
    ) {
        console.log('⏩ Skipping presence update');
        return;
    }

    try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
            isOnline,
            lastSeen: serverTimestamp()
        });

        lastOnlineUpdate = now;
        lastOnlineValue = isOnline;

        console.log('✅ Presence updated:', isOnline);
    } catch (err) {
        console.error("❌ Error updating presence:", err);
        lastOnlineUpdate = null;
        lastOnlineValue = null;
    }
}

// ✅ Automatically handle presence on login, logout, tab change, online/offline
function setupPresenceTracking() {
    if (!auth.currentUser) return;

    const update = (status) => updateOnlineStatus(status);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') update(true);
    });

    window.addEventListener('online', () => update(true));
    window.addEventListener('offline', () => update(false));
    window.addEventListener('beforeunload', () => update(false));
}

// 👂 Setup tracking when auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        setupPresenceTracking();
        updateOnlineStatus(true);
    } else {
        updateOnlineStatus(false);
    }
});

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

    await setDoc(chatRef, chatData);
    return { chatId, chatData };
}

export async function sendMessage(chatId, content, messageType = 'text') {
    if (!auth.currentUser) throw new Error("You must be logged in");
    if (!content?.trim()) throw new Error("Message cannot be empty");

    const messageData = {
        chatId,
        senderId: auth.currentUser.uid,
        content: content.trim(),
        type: messageType,
        createdAt: serverTimestamp(),
        edited: false,
        editedAt: null
    };

    const messageRef = await addDoc(collection(db, "messages"), messageData);

    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const otherUser = chatData.participants.find(id => id !== auth.currentUser.uid);
        await updateDoc(chatRef, {
            lastMessage: content.trim(),
            lastMessageAt: serverTimestamp(),
            [`unreadCount.${otherUser}`]: (chatData.unreadCount?.[otherUser] || 0) + 1
        });
    }

    return messageRef.id;
}

export function subscribeToMessages(chatId, callback, limitCount = 50) {
    if (!chatId) return () => { };

    const messagesQuery = query(
        collection(db, "messages"),
        where("chatId", "==", chatId),
        orderBy("createdAt", "desc"),
        limit(limitCount)
    );

    const unsubscribe = onSnapshot(messagesQuery, async (querySnapshot) => {
        const messages = [];

        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            const senderDoc = await getDoc(doc(db, "users", data.senderId));
            const sender = senderDoc.exists() ? senderDoc.data() : {};

            messages.push({
                id: docSnap.id,
                ...data,
                sender: {
                    id: data.senderId,
                    username: sender.username || 'Unknown',
                    displayName: sender.displayName || 'Unknown',
                    profilePicture: sender.profilePicture || null
                }
            });
        }

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

export function subscribeToUserChats(userId, callback) {
    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", userId),
        orderBy("lastMessageAt", "desc")
    );

    return onSnapshot(chatsQuery, async (querySnapshot) => {
        const chats = [];

        for (const docSnap of querySnapshot.docs) {
            const chatData = docSnap.data();
            const otherId = chatData.participants.find(id => id !== userId);
            const otherDoc = await getDoc(doc(db, "users", otherId));
            const other = otherDoc.exists() ? otherDoc.data() : {};

            chats.push({
                id: docSnap.id,
                ...chatData,
                otherParticipant: {
                    id: otherId,
                    username: other.username || 'Unknown',
                    displayName: other.displayName || 'Unknown',
                    profilePicture: other.profilePicture || null
                },
                unreadCount: chatData.unreadCount?.[userId] || 0
            });
        }

        callback(chats);
    }, (err) => {
        console.error("Chat listener error:", err);
        callback([]);
    });
}

export async function markChatAsRead(chatId) {
    if (!auth.currentUser || !chatId) return;
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
        [`unreadCount.${auth.currentUser.uid}`]: 0
    });
}

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
                lastSeen: data.lastSeen || null,
                isOnline: data.isOnline || false
            });
        }
    }

    return friends;
}

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
            isOnline: data.isOnline || false,
            lastSeen: data.lastSeen || null
        });
    }

    return Array.from(users.values()).slice(0, limitCount);
}
