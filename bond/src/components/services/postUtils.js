// components/services/postUtils.js - COST-OPTIMIZED WITH PAGINATION
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
    serverTimestamp,
    increment,
    writeBatch,
    onSnapshot,
    startAfter
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
            likeCount: 0,
            commentCount: 0  // ✅ Only store count, not actual comments
        };

        const docRef = await addDoc(collection(db, "posts"), postData);
        return docRef.id;
    } catch (error) {
        console.error("Error creating post:", error);
        throw new Error("Failed to create post");
    }
}

// 💰 COST-OPTIMIZED: Add comment as separate document + increment counter
export async function addComment(postId, content) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to comment");
    }

    if (!content || content.trim().length === 0) {
        throw new Error("Comment content cannot be empty");
    }

    // Reasonable limit to prevent abuse
    if (content.length > 500) {
        throw new Error("Comment too long. Maximum 500 characters.");
    }

    try {
        // Get current user data for comment author info
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};

        // Get current post to check permissions
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) {
            throw new Error("Post not found");
        }

        const postData = postSnap.data();

        // Check if user can comment (friends or public posts)
        if (postData.visibility === 'private' && postData.authorId !== auth.currentUser.uid) {
            const areFriendsResult = await areFriends(auth.currentUser.uid, postData.authorId);
            if (!areFriendsResult) {
                throw new Error("You don't have permission to comment on this post");
            }
        }

        // ✅ WRITE OPTIMIZATION: Use batch write for atomicity (2 writes total)
        const batch = writeBatch(db);

        // Create comment as separate document in subcollection
        const commentData = {
            content: content.trim(),
            authorId: auth.currentUser.uid,
            author: {
                id: auth.currentUser.uid,
                username: userData.username || 'unknown',
                displayName: userData.displayName || auth.currentUser.displayName || 'Unknown User',
                profilePicture: userData.profilePicture || null
            },
            postId: postId,
            createdAt: serverTimestamp(),
            likeCount: 0,
            likes: [] // Keep small for quick like checks
        };

        // Add comment to subcollection
        const commentRef = doc(collection(db, "posts", postId, "comments"));
        batch.set(commentRef, commentData);

        // ✅ ONLY update comment count in post (not entire comments array)
        batch.update(postRef, {
            commentCount: increment(1),
            updatedAt: serverTimestamp()
        });

        // Execute batch write (2 writes total instead of rewriting entire post)
        await batch.commit();

        return {
            id: commentRef.id,
            ...commentData,
            createdAt: new Date() // For immediate UI update
        };
    } catch (error) {
        console.error("Error adding comment:", error);
        throw error;
    }
}

// 💰 COST-OPTIMIZED: Get comments with pagination support
export async function getPostComments(postId, limitCount = 20, startAfterDoc = null) {
    try {
        let commentsQuery = query(
            collection(db, "posts", postId, "comments"),
            orderBy("createdAt", "asc"), // Oldest first for proper pagination
            limit(limitCount + 1) // Get one extra to check if there are more
        );

        // Add pagination if provided
        if (startAfterDoc) {
            commentsQuery = query(
                collection(db, "posts", postId, "comments"),
                orderBy("createdAt", "asc"),
                startAfter(startAfterDoc),
                limit(limitCount + 1)
            );
        }

        const querySnapshot = await getDocs(commentsQuery);
        const comments = [];
        const docs = [];

        querySnapshot.forEach((docSnap) => {
            comments.push({
                id: docSnap.id,
                ...docSnap.data()
            });
            docs.push(docSnap);
        });

        // Check if there are more comments
        const hasMore = comments.length > limitCount;
        if (hasMore) {
            comments.pop(); // Remove the extra comment
            docs.pop(); // Remove the extra doc
        }

        // Get the last document for next pagination
        const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

        return {
            comments: comments || [],
            hasMore: hasMore || false,
            lastDoc: lastDoc || null
        };
    } catch (error) {
        console.error("Error getting comments:", error);
        // Return safe defaults on error
        return {
            comments: [],
            hasMore: false,
            lastDoc: null
        };
    }
}

