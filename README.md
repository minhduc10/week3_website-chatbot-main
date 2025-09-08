# AI Website Chatbot

A modern AI chatbot with OpenAI integration, built with Node.js backend and vanilla JavaScript frontend.

## Features

- 🤖 **OpenAI Integration**: Powered by GPT-3.5-turbo for intelligent responses
- 💬 **Real-time Chat**: Smooth conversation flow with typing indicators
- 🎨 **Modern UI**: Beautiful, responsive design with gradient backgrounds
- 📝 **Session Management**: Persistent conversations with unique session IDs
- 🔄 **Memory Management**: Automatic conversation history management
- 🛡️ **Error Handling**: Comprehensive error handling and user feedback

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- OpenAI API key

### Installation

1. **Clone or download the project files**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up your OpenAI API key:**
   - Open the `.env` file
   - Replace `your_openai_api_key_here` with your actual OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

4. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   - Navigate to `http://localhost:3000`
   - Start chatting with the AI!

## API Endpoints

- `POST /api/session` - Create a new chat session
- `POST /api/chat` - Send a message and get AI response
- `GET /api/conversation/:sessionId` - Get conversation history
- `DELETE /api/conversation/:sessionId` - Clear conversation
- `GET /api/sessions` - List all active sessions
- `GET /api/health` - Health check

## Project Structure

```
website-chatbot/
├── server.js          # Node.js backend server
├── package.json       # Dependencies and scripts
├── .env               # Environment variables (API keys)
├── api/               # Vercel serverless entrypoints
├── public/
│   ├── index.html     # Frontend HTML (served statically)
│   ├── script.js      # Frontend JavaScript
│   └── styles.css     # Frontend CSS
└── README.md          # This file
```

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (default: 3000)

### OpenAI Model Settings

The chatbot uses GPT-3.5-turbo with the following settings:
- Max tokens: 500
- Temperature: 0.7
- Conversation memory: Last 20 messages

## Troubleshooting

### Common Issues

1. **"Invalid API key" error:**
   - Make sure your OpenAI API key is correctly set in the `.env` file
   - Ensure you have sufficient credits in your OpenAI account

2. **"Failed to get response" error:**
   - Check your internet connection
   - Verify the server is running on port 3000
   - Check the browser console for detailed error messages

3. **CORS errors:**
   - Make sure you're accessing the app through `http://localhost:3000`
   - Don't open the HTML file directly in the browser

### Getting Help

- Check the browser console for error messages
- Verify the server logs in the terminal
- Ensure all dependencies are installed correctly

## License

MIT License - feel free to use this project for your own purposes!