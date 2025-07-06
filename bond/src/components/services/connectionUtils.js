import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    query,
    where,
    getDocs,
    limit,
    writeBatch, // ✅ Import for batch operations

} from 'firebase/firestore';
import { db, auth } from './firebase';

// ✅ OPTIMIZED: Batch write for friend requests (2 writes → 1 batch)
export async function sendFriendRequest(targetUserId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to send friend requests");
    }

    const currentUserId = auth.currentUser.uid;

    if (currentUserId === targetUserId) {
        throw new Error("You cannot send a friend request to yourself");
    }

    try {
        // Check if already friends
        const areFriendsAlready = await areFriends(currentUserId, targetUserId);
        if (areFriendsAlready) {
            throw new Error("You are already friends with this user");
        }

        // Get both user documents
        const [currentUserDoc, targetUserDoc] = await Promise.all([
            getDoc(doc(db, "users", currentUserId)),
            getDoc(doc(db, "users", targetUserId))
        ]);

        let currentUserData;
        if (!currentUserDoc.exists()) {
            // Create user profile if it doesn't exist
            currentUserData = {
                email: auth.currentUser.email,
                username: auth.currentUser.email.split('@')[0],
                displayName: auth.currentUser.email.split('@')[0],
                createdAt: new Date().toISOString(),
                profilePicture: null,
                bio: "",
                friends: [],
                friendRequests: [],
                sentRequests: []
            };
            await setDoc(doc(db, "users", currentUserId), currentUserData);
        } else {
            currentUserData = currentUserDoc.data();
        }

        if (!targetUserDoc.exists()) {
            throw new Error("User not found");
        }

        const targetUserData = targetUserDoc.data();

        // Check for duplicate requests
        const currentSentRequests = currentUserData.sentRequests || [];
        const targetFriendRequests = targetUserData.friendRequests || [];

        if (currentSentRequests.includes(targetUserId)) {
            throw new Error("Friend request already sent");
        }

        if (targetFriendRequests.includes(currentUserId)) {
            throw new Error("Friend request already sent");
        }

        // ✅ OPTIMIZATION: Single batch write instead of 2 separate writes
        const batch = writeBatch(db);

        // Update current user's sent requests
        batch.update(doc(db, "users", currentUserId), {
            sentRequests: arrayUnion(targetUserId),
            friends: currentUserData.friends || [],
            friendRequests: currentUserData.friendRequests || []
        });

        // Update target user's friend requests
        batch.update(doc(db, "users", targetUserId), {
            friendRequests: arrayUnion(currentUserId),
            friends: targetUserData.friends || [],
            sentRequests: targetUserData.sentRequests || []
        });

        // ✅ Single batch commit = 1 write operation instead of 2
        await batch.commit();
        console.log('✅ Friend request sent via batch write');

        return true;
    } catch (error) {
        console.error("Error sending friend request:", error);
        throw error;
    }
}

// ✅ OPTIMIZED: Batch write for accepting friend requests
export async function acceptFriendRequest(requesterId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to accept friend requests");
    }

    const currentUserId = auth.currentUser.uid;

    try {
        // Verify the request exists
        const currentUserDoc = await getDoc(doc(db, "users", currentUserId));
        const currentUserData = currentUserDoc.data();

        if (!currentUserData.friendRequests?.includes(requesterId)) {
            throw new Error("Friend request not found");
        }

        // ✅ OPTIMIZATION: Single batch write instead of 2 separate writes
        const batch = writeBatch(db);

        // Add each other as friends and remove from request arrays
        batch.update(doc(db, "users", currentUserId), {
            friends: arrayUnion(requesterId),
            friendRequests: arrayRemove(requesterId)
        });

        batch.update(doc(db, "users", requesterId), {
            friends: arrayUnion(currentUserId),
            sentRequests: arrayRemove(currentUserId)
        });

        // ✅ Single batch commit = 1 write operation instead of 2
        await batch.commit();
        console.log('✅ Friend request accepted via batch write');

        return true;
    } catch (error) {
        console.error("Error accepting friend request:", error);
        throw error;
    }
}

