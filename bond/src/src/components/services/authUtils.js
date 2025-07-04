import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile
} from 'firebase/auth';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    writeBatch  // ✅ Import writeBatch
} from 'firebase/firestore';
import { auth, db, isValidEmail, isStrongPassword, isValidUsername } from './firebase';

// Check if username is available
export async function isUsernameAvailable(username) {
    try {
        console.log('🔍 Checking username availability:', username);
        const docRef = doc(db, "usernames", username.toLowerCase());
        const docSnap = await getDoc(docRef);
        const available = !docSnap.exists();
        console.log('🔍 Username available:', available);
        return available;
    } catch (error) {
        console.error("❌ Error checking username availability:", error);
        return true;
    }
}

// Get email from username
export async function getEmailFromUsername(username) {
    try {
        console.log('🔍 Looking up email for username:', username);
        const docRef = doc(db, "usernames", username.toLowerCase());
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const email = docSnap.data().email;
            console.log('✅ Found email for username');
            return email;
        } else {
            throw new Error("Username not found");
        }
    } catch (error) {
        console.error("❌ Error getting email from username:", error);
        throw error;
    }
}

// Get username from user ID
export async function getUserUsername(uid) {
    try {
        console.log('🔍 Getting username for UID:', uid);
        const usernamesQuery = query(collection(db, "usernames"), where("uid", "==", uid));
        const querySnapshot = await getDocs(usernamesQuery);

        if (!querySnapshot.empty) {
            const username = querySnapshot.docs[0].id;
            console.log('✅ Found username:', username);
            return username;
        } else {
            console.log('⚠️ No username found for UID, returning "User"');
            return "User";
        }
    } catch (error) {
        console.error("❌ Error getting username:", error);
        return "User";
    }
}

// ✅ OPTIMIZED: Register new user with BATCH WRITES
export async function registerUser(email, password, username, rememberMe = false) {
    console.log('🚀 Starting registration process:', { email, username, rememberMe });

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
        console.log('🔐 Setting persistence and creating user...');

        // Set persistence
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        console.log('✅ Persistence set:', rememberMe ? 'Local' : 'Session');

        // Create user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('✅ User created successfully:', user.uid);

        // ✅ BATCH WRITE: All Firestore operations in a single batch
        console.log('📝 Creating batch write for user data...');
        const batch = writeBatch(db);

        // Username mapping document
        const usernameRef = doc(db, "usernames", username.toLowerCase());
        batch.set(usernameRef, {
            uid: user.uid,
            email: email,
            displayName: username,
            createdAt: new Date().toISOString()
        });

        // User profile document
        const userRef = doc(db, "users", user.uid);
        batch.set(userRef, {
            email: email,
            username: username.toLowerCase(),
            displayName: username,
            createdAt: new Date().toISOString(),
            profilePicture: null,
            bio: "",
            friends: [],
            friendRequests: [],
            sentRequests: [],
            isOnline: false,
            lastSeen: new Date()
        });

        // ✅ COMMIT BATCH - Single write operation instead of 2 separate writes
        await batch.commit();
        console.log('✅ Batch write completed successfully');

        // Update Firebase Auth profile (this is separate from Firestore)
        try {
            await updateProfile(user, {
                displayName: username
            });
            console.log('✅ Firebase Auth profile updated with displayName');
        } catch (profileError) {
            console.error("⚠️ Error updating Firebase Auth profile:", profileError);
            // Don't fail registration for this
        }

        return user;
    } catch (error) {
        console.error("❌ Registration error:", error);
        console.error("❌ Error code:", error.code);
        console.error("❌ Error message:", error.message);

        // Provide more specific error messages
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("This email is already registered. Please use a different email or try logging in.");
        } else if (error.code === 'auth/weak-password') {
            throw new Error("Password is too weak. Please choose a stronger password.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Invalid email address format.");
        } else if (error.code === 'auth/invalid-credential') {
            throw new Error("Invalid credentials provided. Please check your email and password.");
        } else {
            throw new Error(error.message || "Registration failed. Please try again.");
        }
    }
}

