import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    deleteUser
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB488LH3wNouhkOhOweVe0Kr86lweaBFb0",
    authDomain: "messaging-app-35c60.firebaseapp.com",
    projectId: "messaging-app-35c60",
    storageBucket: "messaging-app-35c60.firebasestorage.app",
    messagingSenderId: "849473131425",
    appId: "1:849473131425:web:84c066f464e6a1663f31e0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Firebase methods class
class FirebaseMethods {
    constructor() {
        this.auth = auth;
        this.db = db;
        this.storage = storage;
    }

    // ==================== AUTHENTICATION METHODS ====================

    async createAccountUsingEmailAndPassword(email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('createAccountUsingEmailAndPassword error:', error);
            return { success: false, error: error.message };
        }
    }

    async signInWithEmailAndPassword(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('signInWithEmailAndPassword error:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            return { success: false, error: error.message };
        }
    }

    async signOutUser() {
        try {
            await signOut(this.auth);
            return { success: true };
        } catch (error) {
            console.error('signOutUser error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateUserProfile(profileData) {
        try {
            await updateProfile(this.auth.currentUser, profileData);
            return { success: true };
        } catch (error) {
            console.error('updateUserProfile error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendPasswordResetEmail(email) {
        try {
            await sendPasswordResetEmail(this.auth, email);
            return { success: true };
        } catch (error) {
            console.error('sendPasswordResetEmail error:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteUser(user) {
        try {
            await deleteUser(user);
            return { success: true };
        } catch (error) {
            console.error('deleteUser error:', error);
            return { success: false, error: error.message };
        }
    }

    onAuthStateChange(callback) {
        return onAuthStateChanged(this.auth, callback);
    }

    getCurrentUser() {
        return this.auth.currentUser;
    }

    // ==================== FIRESTORE METHODS ====================

    async createUserDocument(userId, data) {
        try {
            const userRef = doc(this.db, 'users', userId);
            await setDoc(userRef, data);
            console.log('User document created for:', userId);
            return { success: true };
        } catch (error) {
            console.error('createUserDocument error:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            return { success: false, error: error.message };
        }
    }

    async getUserDocument(userId) {
        try {
            const userDoc = await getDoc(doc(this.db, "users", userId));
            if (userDoc.exists()) {
                return { success: true, data: userDoc.data() };
            } else {
                return { success: false, error: "User not found" };
            }
        } catch (error) {
            console.error('getUserDocument error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateUserDocument(userId, updates) {
        try {
            await updateDoc(doc(this.db, "users", userId), updates);
            return { success: true };
        } catch (error) {
            console.error('updateUserDocument error:', error);
            return { success: false, error: error.message };
        }
    }

    async createChat(chatData) {
        try {
            const docRef = await addDoc(collection(this.db, "chats"), {
                ...chatData,
                createdAt: serverTimestamp(),
                lastMessageAt: serverTimestamp()
            });
            return { success: true, chatId: docRef.id };
        } catch (error) {
            console.error('createChat error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendMessage(chatId, messageData) {
        try {
            const messageRef = await addDoc(collection(this.db, "chats", chatId, "messages"), {
                ...messageData,
                timestamp: serverTimestamp()
            });

            await updateDoc(doc(this.db, "chats", chatId), {
                lastMessage: messageData.text,
                lastMessageAt: serverTimestamp()
            });

            return { success: true, messageId: messageRef.id };
        } catch (error) {
            console.error('sendMessage error:', error);
            return { success: false, error: error.message };
        }
    }

    subscribeToChatMessages(chatId, callback) {
        try {
            const messagesQuery = query(
                collection(this.db, "chats", chatId, "messages"),
                orderBy("timestamp", "asc")
            );

            return onSnapshot(messagesQuery, (snapshot) => {
                const messages = [];
                snapshot.forEach((doc) => {
                    messages.push({ id: doc.id, ...doc.data() });
                });
                callback(messages);
            }, (error) => {
                console.error('subscribeToChatMessages error:', error);
                callback([]);
            });
        } catch (error) {
            console.error('Error setting up message listener:', error);
            callback([]);
            return () => { };
        }
    }

    subscribeToUserChats(userId, callback) {
        try {
            const chatsQuery = query(
                collection(this.db, "chats"),
                where("participants", "array-contains", userId)
            );

            return onSnapshot(chatsQuery, (snapshot) => {
                const chats = [];
                snapshot.forEach((doc) => {
                    chats.push({ id: doc.id, ...doc.data() });
                });

                chats.sort((a, b) => {
                    const timeA = a.lastMessageAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
                    const timeB = b.lastMessageAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
                    return timeB.getTime() - timeA.getTime();
                });

                callback(chats);
            }, (error) => {
                console.error('subscribeToUserChats error:', error);
                callback([]);
            });
        } catch (error) {
            console.error('Error setting up chats listener:', error);
            callback([]);
            return () => { };
        }
    }

    async searchUsers(searchTerm) {
        try {
            const normalizedSearch = searchTerm.toLowerCase().trim();
            const usersQuery = query(
                collection(this.db, "users"),
                where("email", ">=", normalizedSearch),
                where("email", "<=", normalizedSearch + '\uf8ff'),
                limit(10)
            );

            const usersSnapshot = await getDocs(usersQuery);
            const users = [];

            usersSnapshot.forEach((doc) => {
                const userData = doc.data();
                users.push({
                    id: doc.id,
                    email: userData.email,
                    displayName: userData.displayName || userData.email.split('@')[0],
                    createdAt: userData.createdAt
                });
            });

            return { success: true, users };
        } catch (error) {
            console.error('searchUsers error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== STORAGE METHODS ====================

    async uploadFile(file, path = 'Uploads') {
        try {
            const storageRef = ref(this.storage, `${path}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return {
                success: true,
                downloadURL,
                path: snapshot.ref.fullPath
            };
        } catch (error) {
            console.error('uploadFile error:', error);
            return { success: false, error: error.message };
        }
    }

    async uploadProfilePicture(file, userId) {
        return this.uploadFile(file, `profile-pictures/${userId}`);
    }

    async deleteFile(filePath) {
        try {
            const fileRef = ref(this.storage, filePath);
            await deleteObject(fileRef);
            return { success: true };
        } catch (error) {
            console.error('deleteFile error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== UTILITY METHODS ====================

    getServerTimestamp() {
        return serverTimestamp();
    }

    generateId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}

const firebaseMethods = new FirebaseMethods();
export default firebaseMethods;