/**
 * NookVibe Firebase Abstraction Layer
 * ====================================
 * Central module for all Firebase interactions.
 * Falls back to localStorage when Firebase is not configured or unavailable.
 *
 * SETUP: Replace the firebaseConfig object below with your Firebase project credentials.
 * Get them from: https://console.firebase.google.com → Project Settings → Your Apps → Web App
 */

// ============================================================
// CONFIGURATION — Replace with your Firebase project credentials
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyAcpoqbDOZyCCcIZuUSTwoDJiE6xou2hws",
    authDomain: "nookvibe-797d9.firebaseapp.com",
    projectId: "nookvibe-797d9",
    storageBucket: "nookvibe-797d9.firebasestorage.app",
    messagingSenderId: "258370812918",
    appId: "1:258370812918:web:76faa93dae6bb7365fa5d7",
    measurementId: "G-94SGN8EQVK"
};

// ============================================================
// STATE
// ============================================================
let _firebaseApp = null;
let _firebaseAuth = null;
let _firebaseDB = null;
let _firebaseStorage = null;
let _firebaseRealtimeDB = null;
let _isFirebaseReady = false;
let _currentUser = null;
let _authListeners = [];

/**
 * Check if Firebase is properly configured (has real credentials)
 */
function isFirebaseConfigured() {
    return firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0 && firebaseConfig.projectId && firebaseConfig.projectId.length > 0;
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize Firebase SDK. Safe to call multiple times.
 * Returns true if Firebase is ready, false if falling back to localStorage.
 */
function initFirebase() {
    if (_isFirebaseReady) return true;
    if (!isFirebaseConfigured()) {
        console.warn('[NookVibe] Firebase not configured — using localStorage fallback. Set credentials in firebase.js to enable cloud sync.');
        return false;
    }

    try {
        // Firebase SDKs should be loaded via script tags in HTML before this file
        if (typeof firebase === 'undefined') {
            console.warn('[NookVibe] Firebase SDK not loaded. Add Firebase scripts to your HTML.');
            return false;
        }

        _firebaseApp = firebase.initializeApp(firebaseConfig);
        _firebaseAuth = firebase.auth();
        _firebaseDB = firebase.firestore();
        _firebaseStorage = firebase.storage();

        // Enable Firestore offline persistence
        _firebaseDB.enablePersistence({ synchronizeTabs: true }).catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('[NookVibe] Firestore persistence: Multiple tabs open. Persistence only works in one tab.');
            } else if (err.code === 'unimplemented') {
                console.warn('[NookVibe] Firestore persistence: Browser does not support offline persistence.');
            }
        });

        // Optional: Realtime Database for chat
        if (firebase.database) {
            _firebaseRealtimeDB = firebase.database();
        }

        // Listen for auth state changes
        _firebaseAuth.onAuthStateChanged(user => {
            _currentUser = user;
            _authListeners.forEach(cb => cb(user));
        });

        _isFirebaseReady = true;
        console.log('[NookVibe] Firebase initialized successfully.');
        return true;
    } catch (err) {
        console.error('[NookVibe] Firebase initialization failed:', err);
        return false;
    }
}

