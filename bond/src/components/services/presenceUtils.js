// services/presenceUtils.js - FIXED VERSION
// Perfect online status using Firebase Realtime Database with automatic disconnect detection

import {
    ref,
    set,
    onDisconnect,
    onValue,
    serverTimestamp,
    off,
    get
} from 'firebase/database';
import { rtdb, auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

let presenceCleanupFunction = null;
let currentPresenceRef = null; // ✅ NEW: Track current presence ref for cleanup

// ✅ PERFECT: Setup presence with automatic disconnect detection
export function setupPresenceSystem() {
    console.log('🔄 Setting up Realtime Database presence system');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ User signed in, setting up presence for:', user.uid);
            await initializeUserPresence(user.uid);
        } else {
            console.log('🔄 User signed out, cleaning up presence');
            cleanupPresenceSystem();
        }
    });
}

// ✅ Initialize presence for a user with automatic offline detection
async function initializeUserPresence(userId) {
    try {
        const presenceRef = ref(rtdb, `presence/${userId}`);
        currentPresenceRef = presenceRef; // ✅ NEW: Store reference

        // ✅ PERFECT: What happens when user disconnects (closes browser, network dies, etc.)
        await onDisconnect(presenceRef).set({
            state: 'offline',
            lastSeen: serverTimestamp(),
            lastChanged: serverTimestamp()
        });

        // ✅ Set user online now that disconnect hook is set
        await set(presenceRef, {
            state: 'online',
            lastSeen: serverTimestamp(),
            lastChanged: serverTimestamp()
        });

        console.log('✅ Presence initialized with automatic disconnect detection');

        // ✅ Handle browser visibility changes for better presence
        const handleVisibilityChange = async () => {
            if (!auth.currentUser) return;

            if (document.visibilityState === 'visible') {
                // User came back to tab - mark online
                await set(presenceRef, {
                    state: 'online',
                    lastSeen: serverTimestamp(),
                    lastChanged: serverTimestamp()
                });
            } else {
                // User left tab - wait 30 seconds then mark offline
                setTimeout(async () => {
                    if (document.visibilityState !== 'visible' && auth.currentUser) {
                        await set(presenceRef, {
                            state: 'offline',
                            lastSeen: serverTimestamp(),
                            lastChanged: serverTimestamp()
                        });
                    }
                }, 30000); // 30 seconds delay
            }
        };

        // ✅ Handle network status changes
        const handleOnline = async () => {
            if (!auth.currentUser) return;
            await set(presenceRef, {
                state: 'online',
                lastSeen: serverTimestamp(),
                lastChanged: serverTimestamp()
            });
        };

        const handleOffline = async () => {
            if (!auth.currentUser) return;
            await set(presenceRef, {
                state: 'offline',
                lastSeen: serverTimestamp(),
                lastChanged: serverTimestamp()
            });
        };

        // Add event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // ✅ Store cleanup function
        presenceCleanupFunction = () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };

    } catch (error) {
        console.error('❌ Error setting up presence:', error);
    }
}

// ✅ FIXED: Force user offline (for logout) - Cancel disconnect handler first
export async function setUserOffline() {
    if (!auth.currentUser || !currentPresenceRef) return;

    try {
        // ✅ CRITICAL FIX: Cancel the onDisconnect handler first
        console.log('🔄 Canceling disconnect handler before manual offline...');
        await onDisconnect(currentPresenceRef).cancel();

        // ✅ Now manually set offline without interference
        await set(currentPresenceRef, {
            state: 'offline',
            lastSeen: serverTimestamp(),
            lastChanged: serverTimestamp()
        });

        console.log('✅ User manually set to offline (disconnect handler canceled)');
    } catch (error) {
        console.error('❌ Error setting user offline:', error);
        // ✅ Fallback: Try to set offline anyway
        try {
            await set(currentPresenceRef, {
                state: 'offline',
                lastSeen: serverTimestamp(),
                lastChanged: serverTimestamp()
            });
            console.log('⚠️ User set to offline (fallback after error)');
        } catch (fallbackError) {
            console.error('❌ Fallback offline setting also failed:', fallbackError);
        }
    }
}

// ✅ Subscribe to a single user's online status
export function subscribeToUserPresence(userId, callback) {
    if (!userId) {
        callback(false);
        return () => { };
    }

    const presenceRef = ref(rtdb, `presence/${userId}`);

    const unsubscribe = onValue(presenceRef, (snapshot) => {
        const data = snapshot.val();
        const isOnline = data ? data.state === 'online' : false;
        callback(isOnline, data?.lastSeen);
    }, (error) => {
        console.error('❌ Error listening to user presence:', error);
        callback(false);
    });

    // Return cleanup function
    return () => {
        off(presenceRef, 'value', unsubscribe);
    };
}

// ✅ Subscribe to multiple users' presence (for friends lists)
export function subscribeToMultipleUsersPresence(userIds, callback) {
    if (!userIds || userIds.length === 0) {
        callback({});
        return () => { };
    }

    const presenceData = {};
    const unsubscribes = [];

    userIds.forEach(userId => {
        const presenceRef = ref(rtdb, `presence/${userId}`);

        const unsubscribe = onValue(presenceRef, (snapshot) => {
            const data = snapshot.val();
            presenceData[userId] = {
                isOnline: data ? data.state === 'online' : false,
                lastSeen: data?.lastSeen || null
            };

            // Call callback with updated presence data
            callback({ ...presenceData });
        }, (error) => {
            console.error(`❌ Error listening to presence for ${userId}:`, error);
            presenceData[userId] = { isOnline: false, lastSeen: null };
            callback({ ...presenceData });
        });

        unsubscribes.push(() => off(presenceRef, 'value', unsubscribe));
    });

    // Return cleanup function that unsubscribes from all
    return () => {
        unsubscribes.forEach(cleanup => cleanup());
    };
}

// ✅ Get user's current presence status (one-time read)
export async function getUserPresence(userId) {
    if (!userId) return { isOnline: false, lastSeen: null };

    try {
        const presenceRef = ref(rtdb, `presence/${userId}`);
        const snapshot = await get(presenceRef);
        const data = snapshot.val();

        return {
            isOnline: data ? data.state === 'online' : false,
            lastSeen: data?.lastSeen || null
        };
    } catch (error) {
        console.error('❌ Error getting user presence:', error);
        return { isOnline: false, lastSeen: null };
    }
}

// ✅ UPDATED: Cleanup presence system with better cleanup
export function cleanupPresenceSystem() {
    console.log('🧹 Cleaning up presence system');

    if (presenceCleanupFunction) {
        presenceCleanupFunction();
        presenceCleanupFunction = null;
    }

    // ✅ NEW: Clear the current presence reference
    currentPresenceRef = null;
}

// ✅ Initialize the presence system when this module loads
setupPresenceSystem();