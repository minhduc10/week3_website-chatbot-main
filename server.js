const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// In-memory conversation storage
const conversations = {};

// Generate a unique session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Initialize conversation for a session
function initializeConversation(sessionId) {
  if (!conversations[sessionId]) {
    conversations[sessionId] = {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Be friendly, informative, and concise in your responses.'
        }
      ],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
  }
  return conversations[sessionId];
}

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Get or create a new session
app.post('/api/session', (req, res) => {
  const sessionId = generateSessionId();
  initializeConversation(sessionId);
  
  res.json({ 
    sessionId,
    message: 'Session created successfully'
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({ 
        error: 'Message and sessionId are required' 
      });
    }

    // Initialize or get conversation
    const conversation = initializeConversation(sessionId);
    
    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: message
    });
    
    // Update last activity
    conversation.lastActivity = new Date().toISOString();

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: conversation.messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Add AI response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    // Keep only last 20 messages to manage memory
    if (conversation.messages.length > 20) {
      conversation.messages = conversation.messages.slice(-20);
    }

    res.json({
      response: aiResponse,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // Handle different types of errors
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({ 
        error: 'API quota exceeded. Please check your OpenAI account.' 
      });
    } else if (error.code === 'invalid_api_key') {
      return res.status(401).json({ 
        error: 'Invalid API key. Please check your OpenAI API key.' 
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to get response from AI. Please try again.' 
      });
    }
  }
});

// Get conversation history
app.get('/api/conversation/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const conversation = conversations[sessionId];
  
  if (!conversation) {
    return res.status(404).json({ 
      error: 'Conversation not found' 
    });
  }

  res.json({
    sessionId,
    messages: conversation.messages.filter(msg => msg.role !== 'system'),
    createdAt: conversation.createdAt,
    lastActivity: conversation.lastActivity
  });
});

// Clear conversation
app.delete('/api/conversation/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (conversations[sessionId]) {
    delete conversations[sessionId];
    res.json({ message: 'Conversation cleared successfully' });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

// Get all active sessions (for debugging)
app.get('/api/sessions', (req, res) => {
  const sessionList = Object.keys(conversations).map(sessionId => ({
    sessionId,
    messageCount: conversations[sessionId].messages.length - 1, // Exclude system message
    createdAt: conversations[sessionId].createdAt,
    lastActivity: conversations[sessionId].lastActivity
  }));
  
  res.json({ sessions: sessionList });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal server error' 
  });
});

// Start server (only when not running on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Make sure to set your OPENAI_API_KEY in the .env file`);
    
    // Check if API key is set
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.log('⚠️  WARNING: Please set your OPENAI_API_KEY in the .env file');
    }
  });
}

module.exports = app;
