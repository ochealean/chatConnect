// firebasemethods/firebasemethods.js

// Import Firebase from CDN (like your demo)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
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

// Your Firebase config
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

// Simple Firebase methods (like your demo)
class FirebaseMethods {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.storage = storage;
  }

  // ==================== AUTHENTICATION METHODS ====================

  async createAccountUsingEmailAndPassword(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signInWithEmailAndPassword(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signOutUser() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateUserProfile(profileData) {
    try {
      await updateProfile(auth.currentUser, profileData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, callback);
  }

  getCurrentUser() {
    return auth.currentUser;
  }

  // ==================== FIRESTORE METHODS (Simple like demo) ====================

  // Create user document (like your demo's addDoc)
  async createUserDocument(userId, userData) {
    try {
      await setDoc(doc(db, "users", userId), {
        ...userData,
        createdAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get user document
  async getUserDocument(userId) {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        return { success: true, data: userDoc.data() };
      } else {
        return { success: false, error: "User not found" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update user document
  async updateUserDocument(userId, updates) {
    try {
      await updateDoc(doc(db, "users", userId), updates);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== CHAT METHODS ====================

  // Create a new chat (like your demo's addDoc)
  async createChat(chatData) {
    try {
      const docRef = await addDoc(collection(db, "chats"), {
        ...chatData,
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp()
      });
      return { success: true, chatId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send a message (like your demo's addDoc)
  async sendMessage(chatId, messageData) {
    try {
      const messageRef = await addDoc(collection(db, "chats", chatId, "messages"), {
        ...messageData,
        timestamp: serverTimestamp()
      });

      // Update chat's last message
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: messageData.text,
        lastMessageAt: serverTimestamp()
      });

      return { success: true, messageId: messageRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Real-time listener for chat messages (like your demo's onSnapshot)
  subscribeToChatMessages(chatId, callback) {
    try {
      const messagesQuery = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("timestamp", "asc")
      );

      return onSnapshot(messagesQuery, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        callback(messages);
      });
    } catch (error) {
      console.error('Error setting up message listener:', error);
      callback([]);
      return () => {};
    }
  }

  // Real-time listener for user chats (like your demo's onSnapshot)
  subscribeToUserChats(userId, callback) {
    try {
      // Simple query without complex ordering to avoid index issues
      const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", userId)
      );

      return onSnapshot(chatsQuery, (snapshot) => {
        const chats = [];
        snapshot.forEach((doc) => {
          chats.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort manually on client side (newest first)
        chats.sort((a, b) => {
          const timeA = a.lastMessageAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const timeB = b.lastMessageAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return timeB.getTime() - timeA.getTime();
        });
        
        callback(chats);
      });
    } catch (error) {
      console.error('Error setting up chats listener:', error);
      callback([]);
      return () => {};
    }
  }

  // Search users by email (simple approach)
  async searchUsers(searchTerm) {
    try {
      // Get all users and filter client-side (simple approach)
      const usersSnapshot = await getDocs(collection(db, "users"));
      const users = [];
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.email && userData.email.includes(searchTerm)) {
          users.push({ id: doc.id, ...userData });
        }
      });
      
      return { success: true, users: users.slice(0, 10) }; // Limit to 10 results
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== STORAGE METHODS ====================

  async uploadFile(file, path = 'uploads') {
    try {
      const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return { 
        success: true, 
        downloadURL, 
        path: snapshot.ref.fullPath 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async uploadProfilePicture(file, userId) {
    return this.uploadFile(file, `profile-pictures/${userId}`);
  }

  async deleteFile(filePath) {
    try {
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== UTILITY METHODS ====================

  getServerTimestamp() {
    return serverTimestamp();
  }

  // Simple ID generator
  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

// Create and export instance (like your demo)
const firebaseMethods = new FirebaseMethods();
export default firebaseMethods;