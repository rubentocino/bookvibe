/**
 * NookVibe Authentication Module
 * Manages user session with localStorage.
 * Structured for easy Firebase migration in the future.
 */

const AUTH_KEY = 'bookapp_auth';
const SESSION_KEY = 'bookapp_session';

/**
 * Check if user is logged in (has an active session)
 */
function isLoggedIn() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return false;
    
    try {
        const data = JSON.parse(session);
        // Session is valid if it exists and hasn't expired (30 days)
        if (data && data.loggedInAt) {
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            if (Date.now() - data.loggedInAt > thirtyDays) {
                // Session expired
                logout();
                return false;
            }
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

/**
 * Create a new account and log the user in
 */
function createAccount(userData) {
    // Save user profile
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

    // Create session
    const session = {
        loggedInAt: Date.now(),
        userId: generateUserId(),
        isGuest: user.isGuest
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Initialize default data for new users
    if (!localStorage.getItem('bookapp_books')) {
        initializeDefaultData();
    }
    
    // Safety check for existing users missing likes/messages
    if (!localStorage.getItem('bookapp_likes')) {
        localStorage.setItem('bookapp_likes', JSON.stringify({}));
        localStorage.setItem('bookapp_messages', JSON.stringify([]));
    }

    return user;
}

/**
 * Log in an existing user (for future Firebase integration)
 */
function login(credentials) {
    // For localStorage auth, we just check if user exists
    const user = localStorage.getItem('bookapp_user');
    if (!user) return null;

    const session = {
        loggedInAt: Date.now(),
        userId: generateUserId()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return JSON.parse(user);
}

/**
 * Log the user out
 */
function logout() {
    localStorage.removeItem(SESSION_KEY);
    // Don't clear user data - allow re-login
    window.location.replace('login.html');
}

/**
 * Log out and clear all data
 */
function logoutAndClear() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('bookapp_user');
    localStorage.removeItem('bookapp_books');
    localStorage.removeItem('bookapp_friends');
    localStorage.removeItem('bookapp_theme');
    localStorage.removeItem('bookapp_streaks');
    localStorage.removeItem('bookapp_notes');
    localStorage.removeItem('bookapp_sessions');
    window.location.replace('login.html');
}

/**
 * Get current user data
 */
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('bookapp_user'));
    } catch (e) {
        return null;
    }
}

/**
 * Get current session
 */
function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (e) {
        return null;
    }
}

/**
 * Auth guard - redirect to login if not authenticated
 * Call this on every protected page
 */
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.replace('login.html');
        return false;
    }
    return true;
}

/**
 * Generate a simple unique user ID
 */