// ============================================================
// FIREBASE AUTH
// ============================================================
const NookFireAuth = {
    /**
     * Create account with email and password
     * @param {string} email
     * @param {string} password
     * @param {object} profileData - { name, handle, goal, genre, avatar }
     */
    async signUp(email, password, profileData) {
        if (!_isFirebaseReady) return _localFallback.createAccount(profileData);

        const cred = await _firebaseAuth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;

        // Save profile to Firestore
        await _firebaseDB.collection('users').doc(uid).set({
            ...profileData,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isPro: false
        });

        // Also save locally for instant access
        localStorage.setItem('bookapp_user', JSON.stringify({ ...profileData, uid, email }));
        return { uid, ...profileData };
    },

    /**
     * Sign in with email and password
     */
    async signIn(email, password) {
        if (!_isFirebaseReady) return _localFallback.login();

        const cred = await _firebaseAuth.signInWithEmailAndPassword(email, password);
        const uid = cred.user.uid;

        // Fetch profile from Firestore
        const doc = await _firebaseDB.collection('users').doc(uid).get();
        if (doc.exists) {
            const profile = doc.data();
            localStorage.setItem('bookapp_user', JSON.stringify({ ...profile, uid }));
            try { await pullCloudData(uid); } catch(e) {}
            return { uid, ...profile };
        }
        return null;
    },

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        if (!_isFirebaseReady) {
            alert('Firebase no está configurado. Configura las credenciales en firebase.js para usar Google Sign-In.');
            return null;
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await _firebaseAuth.signInWithPopup(provider);
        const uid = result.user.uid;
        const isNewUser = result.additionalUserInfo?.isNewUser;

        if (isNewUser) {
            // Create profile for new Google user
            const profile = {
                name: result.user.displayName || 'Usuario',
                handle: '@' + (result.user.displayName || 'user').toLowerCase().replace(/\s+/g, '_'),
                avatar: result.user.photoURL || '',
                goal: 25,
                genre: 'fiction',
                email: result.user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isPro: false
            };
            await _firebaseDB.collection('users').doc(uid).set(profile);
            localStorage.setItem('bookapp_user', JSON.stringify({ ...profile, uid }));
            return { uid, ...profile, isNewUser: true };
        } else {
            // Fetch existing profile
            const doc = await _firebaseDB.collection('users').doc(uid).get();
            if (doc.exists) {
                const profile = doc.data();
                localStorage.setItem('bookapp_user', JSON.stringify({ ...profile, uid }));
                return { uid, ...profile, isNewUser: false };
            }
        }
        return null;
    },

    /**
     * Sign out
     */
    async signOut() {
        if (_isFirebaseReady) {
            await _firebaseAuth.signOut();
        }
        localStorage.removeItem('bookapp_session');
        // Don't clear user data — allow re-login
    },

    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        if (_isFirebaseReady && _currentUser) {
            return { uid: _currentUser.uid, email: _currentUser.email };
        }
        return null;
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        if (_isFirebaseReady) return !!_currentUser;
        // Fallback to localStorage session check
        return !!localStorage.getItem('bookapp_session');
    },

    /**
     * Register a callback for auth state changes
     */
    onAuthChange(callback) {
        _authListeners.push(callback);
        // Immediately call with current state
        if (_isFirebaseReady && _currentUser) {
            callback(_currentUser);
        }
    }
};

