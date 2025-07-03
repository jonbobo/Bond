// components/services/postUtils.js
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

// Create a new post
export async function createPost(content, visibility = 'friends') {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to create a post");
    }

    if (!content || content.trim().length === 0) {
        throw new Error("Post content cannot be empty");
    }

    try {
        const postData = {
            content: content.trim(),
            authorId: auth.currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            visibility: visibility, // 'public', 'friends', 'private'
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

// Get user's friends list
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

// Check if two users are friends
export async function areFriends(userId1, userId2) {
    if (userId1 === userId2) return true; // User can see their own posts

    try {
        const friends = await getUserFriends(userId1);
        return friends.includes(userId2);
    } catch (error) {
        console.error("Error checking friendship:", error);
        return false;
    }
}

// Get posts for user's feed (their posts + friends' posts)
export async function getFeedPosts(userId, limitCount = 20) {
    try {
        // Get user's friends
        const friends = await getUserFriends(userId);
        const allowedUserIds = [userId, ...friends]; // Include user's own posts

        if (allowedUserIds.length === 0) {
            return [];
        }

        // Query posts from user and friends
        const postsQuery = query(
            collection(db, "posts"),
            where("authorId", "in", allowedUserIds),
            where("visibility", "in", ["friends", "public"]),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(postsQuery);
        const posts = [];

        for (const docSnap of querySnapshot.docs) {
            const postData = docSnap.data();

            // Additional privacy check
            if (postData.visibility === 'friends' && postData.authorId !== userId) {
                const isFriend = await areFriends(userId, postData.authorId);
                if (!isFriend) continue;
            }

            // Get author information
            const authorDoc = await getDoc(doc(db, "users", postData.authorId));
            const authorData = authorDoc.exists() ? authorDoc.data() : null;

            posts.push({
                id: docSnap.id,
                ...postData,
                author: {
                    id: postData.authorId,
                    username: authorData?.username || 'Unknown',
                    displayName: authorData?.displayName || 'Unknown User',
                    profilePicture: authorData?.profilePicture || null
                }
            });
        }

        return posts;
    } catch (error) {
        console.error("Error getting feed posts:", error);
        throw new Error("Failed to load posts");
    }
}

// Get posts by a specific user (with privacy checks)
export async function getUserPosts(authorId, viewerId, limitCount = 20) {
    try {
        // Check if viewer can see these posts
        if (authorId !== viewerId) {
            const isFriend = await areFriends(viewerId, authorId);
            if (!isFriend) {
                return []; // Not friends, can't see posts
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

        // Get author information
        const authorDoc = await getDoc(doc(db, "users", authorId));
        const authorData = authorDoc.exists() ? authorDoc.data() : null;

        querySnapshot.forEach((docSnap) => {
            const postData = docSnap.data();

            // Privacy check for individual posts
            if (postData.visibility === 'private' && authorId !== viewerId) {
                return; // Skip private posts if not the author
            }

            if (postData.visibility === 'friends' && authorId !== viewerId) {
                // Additional friend check already done above
            }

            posts.push({
                id: docSnap.id,
                ...postData,
                author: {
                    id: authorId,
                    username: authorData?.username || 'Unknown',
                    displayName: authorData?.displayName || 'Unknown User',
                    profilePicture: authorData?.profilePicture || null
                }
            });
        });

        return posts;
    } catch (error) {
        console.error("Error getting user posts:", error);
        throw new Error("Failed to load user posts");
    }
}

// Like/unlike a post
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

        if (isLiked) {
            // Unlike the post
            await updateDoc(postRef, {
                likes: arrayRemove(userId),
                likeCount: Math.max(0, (postData.likeCount || 0) - 1),
                updatedAt: serverTimestamp()
            });
        } else {
            // Like the post
            await updateDoc(postRef, {
                likes: arrayUnion(userId),
                likeCount: (postData.likeCount || 0) + 1,
                updatedAt: serverTimestamp()
            });
        }

        return !isLiked; // Return new like state
    } catch (error) {
        console.error("Error toggling post like:", error);
        throw new Error("Failed to update like");
    }
}

// Delete a post (only by author)
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

        // Check if user is the author
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

// Update post content (only by author)
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

        // Check if user is the author
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