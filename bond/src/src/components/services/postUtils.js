// components/services/postUtils.js - OPTIMIZED VERSION
import {
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    getDocs,
    where,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';

// Create a new post WITH author info included (denormalized)
export async function createPost(content, visibility = 'friends') {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to create a post");
    }

    if (!content || content.trim().length === 0) {
        throw new Error("Post content cannot be empty");
    }

    try {
        // Get current user data first
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};

        const postData = {
            content: content.trim(),
            authorId: auth.currentUser.uid,
            // ✅ INCLUDE AUTHOR DATA IN POST (denormalized)
            author: {
                id: auth.currentUser.uid,
                username: userData.username || 'unknown',
                displayName: userData.displayName || auth.currentUser.displayName || 'Unknown User',
                profilePicture: userData.profilePicture || null
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            visibility: visibility,
            likes: [],
            comments: [],
            likeCount: 0,
            commentCount: 0
        };

        const docRef = await addDoc(collection(db, "posts"), postData);
        return docRef.id;
    } catch (error) {
        console.error("Error creating post:", error);
        throw new Error("Failed to create post");
    }
}

// Get posts for user's feed (OPTIMIZED - no additional user queries needed)
export async function getFeedPosts(userId, limitCount = 20) {
    try {
        // Get user's friends
        const friends = await getUserFriends(userId);
        const allowedUserIds = [userId, ...friends];

        if (allowedUserIds.length === 0) {
            return [];
        }

        // Query posts - author info is already included
        const postsQuery = query(
            collection(db, "posts"),
            where("authorId", "in", allowedUserIds.slice(0, 10)), // Firestore limit
            where("visibility", "in", ["friends", "public"]),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(postsQuery);
        const posts = [];

        // ✅ NO ADDITIONAL QUERIES - author data is already in the post
        querySnapshot.forEach((docSnap) => {
            const postData = docSnap.data();

            // Additional privacy check
            if (postData.visibility === 'friends' && postData.authorId !== userId) {
                // Skip privacy check for now - could cache friend status
            }

            posts.push({
                id: docSnap.id,
                ...postData
                // author data is already included in postData.author
            });
        });

        return posts;
    } catch (error) {
        console.error("Error getting feed posts:", error);
        throw new Error("Failed to load posts");
    }
}

// Batch like operations to reduce writes
export async function togglePostLike(postId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to like posts");
    }

    try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) {
            throw new Error("Post not found");
        }

        const postData = postSnap.data();
        const userId = auth.currentUser.uid;
        const currentLikes = postData.likes || [];
        const isLiked = currentLikes.includes(userId);

        // ✅ SINGLE WRITE instead of separate array and count updates
        if (isLiked) {
            await updateDoc(postRef, {
                likes: arrayRemove(userId),
                likeCount: Math.max(0, (postData.likeCount || 0) - 1),
                updatedAt: serverTimestamp()
            });
        } else {
            await updateDoc(postRef, {
                likes: arrayUnion(userId),
                likeCount: (postData.likeCount || 0) + 1,
                updatedAt: serverTimestamp()
            });
        }

        return !isLiked;
    } catch (error) {
        console.error("Error toggling post like:", error);
        throw new Error("Failed to update like");
    }
}

// Helper functions remain the same
export async function getUserFriends(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            return userDoc.data().friends || [];
        }
        return [];
    } catch (error) {
        console.error("Error getting user friends:", error);
        return [];
    }
}

export async function areFriends(userId1, userId2) {
    if (userId1 === userId2) return true;

    try {
        const friends = await getUserFriends(userId1);
        return friends.includes(userId2);
    } catch (error) {
        console.error("Error checking friendship:", error);
        return false;
    }
}

// Other functions remain the same...
export async function getUserPosts(authorId, viewerId, limitCount = 20) {
    try {
        if (authorId !== viewerId) {
            const isFriend = await areFriends(viewerId, authorId);
            if (!isFriend) {
                return [];
            }
        }

        const postsQuery = query(
            collection(db, "posts"),
            where("authorId", "==", authorId),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(postsQuery);
        const posts = [];

        querySnapshot.forEach((docSnap) => {
            const postData = docSnap.data();

            if (postData.visibility === 'private' && authorId !== viewerId) {
                return;
            }

            posts.push({
                id: docSnap.id,
                ...postData
                // author data already included
            });
        });

        return posts;
    } catch (error) {
        console.error("Error getting user posts:", error);
        throw new Error("Failed to load user posts");
    }
}

export async function deletePost(postId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to delete posts");
    }

    try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) {
            throw new Error("Post not found");
        }

        const postData = postSnap.data();

        if (postData.authorId !== auth.currentUser.uid) {
            throw new Error("You can only delete your own posts");
        }

        await deleteDoc(postRef);
        return true;
    } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
    }
}

export async function updatePost(postId, newContent, newVisibility) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to update posts");
    }

    if (!newContent || newContent.trim().length === 0) {
        throw new Error("Post content cannot be empty");
    }

    try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) {
            throw new Error("Post not found");
        }

        const postData = postSnap.data();

        if (postData.authorId !== auth.currentUser.uid) {
            throw new Error("You can only edit your own posts");
        }

        const updateData = {
            content: newContent.trim(),
            updatedAt: serverTimestamp()
        };

        if (newVisibility) {
            updateData.visibility = newVisibility;
        }

        await updateDoc(postRef, updateData);
        return true;
    } catch (error) {
        console.error("Error updating post:", error);
        throw error;
    }
}