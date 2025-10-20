import firebaseMethods from './firebasemethods/firebasemethods.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.init();
    }

    async init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    async initializeApp() {
        console.log('Initializing chat app...');
        
        firebaseMethods.onAuthStateChange((user) => {
            const loadingScreen = document.getElementById('loadingScreen');
            const chatContainer = document.getElementById('chatContainer');
            const loginContainer = document.getElementById('loginContainer');
            const sidebar = document.getElementById('sidebar');
            
            if (user) {
                this.currentUser = user;
                console.log('User signed in:', user.email);
                
                this.updateUserInfo();
                this.loadChats();
                
                if (loadingScreen) loadingScreen.style.display = 'none';
                if (chatContainer) chatContainer.style.display = 'flex';
                if (loginContainer) loginContainer.style.display = 'none';

                // Show sidebar if no chat is selected initially, particularly on mobile
                if (!this.currentChat && sidebar && window.innerWidth <= 768) {
                    sidebar.classList.add('active');
                }
            } else {
                this.currentUser = null;
                console.log('User signed out');
                
                if (loadingScreen) loadingScreen.style.display = 'none';
                if (chatContainer) chatContainer.style.display = 'none';
                if (loginContainer) loginContainer.style.display = 'flex';
            }
        });

        this.setupEventListeners();
    }

    updateUserInfo() {
        console.log('Updating user info...');
        
        const userName = document.getElementById('userName');
        const userAvatar = document.querySelector('.user-avatar');

        if (userName && this.currentUser) {
            userName.textContent = this.currentUser.displayName || this.currentUser.email;
        }

        if (userAvatar && this.currentUser) {
            userAvatar.textContent = (this.currentUser.displayName || this.currentUser.email).charAt(0).toUpperCase();
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        } else {
            console.warn('Logout button not found');
        }

        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.startNewChat();
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterChats(e.target.value);
            });
        }

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(loginForm);
            });
        }

        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup(signupForm);
            });
        }

        const tabs = document.querySelectorAll('.tab');
        const forms = document.querySelectorAll('.form');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                
                forms.forEach(form => {
                    form.classList.remove('active');
                    if (form.id === `${tabId}-form`) {
                        form.classList.add('active');
                    }
                });
            });
        });

        // Hamburger menu and close sidebar button listeners
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const closeSidebarBtn = document.getElementById('closeSidebarBtn');
        const sidebar = document.getElementById('sidebar');

        if (hamburgerBtn && sidebar) {
            hamburgerBtn.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
        }

        if (closeSidebarBtn && sidebar) {
            closeSidebarBtn.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }
    }

    loadChats() {
        if (!this.currentUser) {
            console.warn('No user logged in, cannot load chats');
            return;
        }

        console.log('Loading chats for user:', this.currentUser.uid);
        
        firebaseMethods.subscribeToUserChats(this.currentUser.uid, (chats) => {
            console.log('Received chats:', chats.length);
            this.displayChats(chats);
        });
    }

    displayChats(chats) {
        const chatsList = document.getElementById('chatsList');
        const sidebar = document.getElementById('sidebar');
        
        if (!chatsList) {
            console.warn('Chats list container not found');
            return;
        }
        
        if (chats.length === 0) {
            chatsList.innerHTML = `
                <div class="no-chats" style="text-align: center; padding: 40px 20px; color: #a0a0b0; align-items: center; display: flex; flex-direction: column;">
                    <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No chats yet</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Start a new conversation!</p>
                    <button class="new-chat-btn" style="margin-top: 15px; padding: 10px 20px; background: #6c63ff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Start New Chat
                    </button>
                </div>
            `;

            const newChatBtn = chatsList.querySelector('.new-chat-btn');
            if (newChatBtn) {
                newChatBtn.addEventListener('click', () => this.startNewChat());
            }
            
            return;
        }

        chatsList.innerHTML = chats.map(chat => `
            <div class="contact chat-item" data-chat-id="${chat.id}">
                <div class="contact-avatar">${this.getChatInitials(chat)}</div>
                <div class="contact-info">
                    <div class="contact-name">${this.getChatName(chat)}</div>
                    <div class="contact-last-msg">${chat.lastMessage || 'Start chatting!'}</div>
                </div>
                <div class="contact-time">${this.formatTime(chat.lastMessageAt)}</div>
            </div>
        `).join('');

        chatsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.getAttribute('data-chat-id');
                const chat = chats.find(c => c.id === chatId);
                this.selectChat(chat);
                
                chatsList.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Close sidebar on mobile after selecting a chat
                if (sidebar && window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                }
            });
        });
    }

    selectChat(chat) {
        if (!chat) return;
        
        this.currentChat = chat;
        console.log('Selected chat:', chat.id);
        
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.querySelector('.chat-input');
        const sidebar = document.getElementById('sidebar');

        if (chatMessages) chatMessages.style.display = 'block';
        if (chatInput) chatInput.style.display = 'flex';
        if (sidebar && window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }

        this.loadMessages(chat.id);
    }

    loadMessages(chatId) {
        console.log('Loading messages for chat:', chatId);
        
        firebaseMethods.subscribeToChatMessages(chatId, (messages) => {
            console.log('Received messages:', messages.length);
            this.displayMessages(messages);
        });
    }

    displayMessages(messages) {
        const messagesContainer = document.getElementById('chatMessages');
        
        if (!messagesContainer) {
            console.warn('Messages container not found');
            return;
        }
        
        messagesContainer.innerHTML = messages.map(message => {
            const isSent = message.senderId === this.currentUser.uid;
            const ariaLabel = isSent 
                ? 'Sent by you'
                : `Received from ${message.senderName || 'Friend'}`;
            return `
                <div class="message ${isSent ? 'sent' : 'received'}" aria-label="${ariaLabel}">
                    <div class="message-text">${message.text}</div>
                    <div class="message-time">${this.formatTime(message.timestamp)}</div>
                </div>
            `;
        }).join('');

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        const sidebar = document.getElementById('sidebar');
        const text = messageInput?.value.trim();

        if (!this.currentChat) {
            // Show sidebar instead of modal
            if (sidebar) {
                sidebar.classList.add('active');
            }
            this.showMessage('Please select a contact to start chatting', 'error');
            return;
        }

        if (!text) {
            this.showMessage('Please enter a message', 'error');
            return;
        }

        // Disable send button and input to prevent spamming
        if (sendBtn) sendBtn.disabled = true;
        if (messageInput) messageInput.disabled = true;

        try {
            const result = await firebaseMethods.sendMessage(this.currentChat.id, {
                senderId: this.currentUser.uid,
                text: text,
                senderName: this.currentUser.displayName || this.currentUser.email
            });
            
            if (result.success) {
                messageInput.value = '';
                this.showMessage('Message sent successfully!', 'success');
            } else {
                this.showMessage('Failed to send message: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showMessage('Error sending message: ' + error.message, 'error');
        } finally {
            // Re-enable send button and input
            if (sendBtn) sendBtn.disabled = false;
            if (messageInput) messageInput.disabled = false;
        }
    }

    async startNewChat() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput?.value.trim();

        if (!searchTerm) {
            this.showMessage('Please enter an email address to start a chat', 'error');
            return;
        }

        try {
            const result = await firebaseMethods.searchUsers(searchTerm);

            if (!result.success) {
                this.showMessage('Error searching users: ' + result.error, 'error');
                return;
            }

            if (result.users.length === 0) {
                this.showMessage('No user found with that email address', 'error');
                return;
            }

            const user = result.users[0];

            const existingChat = await this.findExistingChat(user.id);

            if (existingChat) {
                this.selectChat(existingChat);
                this.showMessage('Opened existing chat', 'success');
                return;
            }

            const chatResult = await firebaseMethods.createChat({
                participants: [this.currentUser.uid, user.id],
                type: 'direct',
                name: user.displayName || user.email.split('@')[0]
            });

            if (chatResult.success) {
                this.showMessage('Chat created successfully!', 'success');
                if (searchInput) searchInput.value = '';
                this.loadChats();
            } else {
                this.showMessage('Failed to create chat: ' + chatResult.error, 'error');
            }
        } catch (error) {
            console.error('Error creating chat:', error);
            this.showMessage('Error creating chat: ' + error.message, 'error');
        }
    }

    async findExistingChat(otherUserId) {
        try {
            const chatsQuery = query(
                collection(firebaseMethods.getDb(), "chats"),
                where("participants", "array-contains", this.currentUser.uid)
            );
            const chatsSnapshot = await getDocs(chatsQuery);
            
            for (const doc of chatsSnapshot.docs) {
                const chatData = doc.data();
                if (chatData.type === 'direct' && 
                    chatData.participants.includes(otherUserId) &&
                    chatData.participants.length === 2) {
                    return { id: doc.id, ...chatData };
                }
            }
            return null;
        } catch (error) {
            console.error('Error checking existing chats:', error);
            return null;
        }
    }

    async handleLogin(form) {
        const email = form.querySelector('input[type="email"]').value;
        const password = form.querySelector('input[type="password"]').value;

        try {
            const result = await firebaseMethods.signInWithEmailAndPassword(email, password);
            
            if (result.success) {
                this.showMessage('Login successful!', 'success');
            } else {
                this.showMessage(result.error, 'error');
            }
        } catch (error) {
            this.showMessage('Login error: ' + error.message, 'error');
        }
    }

    async handleSignup(form) {
        const fullName = form.querySelector('input[type="text"]').value;
        const email = form.querySelector('input[type="email"]').value;
        const password = form.querySelector('input[type="password"]').value;

        try {
            const authResult = await firebaseMethods.createAccountUsingEmailAndPassword(email, password);
            
            if (authResult.success) {
                await firebaseMethods.createUserDocument(authResult.user.uid, {
                    email: email,
                    displayName: fullName
                });

                await firebaseMethods.updateUserProfile({
                    displayName: fullName
                });

                this.showMessage('Account created successfully!', 'success');
            } else {
                this.showMessage(authResult.error, 'error');
            }
        } catch (error) {
            this.showMessage('Signup error: ' + error.message, 'error');
        }
    }

    async handleLogout() {
        try {
            await firebaseMethods.signOutUser();
            this.showMessage('Logged out successfully', 'success');
        } catch (error) {
            this.showMessage('Logout error: ' + error.message, 'error');
        }
    }

    getChatInitials(chat) {
        if (chat.name) {
            return chat.name.charAt(0).toUpperCase();
        }
        return 'F';
    }

    getChatName(chat) {
        if (chat.name) {
            return chat.name;
        }
        return 'Friend';
    }

    formatTime(timestamp) {
        if (!timestamp) return 'Just now';
        try {
            const date = timestamp.toDate();
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            
            return date.toLocaleDateString();
        } catch (error) {
            return 'Recently';
        }
    }

    showMessage(text, type) {
        console.log(`${type.toUpperCase()}: ${text}`);
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = text;
            notification.className = `notification ${type}`;
            notification.style.display = 'block';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        } else {
            alert(`${type.toUpperCase()}: ${text}`);
        }
    }

    filterChats(searchTerm) {
        const chats = document.querySelectorAll('.chat-item');
        chats.forEach(chat => {
            const name = chat.querySelector('.contact-name')?.textContent.toLowerCase() || '';
            const lastMsg = chat.querySelector('.contact-last-msg')?.textContent.toLowerCase() || '';
            
            if (name.includes(searchTerm.toLowerCase()) || lastMsg.includes(searchTerm.toLowerCase())) {
                chat.style.display = 'flex';
            } else {
                chat.style.display = 'none';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const chatApp = new ChatApp();
    window.chatApp = chatApp;
});