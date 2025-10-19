// login.js
import firebaseMethods from './firebasemethods/firebasemethods.js';

class AuthHandler {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // Set up auth state listener
        this.setupAuthListener();
        
        // Set up form event listeners
        this.setupFormHandlers();
        
        // Set up tab switching
        this.setupTabSwitching();
        
        // Set up social login buttons
        this.setupSocialLoginButtons();
    }

    setupAuthListener() {
        firebaseMethods.onAuthStateChange((user) => {
            if (user) {
                this.currentUser = user;
                console.log('User is signed in:', user.email);
                this.redirectToChat();
            } else {
                this.currentUser = null;
                console.log('User is signed out');
            }
        });
    }

    setupFormHandlers() {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(loginForm);
        });

        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup(signupForm);
        });

        // Forgot password link
        const forgotPasswordLink = loginForm.querySelector('a[href="#"]');
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });
    }

    setupTabSwitching() {
        const tabs = document.querySelectorAll('.tab');
        const forms = document.querySelectorAll('.form');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show corresponding form
                forms.forEach(form => {
                    form.classList.remove('active');
                    if (form.id === `${tabId}-form`) {
                        form.classList.add('active');
                    }
                });
            });
        });
    }

    setupSocialLoginButtons() {
        const socialButtons = document.querySelectorAll('.social-icon');
        socialButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const platform = Array.from(button.classList)
                    .find(cls => cls !== 'social-icon')
                    .replace('facebook', 'Facebook')
                    .replace('google', 'Google')
                    .replace('twitter', 'Twitter');
                
                this.showMessage(`${platform} signup successfully!`, 'info');
            });
        });
    }

    async handleLogin(form) {
        const email = form.querySelector('input[type="email"]').value;
        const password = form.querySelector('input[type="password"]').value;
        const rememberMe = form.querySelector('input[type="checkbox"]').checked;

        // Basic validation
        if (!this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error');
            return;
        }

        // Show loading state
        const submitButton = form.querySelector('.btn');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Logging in...';
        submitButton.disabled = true;

        try {
            const result = await firebaseMethods.signInWithEmailAndPassword(email, password);
            
            if (result.success) {
                this.showMessage('Login successful! Redirecting...', 'success');
                
                // Store remember me preference
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                }
                
                // Update user's last seen timestamp
                if (result.user) {
                    await firebaseMethods.updateUserDocument(result.user.uid, {
                        lastSeen: firebaseMethods.getServerTimestamp()
                    });
                }
            } else {
                this.showMessage(result.error, 'error');
            }
        } catch (error) {
            this.showMessage('An unexpected error occurred', 'error');
            console.error('Login error:', error);
        } finally {
            // Restore button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    async handleSignup(form) {
        const fullName = form.querySelector('input[type="text"]').value;
        const email = form.querySelectorAll('input[type="email"]')[0].value;
        const password = form.querySelectorAll('input[type="password"]')[0].value;
        const confirmPassword = form.querySelectorAll('input[type="password"]')[1].value;
        const agreeToTerms = form.querySelector('input[type="checkbox"]').checked;

        // Validation
        if (!this.validateFormData({ fullName, email, password, confirmPassword, agreeToTerms })) {
            return;
        }

        // Show loading state
        const submitButton = form.querySelector('.btn');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Creating Account...';
        submitButton.disabled = true;

        try {
            // Create auth account
            const authResult = await firebaseMethods.createAccountUsingEmailAndPassword(email, password);
            
            if (authResult.success) {
                // Create user document in Firestore
                const userDocResult = await firebaseMethods.createUserDocument(authResult.user.uid, {
                    email: email,
                    displayName: fullName,
                    createdAt: firebaseMethods.getServerTimestamp(),
                    lastSeen: firebaseMethods.getServerTimestamp()
                });

                if (userDocResult.success) {
                    // Update profile with display name
                    const profileResult = await firebaseMethods.updateUserProfile({
                        displayName: fullName
                    });

                    if (profileResult.success) {
                        this.showMessage('Account created successfully! Welcome to ChatConnect!', 'success');
                    } else {
                        this.showMessage('Account created but profile update failed: ' + profileResult.error, 'warning');
                    }
                } else {
                    this.showMessage('Account created but user document failed: ' + userDocResult.error, 'warning');
                }
            } else {
                this.showMessage(authResult.error, 'error');
            }
        } catch (error) {
            this.showMessage('An unexpected error occurred during signup', 'error');
            console.error('Signup error:', error);
        } finally {
            // Restore button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    async handleForgotPassword() {
        const email = prompt('Please enter your email address to reset your password:');
        
        if (!email) return;
        
        if (!this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return;
        }

        try {
            const result = await firebaseMethods.sendPasswordResetEmail(email);
            
            if (result.success) {
                this.showMessage('Password reset email sent! Check your inbox.', 'success');
            } else {
                this.showMessage(result.error, 'error');
            }
        } catch (error) {
            this.showMessage('An error occurred while sending reset email', 'error');
            console.error('Password reset error:', error);
        }
    }

    validateFormData({ fullName, email, password, confirmPassword, agreeToTerms }) {
        // Check if all fields are filled
        if (!fullName || !email || !password || !confirmPassword) {
            this.showMessage('Please fill in all fields', 'error');
            return false;
        }

        // Validate full name
        if (fullName.trim().length < 2) {
            this.showMessage('Please enter your full name', 'error');
            return false;
        }

        // Validate email
        if (!this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return false;
        }

        // Validate password strength
        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            return false;
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return false;
        }

        // Check terms agreement
        if (!agreeToTerms) {
            this.showMessage('Please agree to the Terms & Conditions', 'error');
            return false;
        }

        return true;
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showMessage(message, type = 'info') {
        // Remove existing message if any
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.textContent = message;

        // Add styles
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            background: ${type === 'success' ? '#4caf50' : 
                        type === 'error' ? '#f44336' : 
                        type === 'warning' ? '#ff9800' :
                        '#6c63ff'};
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        `;

        // Add to document
        document.body.appendChild(messageEl);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => messageEl.remove(), 300);
            }
        }, 5000);

        // Add CSS animations
        if (!document.querySelector('#auth-message-styles')) {
            const style = document.createElement('style');
            style.id = 'auth-message-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    redirectToChat() {
        this.showMessage('Authentication successful! Loading chat...', 'success');
        
        setTimeout(() => {
            // Redirect to chat page
            window.location.href = 'chatconnect.html';
        }, 2000);
    }
}

// Initialize the auth handler when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AuthHandler();
});