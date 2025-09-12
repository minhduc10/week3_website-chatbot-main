const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase (server-side with service role key)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Conversations will not be persisted.');
}

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from public directory (works locally and on Vercel)
app.use(express.static(path.join(__dirname, 'public')));

// In-memory conversation cache (optional) to reduce round trips
const conversations = {};

let SYSTEM_PROMPT = '';
try {
  const promptPath = path.join(__dirname, 'system_promt_tst.txt');
  SYSTEM_PROMPT = fs.readFileSync(promptPath, 'utf8').trim();
  if (!SYSTEM_PROMPT) {
    console.warn('⚠️  system_promt_tst.txt is empty. Using minimal default prompt.');
    SYSTEM_PROMPT = 'You are a helpful assistant.';
  }
} catch (e) {
  console.warn('⚠️  Unable to read system_promt_tst.txt. Using fallback prompt.', e.message);
  SYSTEM_PROMPT = 'You are a helpful assistant.';
}

// Load analysis prompt for extracting customer info
let ANALYSIS_PROMPT = '';
try {
  const analysisPromptPath = path.join(__dirname, 'cusor_promt.txt');
  ANALYSIS_PROMPT = fs.readFileSync(analysisPromptPath, 'utf8').trim();
  if (!ANALYSIS_PROMPT) {
    console.warn('⚠️  cusor_promt.txt is empty. Using minimal analysis prompt.');
    ANALYSIS_PROMPT = 'Return a strict JSON object with extracted customer info.';
  }
} catch (e) {
  console.warn('⚠️  Unable to read cusor_promt.txt. Using fallback analysis prompt.', e.message);
  ANALYSIS_PROMPT = 'Return a strict JSON object with extracted customer info.';
}

// Generate a unique session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Initialize or fetch conversation for a session (from Supabase, with in-memory cache)
async function initializeConversation(sessionId) {
  // Serve from cache if available
  if (conversations[sessionId]) {
    return conversations[sessionId];
  }

  const nowIso = new Date().toISOString();

  if (!supabase) {
    // Fallback to memory-only when Supabase not configured
    conversations[sessionId] = {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT }
      ],
      createdAt: nowIso,
      lastActivity: nowIso
    };
    return conversations[sessionId];
  }

  // Try to fetch from Supabase
  const { data, error } = await supabase
    .from('conversation')
    .select('conversation_id, created_at, messages')
    .eq('conversation_id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('Supabase fetch error:', error);
  }

  if (!data) {
    // Do NOT insert yet. Only create in-memory conversation;
    // we will persist to Supabase on first user message.
    const initialMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
    conversations[sessionId] = {
      messages: initialMessages,
      createdAt: nowIso,
      lastActivity: nowIso
    };
    return conversations[sessionId];
  }

  // Normalize and cache
  conversations[sessionId] = {
    messages: Array.isArray(data.messages) ? data.messages : [],
    createdAt: data.created_at || nowIso,
    lastActivity: nowIso
  };
  return conversations[sessionId];
}

async function persistConversation(sessionId) {
  if (!supabase) return; // skip when not configured
  const conversation = conversations[sessionId];
  if (!conversation) return;
  const { error } = await supabase
    .from('conversation')
    .upsert(
      { conversation_id: sessionId, messages: conversation.messages },
      { onConflict: 'conversation_id' }
    );
  if (error) {
    console.error('Supabase update error:', error);
  }
}

// API Routes

// Health check endpoint (with Supabase diagnostics, sanitized)
app.get('/api/health', (req, res) => {
  let supabaseHost = null;
  try {
    if (process.env.SUPABASE_URL) {
      supabaseHost = new URL(process.env.SUPABASE_URL).host;
    }
  } catch (_) {}
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    supabase: {
      configured: Boolean(supabase),
      host: supabaseHost
    }
  });
});

// Quick Supabase connectivity check (does not expose secrets)
app.get('/api/debug/supabase', async (req, res) => {
  if (!supabase) {
    return res.status(200).json({ configured: false, ok: false, error: 'Supabase not configured on server' });
  }
  try {
    const { data, error } = await supabase
      .from('conversation')
      .select('conversation_id')
      .limit(1);
    if (error) {
      return res.status(500).json({ configured: true, ok: false, error: error.message });
    }
    return res.json({ configured: true, ok: true, sample: (data && data[0]) ? data[0] : null });
  } catch (e) {
    return res.status(500).json({ configured: true, ok: false, error: e.message });
  }
});