// ✅ OPTIMIZED: Batch write for canceling friend requests
export async function cancelFriendRequest(targetUserId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to cancel friend requests");
    }

    const currentUserId = auth.currentUser.uid;

    try {
        console.log(`Canceling friend request from ${currentUserId} to ${targetUserId}`);

        // ✅ OPTIMIZATION: Single batch write instead of 2 separate writes
        const batch = writeBatch(db);

        // Remove from current user's sent requests
        batch.update(doc(db, "users", currentUserId), {
            sentRequests: arrayRemove(targetUserId)
        });

        // Remove from target user's friend requests  
        batch.update(doc(db, "users", targetUserId), {
            friendRequests: arrayRemove(currentUserId)
        });

        // ✅ Single batch commit = 1 write operation instead of 2
        await batch.commit();
        console.log('✅ Friend request canceled via batch write');

        return true;
    } catch (error) {
        console.error("Error canceling friend request:", error);
        throw error;
    }
}

// ✅ OPTIMIZED: Batch write for declining friend requests
export async function declineFriendRequest(requesterId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to decline friend requests");
    }

    const currentUserId = auth.currentUser.uid;

    try {
        // ✅ OPTIMIZATION: Single batch write instead of 2 separate writes
        const batch = writeBatch(db);

        // Remove from current user's friend requests
        batch.update(doc(db, "users", currentUserId), {
            friendRequests: arrayRemove(requesterId)
        });

        // Remove from requester's sent requests
        batch.update(doc(db, "users", requesterId), {
            sentRequests: arrayRemove(currentUserId)
        });

        // ✅ Single batch commit = 1 write operation instead of 2
        await batch.commit();
        console.log('✅ Friend request declined via batch write');

        return true;
    } catch (error) {
        console.error("Error declining friend request:", error);
        throw error;
    }
}

// ✅ OPTIMIZED: Batch write for removing friends
export async function removeFriend(friendId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to remove friends");
    }

    const currentUserId = auth.currentUser.uid;

    try {
        // ✅ OPTIMIZATION: Single batch write instead of 2 separate writes
        const batch = writeBatch(db);

        // Remove from both users' friends lists
        batch.update(doc(db, "users", currentUserId), {
            friends: arrayRemove(friendId)
        });

        batch.update(doc(db, "users", friendId), {
            friends: arrayRemove(currentUserId)
        });

        // ✅ Single batch commit = 1 write operation instead of 2
        await batch.commit();
        console.log('✅ Friend removed via batch write');

        return true;
    } catch (error) {
        console.error("Error removing friend:", error);
        throw error;
    }
}

// Keep existing functions unchanged - they're read operations
export async function areFriends(userId1, userId2) {
    if (userId1 === userId2) return true;

    try {
        const userDoc = await getDoc(doc(db, "users", userId1));
        if (userDoc.exists()) {
            const friends = userDoc.data().friends || [];
            return friends.includes(userId2);
        }
        return false;
    } catch (error) {
        console.error("Error checking friendship:", error);
        return false;
    }
}

// ✅ POTENTIAL OPTIMIZATION: Could batch read friend details
export async function getUserFriendsWithDetails(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            return [];
        }

        const friendIds = userDoc.data().friends || [];
        if (friendIds.length === 0) {
            return [];
        }

        // ✅ TODO: Could optimize with batch read for many friends
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
                    bio: friendData.bio,
                    isOnline: friendData.isOnline || false,
                    lastSeen: friendData.lastSeen || null
                });
            }
        }

        return friends;
    } catch (error) {
        console.error("Error getting friends with details:", error);
        return [];
    }
}

// ✅ POTENTIAL OPTIMIZATION: Could batch read request details
export async function getPendingRequestsWithDetails(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            return [];
        }

        const requestIds = userDoc.data().friendRequests || [];
        if (requestIds.length === 0) {
            return [];
        }

        // ✅ TODO: Could optimize with batch read for many requests
        const requests = [];
        for (const requesterId of requestIds) {
            const requesterDoc = await getDoc(doc(db, "users", requesterId));
            if (requesterDoc.exists()) {
                const requesterData = requesterDoc.data();
                requests.push({
                    id: requesterId,
                    username: requesterData.username,
                    displayName: requesterData.displayName,
                    profilePicture: requesterData.profilePicture,
                    bio: requesterData.bio,
                    isOnline: requesterData.isOnline || false,
                    lastSeen: requesterData.lastSeen || null
                });
            }
        }

        return requests;
    } catch (error) {
        console.error("Error getting pending requests with details:", error);
        return [];
    }
}

