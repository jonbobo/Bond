// components/services/connectionUtils.js
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
    limit
} from 'firebase/firestore';
import { db, auth } from './firebase';

// Send friend request
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

        // Get or create current user data
        const currentUserDoc = await getDoc(doc(db, "users", currentUserId));
        let currentUserData;

        if (!currentUserDoc.exists()) {
            // Create user profile if it doesn't exist
            currentUserData = {
                email: auth.currentUser.email,
                username: auth.currentUser.email.split('@')[0], // fallback username
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

        // Safely check arrays, default to empty array if undefined
        const currentSentRequests = currentUserData.sentRequests || [];

        if (currentSentRequests.includes(targetUserId)) {
            throw new Error("Friend request already sent");
        }

        // Get target user data to check if request already exists
        const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
        if (!targetUserDoc.exists()) {
            throw new Error("User not found");
        }

        const targetUserData = targetUserDoc.data();
        // Safely check arrays, default to empty array if undefined
        const targetFriendRequests = targetUserData.friendRequests || [];

        if (targetFriendRequests.includes(currentUserId)) {
            throw new Error("Friend request already sent");
        }

        // Update current user's sent requests (initialize array if it doesn't exist)
        await updateDoc(doc(db, "users", currentUserId), {
            sentRequests: arrayUnion(targetUserId),
            // Ensure other friend arrays exist
            friends: currentUserData.friends || [],
            friendRequests: currentUserData.friendRequests || []
        });

        // Update target user's friend requests (initialize array if it doesn't exist)
        await updateDoc(doc(db, "users", targetUserId), {
            friendRequests: arrayUnion(currentUserId),
            // Ensure other friend arrays exist
            friends: targetUserData.friends || [],
            sentRequests: targetUserData.sentRequests || []
        });

        return true;
    } catch (error) {
        console.error("Error sending friend request:", error);
        throw error;
    }
}

// Accept friend request
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

        // Add each other as friends
        await updateDoc(doc(db, "users", currentUserId), {
            friends: arrayUnion(requesterId),
            friendRequests: arrayRemove(requesterId)
        });

        await updateDoc(doc(db, "users", requesterId), {
            friends: arrayUnion(currentUserId),
            sentRequests: arrayRemove(currentUserId)
        });

        return true;
    } catch (error) {
        console.error("Error accepting friend request:", error);
        throw error;
    }
}

// Cancel friend request
export async function cancelFriendRequest(targetUserId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to cancel friend requests");
    }

    const currentUserId = auth.currentUser.uid;

    try {
        console.log(`Canceling friend request from ${currentUserId} to ${targetUserId}`);

        // Remove from current user's sent requests
        await updateDoc(doc(db, "users", currentUserId), {
            sentRequests: arrayRemove(targetUserId)
        });
        console.log(`Removed ${targetUserId} from current user's sentRequests`);

        // Remove from target user's friend requests  
        await updateDoc(doc(db, "users", targetUserId), {
            friendRequests: arrayRemove(currentUserId)
        });
        console.log(`Removed ${currentUserId} from target user's friendRequests`);

        console.log("Friend request cancellation completed successfully");
        return true;
    } catch (error) {
        console.error("Error canceling friend request:", error);
        throw error;
    }
}

// Decline friend request
export async function declineFriendRequest(requesterId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to decline friend requests");
    }

    const currentUserId = auth.currentUser.uid;

    try {
        // Remove from current user's friend requests
        await updateDoc(doc(db, "users", currentUserId), {
            friendRequests: arrayRemove(requesterId)
        });

        // Remove from requester's sent requests
        await updateDoc(doc(db, "users", requesterId), {
            sentRequests: arrayRemove(currentUserId)
        });

        return true;
    } catch (error) {
        console.error("Error declining friend request:", error);
        throw error;
    }
}

// Remove friend
export async function removeFriend(friendId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to remove friends");
    }

    const currentUserId = auth.currentUser.uid;

    try {
        // Remove from both users' friends lists
        await updateDoc(doc(db, "users", currentUserId), {
            friends: arrayRemove(friendId)
        });

        await updateDoc(doc(db, "users", friendId), {
            friends: arrayRemove(currentUserId)
        });

        return true;
    } catch (error) {
        console.error("Error removing friend:", error);
        throw error;
    }
}

// Check if two users are friends
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

// Get user's friends list with details
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
                    bio: friendData.bio
                });
            }
        }

        return friends;
    } catch (error) {
        console.error("Error getting friends with details:", error);
        return [];
    }
}

// Get pending friend requests with details
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
                    bio: requesterData.bio
                });
            }
        }

        return requests;
    } catch (error) {
        console.error("Error getting pending requests with details:", error);
        return [];
    }
}

// Search for users (potential friends)
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
                    bio: userData.bio
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
                    bio: userData.bio
                });
            }
        });

        return Array.from(users.values()).slice(0, limitCount);
    } catch (error) {
        console.error("Error searching users:", error);
        return [];
    }
}

// Get friend suggestions (users with mutual friends)
export async function getFriendSuggestions(userId, limitCount = 10) {
    try {
        // Get current user's friends
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            return [];
        }

        const currentFriends = userDoc.data().friends || [];
        const sentRequests = userDoc.data().sentRequests || [];
        const receivedRequests = userDoc.data().friendRequests || [];

        if (currentFriends.length === 0) {
            // If no friends, suggest some random users
            return await getRandomUserSuggestions(userId, limitCount);
        }

        const suggestionMap = new Map();

        // Look at friends of friends
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

        // Get user details for suggestions
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
                    mutualFriends: data.mutualCount
                });
            }
        }

        // Sort by mutual friends count
        suggestions.sort((a, b) => b.mutualFriends - a.mutualFriends);

        return suggestions.slice(0, limitCount);
    } catch (error) {
        console.error("Error getting friend suggestions:", error);
        return [];
    }
}

// Migration function to add friend arrays to existing users
export async function migrateUserToFriendSystem(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();

            // Only update if the arrays are missing
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

// Get random user suggestions for users with no friends
async function getRandomUserSuggestions(userId, limitCount) {
    try {
        const usersQuery = query(
            collection(db, "users"),
            limit(limitCount * 2) // Get more to filter out current user
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
                    mutualFriends: 0
                });
            }
        });

        return suggestions;
    } catch (error) {
        console.error("Error getting random suggestions:", error);
        return [];
    }
}