// Get or create a new session
app.post('/api/session', async (req, res) => {
  try {
    const sessionId = generateSessionId();
    await initializeConversation(sessionId);
    if (supabase) {
      // ensure row exists (initializeConversation already inserted if missing)
    }
    res.json({ sessionId, message: 'Session created successfully' });
  } catch (e) {
    console.error('Session init error:', e);
    res.status(500).json({ error: 'Failed to create session' });
  }
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
    const conversation = await initializeConversation(sessionId);
    
    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: message
    });
    
    // Update last activity
    conversation.lastActivity = new Date().toISOString();

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: conversation.messages,
      max_tokens: 250,
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

    // Persist to Supabase
    await persistConversation(sessionId);

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
app.get('/api/conversation/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const conversation = await initializeConversation(sessionId);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json({
    sessionId,
    messages: conversation.messages.filter(msg => msg.role !== 'system'),
    createdAt: conversation.createdAt,
    lastActivity: conversation.lastActivity
  });
});

// Clear conversation
app.delete('/api/conversation/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  delete conversations[sessionId];
  if (supabase) {
    const { error } = await supabase
      .from('conversation')
      .delete()
      .eq('conversation_id', sessionId);
    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(500).json({ error: 'Failed to delete conversation' });
    }
  }
  res.json({ message: 'Conversation cleared successfully' });
});

// Get all active sessions (for debugging)
app.get('/api/sessions', async (req, res) => {
  if (!supabase) {
    const sessionList = Object.keys(conversations).map(sessionId => ({
      sessionId,
      messageCount: (conversations[sessionId].messages?.length || 1) - 1,
      createdAt: conversations[sessionId].createdAt,
      lastActivity: conversations[sessionId].lastActivity
    }));
    return res.json({ sessions: sessionList });
  }

  const { data, error } = await supabase
    .from('conversation')
    .select('conversation_id, created_at, messages')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase list sessions error:', error);
    return res.status(500).json({ error: 'Failed to list sessions' });
  }
  const sessionList = (data || []).map(row => ({
    sessionId: row.conversation_id,
    messageCount: (row.messages?.length || 1) - 1,
    createdAt: row.created_at,
    lastActivity: row.created_at
  }));
  res.json({ sessions: sessionList });
});

// Build a transcript from messages for analysis
function buildTranscriptFromMessages(messages) {
  const ordered = Array.isArray(messages) ? messages : [];
  return ordered
    .filter(m => m && typeof m.content === 'string')
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');
}

// Save analysis back to Supabase columns (if available), and an analysis_result jsonb
async function saveAnalysis(sessionId, analysisObject) {
  if (!supabase) return;
  const payload = {
    lead_analysic: analysisObject,
    lead_analyzed_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from('conversation')
    .update(payload)
    .eq('conversation_id', sessionId);
  if (error) {
    console.error('Supabase update error (lead_analysic, lead_analyzed_at):', error);
  }
}

// Analyze conversation and store structured info
app.post('/api/conversation/:sessionId/analyze', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase is not configured on server' });
    }

    // Fetch conversation directly from Supabase to ensure full history
    const { data, error } = await supabase
      .from('conversation')
      .select('messages')
      .eq('conversation_id', sessionId)
      .maybeSingle();
    if (error) {
      console.error('Supabase fetch conversation error:', error);
      return res.status(500).json({ error: 'Failed to fetch conversation' });
    }
    const messages = data?.messages || conversations[sessionId]?.messages || [];
    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: 'No messages to analyze' });
    }

    const transcript = buildTranscriptFromMessages(messages.filter(m => m.role !== 'system'));

    // Run OpenAI analysis
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: `Here is the full conversation transcript:\n\n${transcript}` }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const content = completion.choices?.[0]?.message?.content || '';
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      // Attempt to extract JSON substring if the model added text around it
      const match = content.match(/\{[\s\S]*\}$/);
      if (match) {
        analysis = JSON.parse(match[0]);
      } else {
        return res.status(500).json({ error: 'AI did not return valid JSON', raw: content });
      }
    }

    // Save analysis
    await saveAnalysis(sessionId, analysis);

    res.json({ sessionId, analysis });
  } catch (e) {
    console.error('Analyze endpoint error:', e);
    res.status(500).json({ error: 'Failed to analyze conversation' });
  }
});

// Get stored analysis
app.get('/api/conversation/:sessionId/analysis', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!supabase) {
      return res.status(200).json({ sessionId, analysis: null });
    }
    const { data, error } = await supabase
      .from('conversation')
      .select('lead_analysic, lead_analyzed_at')
      .eq('conversation_id', sessionId)
      .maybeSingle();
    if (error) {
      console.error('Supabase get analysis error:', error);
      return res.status(500).json({ error: 'Failed to get analysis' });
    }
    res.json({ sessionId, analysis: data?.lead_analysic || null, analyzedAt: data?.lead_analyzed_at || null });
  } catch (e) {
    console.error('Get analysis endpoint error:', e);
    res.status(500).json({ error: 'Failed to get analysis' });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
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