// ✅ OPTIMIZED: Delete comment + decrement counter
export async function deleteComment(postId, commentId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to delete comments");
    }

    try {
        const commentRef = doc(db, "posts", postId, "comments", commentId);
        const commentSnap = await getDoc(commentRef);

        if (!commentSnap.exists()) {
            throw new Error("Comment not found");
        }

        const commentData = commentSnap.data();

        // Check permissions - only comment author or post author can delete
        const postSnap = await getDoc(doc(db, "posts", postId));
        const postData = postSnap.exists() ? postSnap.data() : null;

        if (commentData.authorId !== auth.currentUser.uid &&
            postData?.authorId !== auth.currentUser.uid) {
            throw new Error("You don't have permission to delete this comment");
        }

        // ✅ WRITE OPTIMIZATION: Batch delete + decrement (2 writes total)
        const batch = writeBatch(db);

        // Delete comment document
        batch.delete(commentRef);

        // Decrement comment count in post
        batch.update(doc(db, "posts", postId), {
            commentCount: increment(-1),
            updatedAt: serverTimestamp()
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error deleting comment:", error);
        throw error;
    }
}

// ✅ OPTIMIZED: Like comment without rewriting post (1 write only)
export async function toggleCommentLike(postId, commentId) {
    if (!auth.currentUser) {
        throw new Error("You must be logged in to like comments");
    }

    try {
        const commentRef = doc(db, "posts", postId, "comments", commentId);
        const commentSnap = await getDoc(commentRef);

        if (!commentSnap.exists()) {
            throw new Error("Comment not found");
        }

        const commentData = commentSnap.data();
        const userId = auth.currentUser.uid;
        const currentLikes = commentData.likes || [];
        const isLiked = currentLikes.includes(userId);

        // ✅ SINGLE WRITE: Update only the comment document
        if (isLiked) {
            await updateDoc(commentRef, {
                likes: arrayRemove(userId),
                likeCount: increment(-1)
            });
        } else {
            await updateDoc(commentRef, {
                likes: arrayUnion(userId),
                likeCount: increment(1)
            });
        }

        return {
            id: commentId,
            ...commentData,
            likes: isLiked
                ? currentLikes.filter(id => id !== userId)
                : [...currentLikes, userId],
            likeCount: (commentData.likeCount || 0) + (isLiked ? -1 : 1)
        };
    } catch (error) {
        console.error("Error toggling comment like:", error);
        throw error;
    }
}

// 💰 COST-OPTIMIZED: Real-time comments listener for recent comments only
export function subscribeToComments(postId, callback, limitCount = 20) {
    const commentsQuery = query(
        collection(db, "posts", postId, "comments"),
        orderBy("createdAt", "desc"), // Most recent first for real-time
        limit(limitCount) // Limit real-time to recent comments for cost control
    );

    return onSnapshot(commentsQuery, (querySnapshot) => {
        const comments = [];
        querySnapshot.forEach((docSnap) => {
            comments.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        callback(comments.reverse() || []); // Oldest first for UI, ensure array
    });
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

            posts.push({
                id: docSnap.id,
                ...postData
                // ✅ Comments are now loaded separately when needed
            });
        });

        return posts;
    } catch (error) {
        console.error("Error getting feed posts:", error);
        throw new Error("Failed to load posts");
    }
}

// ✅ OPTIMIZED: Post likes with increment (no read required)
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

        // ✅ SINGLE WRITE with increment for better performance
        if (isLiked) {
            await updateDoc(postRef, {
                likes: arrayRemove(userId),
                likeCount: increment(-1),
                updatedAt: serverTimestamp()
            });
        } else {
            await updateDoc(postRef, {
                likes: arrayUnion(userId),
                likeCount: increment(1),
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

        // ✅ TODO: Could optimize to batch delete all comments in subcollection
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