// Keep other search and suggestion functions unchanged
export async function searchUsers(searchTerm, currentUserId, limitCount = 10) {
    if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
    }

    try {
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

        const [usernameSnapshot, displayNameSnapshot] = await Promise.all([
            getDocs(usernameQuery),
            getDocs(displayNameQuery)
        ]);

        const users = new Map();

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

        return Array.from(users.values()).slice(0, limitCount);
    } catch (error) {
        console.error("Error searching users:", error);
        return [];
    }
}

export async function getFriendSuggestions(userId, limitCount = 10) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            return [];
        }

        const currentFriends = userDoc.data().friends || [];
        const sentRequests = userDoc.data().sentRequests || [];
        const receivedRequests = userDoc.data().friendRequests || [];

        if (currentFriends.length === 0) {
            return await getRandomUserSuggestions(userId, limitCount);
        }

        const suggestionMap = new Map();

        for (const friendId of currentFriends) {
            const friendDoc = await getDoc(doc(db, "users", friendId));
            if (friendDoc.exists()) {
                const friendsFriends = friendDoc.data().friends || [];

                for (const potentialFriendId of friendsFriends) {
                    if (potentialFriendId !== userId &&
                        !currentFriends.includes(potentialFriendId) &&
                        !sentRequests.includes(potentialFriendId) &&
                        !receivedRequests.includes(potentialFriendId)) {

                        if (suggestionMap.has(potentialFriendId)) {
                            suggestionMap.get(potentialFriendId).mutualCount++;
                        } else {
                            suggestionMap.set(potentialFriendId, {
                                id: potentialFriendId,
                                mutualCount: 1
                            });
                        }
                    }
                }
            }
        }

        const suggestions = [];
        for (const [suggestedId, data] of suggestionMap) {
            if (suggestions.length >= limitCount) break;

            const suggestedUserDoc = await getDoc(doc(db, "users", suggestedId));
            if (suggestedUserDoc.exists()) {
                const userData = suggestedUserDoc.data();
                suggestions.push({
                    id: suggestedId,
                    username: userData.username,
                    displayName: userData.displayName,
                    profilePicture: userData.profilePicture,
                    bio: userData.bio,
                    mutualFriends: data.mutualCount,
                    isOnline: userData.isOnline || false,
                    lastSeen: userData.lastSeen || null
                });
            }
        }

        suggestions.sort((a, b) => b.mutualFriends - a.mutualFriends);
        return suggestions.slice(0, limitCount);
    } catch (error) {
        console.error("Error getting friend suggestions:", error);
        return [];
    }
}

export async function migrateUserToFriendSystem(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();

            if (!userData.friends || !userData.friendRequests || !userData.sentRequests) {
                await updateDoc(doc(db, "users", userId), {
                    friends: userData.friends || [],
                    friendRequests: userData.friendRequests || [],
                    sentRequests: userData.sentRequests || []
                });
                console.log("User migrated to friend system successfully");
            }
        }
    } catch (error) {
        console.error("Error migrating user:", error);
    }
}

async function getRandomUserSuggestions(userId, limitCount) {
    try {
        const usersQuery = query(
            collection(db, "users"),
            limit(limitCount * 2)
        );

        const snapshot = await getDocs(usersQuery);
        const suggestions = [];

        snapshot.forEach((doc) => {
            if (doc.id !== userId && suggestions.length < limitCount) {
                const userData = doc.data();
                suggestions.push({
                    id: doc.id,
                    username: userData.username,
                    displayName: userData.displayName,
                    profilePicture: userData.profilePicture,
                    bio: userData.bio,
                    mutualFriends: 0,
                    isOnline: userData.isOnline || false,
                    lastSeen: userData.lastSeen || null
                });
            }
        });

        return suggestions;
    } catch (error) {
        console.error("Error getting random suggestions:", error);
        return [];
    }
}