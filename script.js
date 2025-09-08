class Chatbot {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.sessionId = null;
        // Choose API base URL based on environment
        const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
        // If on Vercel/production, call the same origin `api` routes
        this.apiBaseUrl = isLocalhost ? 'http://localhost:3000/api' : '/api';
        
        this.init();
    }
    
    async init() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Initialize session
        await this.initializeSession();
        
        // Auto-focus on input
        this.messageInput.focus();
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        // Add user message
        this.addMessage(message, 'user');
        
        // Clear input
        this.messageInput.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send message to backend
            const response = await this.sendToBackend(message);
            this.hideTypingIndicator();
            this.addMessage(response, 'bot');
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            console.error('Error sending message:', error);
        }
    }
    
    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        const icon = document.createElement('i');
        icon.className = sender === 'bot' ? 'fas fa-robot' : 'fas fa-user';
        avatar.appendChild(icon);
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const messageText = document.createElement('p');
        messageText.textContent = text;
        content.appendChild(messageText);
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = this.getCurrentTime();
        content.appendChild(time);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    async initializeSession() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                this.sessionId = data.sessionId;
                console.log('Session initialized:', this.sessionId);
            } else {
                console.error('Failed to initialize session');
            }
        } catch (error) {
            console.error('Error initializing session:', error);
        }
    }
    
    async sendToBackend(message) {
        const response = await fetch(`${this.apiBaseUrl}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                sessionId: this.sessionId
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get response');
        }
        
        const data = await response.json();
        return data.response;
    }
    
    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
    
    getCurrentTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Chatbot();
});

// Add some interactive features
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    // Enable/disable send button based on input
    messageInput.addEventListener('input', () => {
        sendButton.disabled = !messageInput.value.trim();
    });
    
    // Add some sample questions for demonstration
    const sampleQuestions = [
        "What can you help me with?",
        "Tell me about yourself",
        "How does this work?",
        "What are your capabilities?"
    ];
    
    // Add sample questions as clickable suggestions (optional enhancement)
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'suggestions';
    suggestionsContainer.style.cssText = `
        padding: 10px 20px;
        background: #f8f9fa;
        border-top: 1px solid #e9ecef;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    `;
    
    sampleQuestions.forEach(question => {
        const suggestion = document.createElement('button');
        suggestion.textContent = question;
        suggestion.style.cssText = `
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 15px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        
        suggestion.addEventListener('mouseenter', () => {
            suggestion.style.background = '#e9ecef';
        });
        
        suggestion.addEventListener('mouseleave', () => {
            suggestion.style.background = 'white';
        });
        
        suggestion.addEventListener('click', () => {
            messageInput.value = question;
            messageInput.focus();
        });
        
        suggestionsContainer.appendChild(suggestion);
    });
    
    // Insert suggestions after the input container
    const inputContainer = document.querySelector('.chat-input-container');
    inputContainer.parentNode.insertBefore(suggestionsContainer, inputContainer.nextSibling);
});
