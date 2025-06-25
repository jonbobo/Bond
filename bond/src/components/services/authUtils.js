// services/authUtils.js
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from 'firebase/auth';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    getDoc
} from 'firebase/firestore';
import { auth, db, isValidEmail, isStrongPassword, isValidUsername } from './firebase';

// Check if username is available
export async function isUsernameAvailable(username) {
    try {
        const docRef = doc(db, "usernames", username.toLowerCase());
        const docSnap = await getDoc(docRef);
        return !docSnap.exists();
    } catch (error) {
        console.error("Error checking username availability:", error);
        throw new Error("Unable to check username availability");
    }
}

// Get email from username
export async function getEmailFromUsername(username) {
    try {
        const docRef = doc(db, "usernames", username.toLowerCase());
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().email;
        } else {
            throw new Error("Username not found");
        }
    } catch (error) {
        console.error("Error getting email from username:", error);
        throw error;
    }
}

// Get username from user ID
export async function getUserUsername(uid) {
    try {
        // Search through usernames collection to find the document where uid matches
        const usernamesQuery = query(collection(db, "usernames"), where("uid", "==", uid));
        const querySnapshot = await getDocs(usernamesQuery);

        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].id; // Document ID is the username
        } else {
            return "User";
        }
    } catch (error) {
        console.error("Error getting username:", error);
        return "User";
    }
}

// Register new user
export async function registerUser(email, password, username, rememberMe = false) {
    // Validation
    if (!isValidEmail(email)) {
        throw new Error("Invalid email format");
    }

    if (!isStrongPassword(password)) {
        throw new Error("Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character");
    }

    if (!isValidUsername(username)) {
        throw new Error("Username must be 3-20 characters long and contain only letters, numbers, and underscores");
    }

    // Check username availability
    const usernameAvailable = await isUsernameAvailable(username);
    if (!usernameAvailable) {
        throw new Error("Username is already taken. Please choose a different username");
    }

    try {
        // Set persistence
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        // Create user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Store username in Firestore (document ID = username, contains user data)
        await setDoc(doc(db, "usernames", username.toLowerCase()), {
            uid: user.uid,
            email: email,
            displayName: username,
            createdAt: new Date().toISOString()
        });

        // Store user profile in separate users collection
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            username: username.toLowerCase(),
            displayName: username,
            createdAt: new Date().toISOString(),
            profilePicture: null,
            bio: ""
        });

        return user;
    } catch (error) {
        console.error("Registration error:", error);
        throw error;
    }
}

// Login user (supports email or username)
export async function loginUser(emailOrUsername, password, rememberMe = false) {
    let email = emailOrUsername;

    try {
        // Check if input is email or username
        if (!isValidEmail(emailOrUsername)) {
            email = await getEmailFromUsername(emailOrUsername);
        }

        // Set persistence
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        // Sign in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Login error:", error);
        throw error;
    }
}

// Reset password (supports email or username)
export async function resetPassword(emailOrUsername) {
    let email = emailOrUsername;

    try {
        // Check if input is email or username
        if (!isValidEmail(emailOrUsername)) {
            email = await getEmailFromUsername(emailOrUsername);
        }

        await sendPasswordResetEmail(auth, email);
        return true;
    } catch (error) {
        console.error("Password reset error:", error);
        throw error;
    }
}

// Get current user's profile data
export async function getCurrentUserProfile() {
    if (!auth.currentUser) return null;

    try {
        const docRef = doc(db, "users", auth.currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting user profile:", error);
        return null;
    }
}