// ============================================================
// FIRESTORE DATABASE
// ============================================================
const NookFireDB = {
    // --- User Profile ---
    async saveUserProfile(uid, data) {
        if (!_isFirebaseReady) {
            localStorage.setItem('bookapp_user', JSON.stringify(data));
            return;
        }
        await _firebaseDB.collection('users').doc(uid).update(data);
        // Also update local cache
        const local = JSON.parse(localStorage.getItem('bookapp_user') || '{}');
        localStorage.setItem('bookapp_user', JSON.stringify({ ...local, ...data }));
    },

    async getUserProfile(uid) {
        if (!_isFirebaseReady) {
            return JSON.parse(localStorage.getItem('bookapp_user'));
        }
        const doc = await _firebaseDB.collection('users').doc(uid).get();
        return doc.exists ? doc.data() : null;
    },

    // --- Books ---
    async getBooks(uid) {
        if (!_isFirebaseReady) {
            return JSON.parse(localStorage.getItem('bookapp_books') || '[]');
        }
        const snapshot = await _firebaseDB.collection('users').doc(uid).collection('books').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async saveBook(uid, book) {
        if (!_isFirebaseReady) {
            const books = JSON.parse(localStorage.getItem('bookapp_books') || '[]');
            const idx = books.findIndex(b => b.id === book.id);
            if (idx !== -1) {
                books[idx] = book;
            } else {
                books.unshift(book);
            }
            localStorage.setItem('bookapp_books', JSON.stringify(books));
            return book;
        }
        const bookRef = _firebaseDB.collection('users').doc(uid).collection('books').doc(book.id);
        await bookRef.set(book, { merge: true });
        return book;
    },

    async addBook(uid, book) {
        if (!_isFirebaseReady) {
            const books = JSON.parse(localStorage.getItem('bookapp_books') || '[]');
            book.id = book.id || Date.now().toString();
            books.unshift(book);
            localStorage.setItem('bookapp_books', JSON.stringify(books));
            return book;
        }
        const ref = _firebaseDB.collection('users').doc(uid).collection('books').doc();
        book.id = ref.id;
        await ref.set(book);
        return book;
    },

    async deleteBook(uid, bookId) {
        if (!_isFirebaseReady) {
            const books = JSON.parse(localStorage.getItem('bookapp_books') || '[]').filter(b => b.id !== bookId);
            localStorage.setItem('bookapp_books', JSON.stringify(books));
            return;
        }
        await _firebaseDB.collection('users').doc(uid).collection('books').doc(bookId).delete();
    },

    // --- Friends ---
    async getFriends(uid) {
        if (!_isFirebaseReady) {
            return JSON.parse(localStorage.getItem('bookapp_friends') || '[]');
        }
        const snapshot = await _firebaseDB.collection('users').doc(uid).collection('friends').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async saveFriends(uid, friends) {
        if (!_isFirebaseReady) {
            localStorage.setItem('bookapp_friends', JSON.stringify(friends));
            return;
        }
        const batch = _firebaseDB.batch();
        friends.forEach(friend => {
            const ref = _firebaseDB.collection('users').doc(uid).collection('friends').doc(friend.id);
            batch.set(ref, friend);
        });
        await batch.commit();
    },

    // --- Streaks ---
    async saveStreak(uid, dateStr, pages) {
        if (!_isFirebaseReady) {
            const streaks = JSON.parse(localStorage.getItem('bookapp_streaks') || '{}');
            streaks[dateStr] = (streaks[dateStr] || 0) + pages;
            localStorage.setItem('bookapp_streaks', JSON.stringify(streaks));
            return;
        }
        await _firebaseDB.collection('users').doc(uid).collection('streaks').doc(dateStr).set({
            pages: firebase.firestore.FieldValue.increment(pages)
        }, { merge: true });
    },

    async getStreaks(uid) {
        if (!_isFirebaseReady) {
            return JSON.parse(localStorage.getItem('bookapp_streaks') || '{}');
        }
        const snapshot = await _firebaseDB.collection('users').doc(uid).collection('streaks').get();
        const streaks = {};
        snapshot.docs.forEach(doc => { streaks[doc.id] = doc.data().pages || 0; });
        return streaks;
    },

    // --- Activities (Social Feed) ---
    async postActivity(uid, activity) {
        if (!_isFirebaseReady) return; // No social feed without Firebase
        await _firebaseDB.collection('activities').add({
            userId: uid,
            ...activity,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async getFeedActivities(friendIds, limit = 20) {
        if (!_isFirebaseReady) return [];
        if (friendIds.length === 0) return [];

        // Firestore 'in' queries support max 30 items
        const chunks = [];
        for (let i = 0; i < friendIds.length; i += 30) {
            chunks.push(friendIds.slice(i, i + 30));
        }

        const activities = [];
        for (const chunk of chunks) {
            const snapshot = await _firebaseDB.collection('activities')
                .where('userId', 'in', chunk)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            snapshot.docs.forEach(doc => activities.push({ id: doc.id, ...doc.data() }));
        }
        return activities.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).slice(0, limit);
    },

    // --- Likes ---
    async toggleLike(activityId, uid) {
        if (!_isFirebaseReady) {
            // Fallback to localStorage
            const likes = JSON.parse(localStorage.getItem('bookapp_likes') || '{}');
            const user = JSON.parse(localStorage.getItem('bookapp_user') || '{}');
            if (!likes[activityId]) likes[activityId] = [];
            const idx = likes[activityId].indexOf(user.name);
            if (idx === -1) {
                likes[activityId].push(user.name);
            } else {
                likes[activityId].splice(idx, 1);
            }
            localStorage.setItem('bookapp_likes', JSON.stringify(likes));
            return idx === -1;
        }
        const likeRef = _firebaseDB.collection('activities').doc(activityId).collection('likes').doc(uid);
        const likeDoc = await likeRef.get();
        if (likeDoc.exists) {
            await likeRef.delete();
            return false;
        } else {
            await likeRef.set({ timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            return true;
        }
    },

    // --- User Search (for social) ---
    async searchUsers(query, limit = 10) {
        if (!_isFirebaseReady) {
            // Search in local friends only
            const friends = JSON.parse(localStorage.getItem('bookapp_friends') || '[]');
            const q = query.toLowerCase();
            return friends.filter(f => f.name.toLowerCase().includes(q) || (f.handle && f.handle.toLowerCase().includes(q)));
        }
        // Firestore doesn't support full-text search, so we do prefix matching
        const snapshot = await _firebaseDB.collection('users')
            .where('handle', '>=', query.toLowerCase())
            .where('handle', '<=', query.toLowerCase() + '\uf8ff')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    }
};

// ============================================================
// FIREBASE STORAGE (Avatars)
// ============================================================
const NookFireStorage = {
    async uploadAvatar(uid, base64Data) {
        if (!_isFirebaseReady) {
            // Keep in localStorage as base64
            return base64Data;
        }
        const ref = _firebaseStorage.ref(`avatars/${uid}/profile.jpg`);
        await ref.putString(base64Data, 'data_url');
        return await ref.getDownloadURL();
    },

    async getAvatarUrl(uid) {
        if (!_isFirebaseReady) return null;
        try {
            return await _firebaseStorage.ref(`avatars/${uid}/profile.jpg`).getDownloadURL();
        } catch {
            return null;
        }
    }
};

// ============================================================
// REALTIME DATABASE (Chat)
// ============================================================
const NookFireChat = {
    /**
     * Send a chat message
     */
    async sendMessage(conversationId, fromUid, text) {
        if (!_isFirebaseReady || !_firebaseRealtimeDB) {
            // Fallback to localStorage
            const msgs = JSON.parse(localStorage.getItem('bookapp_messages') || '[]');
            msgs.push({
                id: 'msg_' + Date.now(),
                conversationId,
                from: fromUid,
                text,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('bookapp_messages', JSON.stringify(msgs));
            return;
        }
        const ref = _firebaseRealtimeDB.ref(`chats/${conversationId}/messages`).push();
        await ref.set({
            from: fromUid,
            text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    },

    /**
     * Listen for new messages in a conversation
     * @returns {function} Unsubscribe function
     */
    onMessages(conversationId, callback) {
        if (!_isFirebaseReady || !_firebaseRealtimeDB) {
            // Return local messages once
            const msgs = JSON.parse(localStorage.getItem('bookapp_messages') || '[]')
                .filter(m => m.conversationId === conversationId);
            callback(msgs);
            return () => {}; // no-op unsubscribe
        }
        const ref = _firebaseRealtimeDB.ref(`chats/${conversationId}/messages`).orderByChild('timestamp').limitToLast(50);
        ref.on('value', snapshot => {
            const msgs = [];
            snapshot.forEach(child => {
                msgs.push({ id: child.key, ...child.val() });
            });
            callback(msgs);
        });
        return () => ref.off('value');
    },

    /**
     * Get or create a conversation ID between two users
     */
    getConversationId(uid1, uid2) {
        return [uid1, uid2].sort().join('_');
    }
};

// ============================================================
// LOCAL STORAGE MIGRATION
// ============================================================

/**
 * Migrate data from localStorage to Firestore.
 * Call this after a user signs in if they have local data.
 */
async function migrateLocalDataToFirestore(uid) {
    if (!_isFirebaseReady) return;

    const localBooks = JSON.parse(localStorage.getItem('bookapp_books') || '[]');
    const localFriends = JSON.parse(localStorage.getItem('bookapp_friends') || '[]');
    const localStreaks = JSON.parse(localStorage.getItem('bookapp_streaks') || '{}');

    if (localBooks.length > 0) {
        console.log(`[NookVibe] Migrating ${localBooks.length} books to Firestore...`);
        const batch = _firebaseDB.batch();
        localBooks.forEach(book => {
            const ref = _firebaseDB.collection('users').doc(uid).collection('books').doc(book.id || Date.now().toString());
            batch.set(ref, book);
        });
        await batch.commit();
        // Clear local after successful migration
        localStorage.removeItem('bookapp_books');
        console.log('[NookVibe] Books migrated successfully.');
    }

    if (localFriends.length > 0) {
        await NookFireDB.saveFriends(uid, localFriends);
        localStorage.removeItem('bookapp_friends');
        console.log('[NookVibe] Friends migrated successfully.');
    }

    if (Object.keys(localStreaks).length > 0) {
        const batch2 = _firebaseDB.batch();
        Object.entries(localStreaks).forEach(([date, pages]) => {
            const ref = _firebaseDB.collection('users').doc(uid).collection('streaks').doc(date);
            batch2.set(ref, { pages });
        });
        await batch2.commit();
        localStorage.removeItem('bookapp_streaks');
        console.log('[NookVibe] Streaks migrated successfully.');
    }
}

/**
 * Pull data from Firestore into localStorage to sync state
 */
async function pullCloudData(uid) {
    if (!_isFirebaseReady) return;
    try {
        const books = await NookFireDB.getBooks(uid);
        if (books && books.length > 0) localStorage.setItem('bookapp_books', JSON.stringify(books));
        
        const friends = await NookFireDB.getFriends(uid);
        if (friends && friends.length > 0) localStorage.setItem('bookapp_friends', JSON.stringify(friends));
        
        const streaks = await NookFireDB.getStreaks(uid);
        if (streaks && Object.keys(streaks).length > 0) localStorage.setItem('bookapp_streaks', JSON.stringify(streaks));
        
        console.log('[NookVibe] Cloud data pulled successfully.');
    } catch(err) {
        console.error("[NookVibe] Error pulling cloud data", err);
    }
}
window.pullCloudData = pullCloudData;

// ============================================================
// LOCAL FALLBACK (mirrors existing auth.js behavior)
// ============================================================
const _localFallback = {
    createAccount(userData) {
        const user = {
            name: userData.name,
            handle: userData.handle,
            goal: userData.goal || 25,
            genre: userData.genre || 'fiction',
            avatar: userData.avatar,
            createdAt: userData.createdAt || new Date().toISOString(),
            isGuest: userData.isGuest || false
        };
        localStorage.setItem('bookapp_user', JSON.stringify(user));
        localStorage.setItem('bookapp_session', JSON.stringify({
            loggedInAt: Date.now(),
            userId: 'user_' + Date.now().toString(36),
            isGuest: user.isGuest
        }));
        return user;
    },
    login() {
        const user = localStorage.getItem('bookapp_user');
        if (!user) return null;
        localStorage.setItem('bookapp_session', JSON.stringify({
            loggedInAt: Date.now(),
            userId: 'user_' + Date.now().toString(36)
        }));
        return JSON.parse(user);
    }
};

// ============================================================
// AUTO-INIT
// ============================================================
// Try to initialize Firebase when this script loads
const _firebaseEnabled = initFirebase();