function generateUserId() {
    return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Initialize default books and friends for new users
 */
function initializeDefaultData() {
    const DEFAULT_BOOKS = [
        {
            id: "1",
            title: "The Midnight Library",
            author: "Matt Haig",
            coverClass: "gradient-indigo-purple",
            status: "reading",
            progress: 64,
            totalPages: 288,
            pagesRead: Math.floor(288 * 0.64),
            rating: 0,
            addedDate: new Date().toISOString()
        },
        {
            id: "2",
            title: "Atomic Habits",
            author: "James Clear",
            coverClass: "gradient-primary-blue",
            status: "reading",
            progress: 12,
            totalPages: 320,
            pagesRead: Math.floor(320 * 0.12),
            rating: 0,
            addedDate: new Date().toISOString()
        },
        {
            id: "3",
            title: "Project Hail Mary",
            author: "Andy Weir",
            coverClass: "gradient-orange-red",
            status: "queue",
            coverUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA32gVCEXZJ-vcooa6UmVUmHAltKTs__yuHjdpID7sxF-OSEFCP6N0kdh2Oc8Cabc_eUtO-SSmvo1mkBf3BW_ha7JXklKeOXvYVBbfwmh_5qz79Jw3hlbg_pH0JcpBzDvEKHA8RkQZDLNPpb2hEtaUG_3jnb4p6_oqxTSET9YqOYC1BeDSYElECxTF2VeyWQY0d5XqcuGsNYLdeRV_Mc4a8-Ttpv1fADU4W9qeEQK8-7HkIcyQHkPbiAAiYzikVzsZxrWMQeVOs0Tk",
            progress: 0,
            totalPages: 496,
            pagesRead: 0,
            rating: 0,
            addedDate: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: "4",
            title: "Klara and the Sun",
            author: "Kazuo Ishiguro",
            coverClass: "gradient-teal-emerald",
            status: "finished",
            progress: 100,
            totalPages: 303,
            pagesRead: 303,
            rating: 4,
            addedDate: new Date(Date.now() - 604800000).toISOString()
        },
        {
            id: "5",
            title: "The Great Gatsby",
            author: "F. Scott Fitzgerald",
            coverClass: "",
            coverUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDPaoZeWAbi-guua6pgymWCD-l9Rz1I4QEzdQe0t5dgLtP6E8u-ksCxXXMTZHam1g6nH0KIMILeayBo6eDybdwvj2plGKcCONTaXYtbv0YCWGCRjUq1O1ARm6IQNhNXeefBcgc6xx8FR4S5XW-bo0A2GiSwz0BdtrNU6kCpzI0AOwPC8amGMAWqQAWqi_-Gqi92OxWRXOsJa1lKVH6rAbkBP2AP1HilvQ-RIey2nyJmUhE20UHXUe7eiHxVlOblrZ9nuvRvU46Azhs",
            status: "reading",
            progress: 65,
            totalPages: 180,
            pagesRead: Math.floor(180 * 0.65),
            rating: 4.8,
            addedDate: new Date(Date.now() - 1209600000).toISOString()
        }
    ];

    const DEFAULT_FRIENDS = [
        {
            id: "f1",
            name: "Sarah Jenkins",
            handle: "@sarahreads",
            avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBU-FoPDz8dq6UnIwoURxXyoXGDGVtWULPKF9XqIRayImmgUeQPRtmzarUmzLADTBdlxxZISrtaex1zrZq2xuKdUJrah8HRhBoTrON29IOSe_7SX4HEG6bYbOxwY5JEu1jonQqmuJ56H1Xdj8922Nj5om-v6UPIWH0MVGtg5vLwbkk882ObWLYahYH7BLAxQi4CgSUMNd_p_QhHzFx4XqnDjSJJb33lSfLU4hrY0OTFftElpNaJ9qBo1tQvP4j6I6-pW8wfgeK6OiM",
            activity: "reading The Midnight Library",
            timeAgo: "2 hours ago",
            action: "Reading",
            book: "The Midnight Library",
            type: "reading",
            rating: 4,
            isPro: true,
            posts: 124, books: 42, following: 89
        },
        {
            id: "f2",
            name: "Marcus Chen",
            handle: "@marcusthebook",
            avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDLwRzZuRjPCaPH2n7bLQO6CcMderpEfYJVyhcOO7MAJiS8bAdNLockDnPSHYS9jsNkcr8kguZX8Zla8P0WFM0R1ScCJSyzS5hq-MAwU1sNeSA5SWp2DSpvfyNOLhrlJCZy4ggtutIFcvjCTXKQzhiPWq0qhXJMc6N6nqiBMfeGb0jlKAPiKzw-O9ONRy-fDDAyVr5HAegJ3adFjahg7cekIZBE-Z6DWLGwwQlhXpi4W7YetG2AdpHahyMRly2WuzGDKxic1oICcyc",
            activity: "finished Atomic Habits",
            timeAgo: "5 hours ago",
            action: "Finished",
            book: "Atomic Habits",
            type: "finished",
            rating: 0,
            isPro: false,
            posts: 42, books: 18, following: 12
        },
        {
            id: "f3",
            name: "Elena Rodriguez",
            handle: "@elenareads",
            avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAjdRI2DNZ7Se-M7FHrNsWKYe4PwfEvJY2ElYTVMObonuvOckMk1MB0_p23KHfVCD22Qvm6_x685IcJ_ROa0JmRXD_CDVRZsWmQpGdJQKD96fjZS2qoRSIRY3B8cWcOi8q2PvuEq5lEq62-9uV2WitizX1rLqDn5LsMgCPoKJ9n-hYxVA-9NM0An6wKmQ0vyidFCH49XSrZ2kyYY1e_48XRkNPHT1ArX5dwgFW77iqEixE5TM4uu05BiIKs3R5ZuFvo17MY_VyD4C8",
            activity: "joined Reading Circle",
            timeAgo: "Yesterday",
            action: "Joined",
            book: "Reading Circle",
            type: "joined",
            rating: 0,
            isPro: false,
            posts: 12, books: 5, following: 56
        }
    ];

    const DEFAULT_MESSAGES = [];
    const DEFAULT_LIKES = {};

    localStorage.setItem('bookapp_books', JSON.stringify(DEFAULT_BOOKS));
    localStorage.setItem('bookapp_friends', JSON.stringify(DEFAULT_FRIENDS));
    localStorage.setItem('bookapp_messages', JSON.stringify(DEFAULT_MESSAGES));
    localStorage.setItem('bookapp_likes', JSON.stringify(DEFAULT_LIKES));
}

/**
 * Image Processing Utility for local avatar uploads
 * Reads file, compresses via Canvas if needed (>300KB equiv), returns Base64 string
 */
function processAndCompressImage(file, callback) {
    if (!file || !file.type.match(/^image\//)) {
        callback(null, 'Por favor, selecciona una imagen válida.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Compress Image
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG base64 (0.8 quality handles most phones nicely ~under 100kb)
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            callback(compressedBase64, null);
        };
        img.onerror = () => callback(null, 'Error procesando imagen.');
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Updates the current logged in user's avatar
 */
function updateUserAvatar(base64Image) {
    const user = getCurrentUser();
    if (user) {
        user.avatar = base64Image;
        localStorage.setItem('bookapp_user', JSON.stringify(user));
        return true;
    }
    return false;
}
