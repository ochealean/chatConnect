import firebaseMethods from './firebasemethods/firebasemethods.js';

class AuthHandler {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupAuthListener();
        this.setupFormHandlers();
        this.setupTabSwitching();
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

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(loginForm);
            });
        }

        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup(signupForm);
            });
        }

        const forgotPasswordLink = loginForm?.querySelector('a[href="#"]');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }
    }

    setupTabSwitching() {
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
                
                this.showMessage(`${platform} signup not implemented yet`, 'info');
            });
        });
    }

    async handleLogin(form) {
        const email = form.querySelector('input[type="email"]').value.trim();
        const password = form.querySelector('input[type="password"]').value;
        const rememberMe = form.querySelector('input[type="checkbox"]').checked;

        if (!this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return;
        }

        if (!password) {
            this.showMessage('Please enter a password', 'error');
            return;
        }

        const submitButton = form.querySelector('.btn');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Logging in...';
        submitButton.disabled = true;

        try {
            const result = await firebaseMethods.signInWithEmailAndPassword(email, password);
            
            if (result.success) {
                this.showMessage('Login successful! Redirecting...', 'success');
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                }
                if (result.user) {
                    const updateResult = await firebaseMethods.updateUserDocument(result.user.uid, {
                        lastSeen: firebaseMethods.getServerTimestamp()
                    });
                    if (!updateResult.success) {
                        console.warn('Failed to update lastSeen:', updateResult.error);
                    }
                }
            } else {
                this.showMessage(`Login failed: ${result.error}`, 'error');
                console.error('Login error details:', result.error);
            }
        } catch (error) {
            this.showMessage(`Login error: ${error.message}`, 'error');
            console.error('Login error:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    async handleSignup(form) {
        const fullName = form.querySelector('input[type="text"]').value.trim();
        const email = form.querySelectorAll('input[type="email"]')[0].value.trim();
        const password = form.querySelectorAll('input[type="password"]')[0].value;
        const confirmPassword = form.querySelectorAll('input[type="password"]')[1].value;
        const agreeToTerms = form.querySelector('input[type="checkbox"]').checked;

        if (!this.validateFormData({ fullName, email, password, confirmPassword, agreeToTerms })) {
            return;
        }

        const submitButton = form.querySelector('.btn');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Creating Account...';
        submitButton.disabled = true;

        try {
            const authResult = await firebaseMethods.createAccountUsingEmailAndPassword(email, password);
            
            if (!authResult.success) {
                this.showMessage(`Signup failed: ${authResult.error}`, 'error');
                return;
            }

            const userData = {
                email,
                displayName: fullName,
                createdAt: firebaseMethods.getServerTimestamp(),
                lastSeen: firebaseMethods.getServerTimestamp()
            };

            // Wait briefly to ensure auth state propagation
            await new Promise(resolve => setTimeout(resolve, 500));

            const userDocResult = await this.retryOperation(() => 
                firebaseMethods.createUserDocument(authResult.user.uid, userData), 3);
            
            if (!userDocResult.success) {
                await firebaseMethods.deleteUser(authResult.user);
                this.showMessage(`Failed to create user document: ${userDocResult.error}`, 'error');
                console.error('User document creation failed:', userDocResult.error);
                return;
            }

            const profileResult = await firebaseMethods.updateUserProfile({ displayName: fullName });
            if (!profileResult.success) {
                await firebaseMethods.deleteUser(authResult.user);
                this.showMessage(`Failed to update profile: ${profileResult.error}`, 'error');
                console.error('Profile update failed:', profileResult.error);
                return;
            }

            this.showMessage('Account created successfully! Welcome to ChatConnect!', 'success');
        } catch (error) {
            this.showMessage(`Signup failed: ${error.message}`, 'error');
            console.error('Signup error:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    async retryOperation(operation, maxAttempts = 3, delayMs = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await operation();
                return result;
            } catch (error) {
                if (attempt === maxAttempts) {
                    console.error(`Operation failed after ${maxAttempts} attempts:`, {
                        code: error.code,
                        message: error.message,
                        stack: error.stack
                    });
                    return { success: false, error: error.message };
                }
                console.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`, error.message);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
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
                this.showMessage(`Error sending reset email: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showMessage(`Error sending reset email: ${error.message}`, 'error');
            console.error('Password reset error:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
        }
    }

    validateFormData({ fullName, email, password, confirmPassword, agreeToTerms }) {
        if (!fullName || !email || !password || !confirmPassword) {
            this.showMessage('Please fill in all fields', 'error');
            return false;
        }

        if (fullName.length < 2) {
            this.showMessage('Please enter a valid full name (at least 2 characters)', 'error');
            return false;
        }

        if (!this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return false;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            return false;
        }

        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return false;
        }

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
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.textContent = message;

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

        document.body.appendChild(messageEl);

        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => messageEl.remove(), 300);
            }
        }, 5000);

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
            window.location.href = 'chatconnect.html';
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuthHandler();
});