// Login user (supports email or username)
export async function loginUser(emailOrUsername, password, rememberMe = false) {
    console.log('🚀 Starting login process:', { emailOrUsername, rememberMe });

    let email = emailOrUsername;

    try {
        // Check if input is email or username
        if (!isValidEmail(emailOrUsername)) {
            console.log('🔍 Input appears to be username, looking up email...');
            email = await getEmailFromUsername(emailOrUsername);
        } else {
            console.log('✅ Input is valid email format');
        }

        console.log('🔐 Setting persistence and signing in...');

        // Set persistence
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        console.log('✅ Persistence set:', rememberMe ? 'Local' : 'Session');

        // Sign in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Get user profile to update Firebase Auth displayName if needed
        try {
            const userProfile = await getCurrentUserProfile();
            if (userProfile && userProfile.displayName && !userCredential.user.displayName) {
                await updateProfile(userCredential.user, {
                    displayName: userProfile.displayName
                });
                console.log('✅ Updated Firebase Auth displayName from profile');
            }
        } catch (profileError) {
            console.error("⚠️ Error updating displayName on login:", profileError);
        }

        console.log('✅ Login successful:', userCredential.user.uid);
        return userCredential.user;

    } catch (error) {
        console.error("❌ Login error:", error);
        console.error("❌ Error code:", error.code);
        console.error("❌ Error message:", error.message);

        // Provide user-friendly error messages
        if (error.code === 'auth/invalid-credential') {
            throw new Error("Invalid email/username or password. Please check your credentials and try again.");
        } else if (error.code === 'auth/user-not-found') {
            throw new Error("No account found with this email/username. Please check your credentials or register for a new account.");
        } else if (error.code === 'auth/wrong-password') {
            throw new Error("Incorrect password. Please try again or reset your password.");
        } else if (error.code === 'auth/too-many-requests') {
            throw new Error("Too many failed login attempts. Please try again later or reset your password.");
        } else {
            throw new Error(error.message || "Login failed. Please try again.");
        }
    }
}

// Reset password (supports email or username)
export async function resetPassword(emailOrUsername) {
    console.log('🚀 Starting password reset for:', emailOrUsername);

    let email = emailOrUsername;

    try {
        // Check if input is email or username
        if (!isValidEmail(emailOrUsername)) {
            console.log('🔍 Input appears to be username, looking up email...');
            email = await getEmailFromUsername(emailOrUsername);
        }

        await sendPasswordResetEmail(auth, email);
        console.log('✅ Password reset email sent to:', email);
        return true;
    } catch (error) {
        console.error("❌ Password reset error:", error);
        console.error("❌ Error code:", error.code);

        if (error.code === 'auth/user-not-found') {
            throw new Error("No account found with this email/username.");
        } else {
            throw error;
        }
    }
}

// Get current user's profile data
export async function getCurrentUserProfile() {
    if (!auth.currentUser) return null;

    try {
        console.log('🔍 Getting current user profile...');
        const docRef = doc(db, "users", auth.currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log('✅ User profile found');
            return {
                ...docSnap.data(),
                // Ensure we always return the current displayName from auth or firestore
                displayName: docSnap.data().displayName || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0]
            };
        } else {
            console.log('⚠️ No user profile found');
            return null;
        }
    } catch (error) {
        console.error("❌ Error getting user profile:", error);
        return null;
    }
}

// Get user's friends list (for real-time posts)
export async function getUserFriends(userId) {
    try {
        console.log('🔍 Getting friends list for user:', userId);
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const friends = docSnap.data().friends || [];
            console.log('✅ Found friends:', friends.length);
            return friends;
        } else {
            console.log('⚠️ User document not found');
            return [];
        }
    } catch (error) {
        console.error("❌ Error getting user friends:", error);
        return [];
    }
}