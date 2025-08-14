const express = require('express');
const app = express();
const axios = require('axios');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const port = process.env.PORT || 5000;
const ollama = require('ollama').default;

app.use(express.json({ limit: '10mb' })); // Increased limit for conversation context

const pool = new Pool({
    connectionString: 'postgresql-key(supabase)'
});

const JWT_SECRET = 'your-super-secret-key';
const JWT_EXPIRES_IN = '1h';
const TAVILY_API_KEY = 'tavily-api-key';

async function performTavilySearch(query) {
    console.log(`Performing Tavily search for: "${query}"`);
    try {
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query: query,
            search_depth: 'advanced', // Can be 'basic' or 'advanced'
            include_answer: true,      // Get a direct answer from Tavily
            include_raw_content: false, // You can set this to true if you need more info
        });
        return response.data;
    } catch (error) {
        console.error('Tavily API Error:', error.response ? error.response.data : error.message);
        return null;
    }
}


const transporter = nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io', // take them from mailtrap
    port: 2525,
    auth: {
        user: 'user',
        pass: 'pass'
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Access token is required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        
        req.user = decoded; // Contains userId and username
        next();
    });
};

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const client = await pool.connect();
        const result = await client.query(
            'INSERT INTO user_accounts (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
            [username, email, hashedPassword]
        );
        client.release();

        const userId = result.rows[0].user_id;

        // Create a JWT for email verification
        const verificationToken = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1d' });
        
        const verificationUrl = `http://localhost:3000/verify?token=${verificationToken}`;

        // Send verification email
        const mailOptions = {
            from: 'your-email@example.com',
            to: email,
            subject: 'Verify your account',
            html: `<h1>Welcome to our app!</h1><p>Please click this link to verify your email address:</p><a href="${verificationUrl}">${verificationUrl}</a>`
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({ message: 'User created successfully. Please check your email to verify your account.' });

    } catch (err) {
        console.error('Registration error:', err);
        if (err.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ message: 'Username or email already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM user_accounts WHERE email = $1', [email]);
        client.release();

        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        if (!user.is_verified) {
            return res.status(403).json({ message: 'Account is not verified. Please check your email.' });
        }

        // Generate and send a new JWT for authenticated sessions
        const token = jwt.sign({ userId: user.user_id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        
        res.status(200).json({ message: 'Login successful', token });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// Account Verification Route
app.get('/api/verify', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ message: 'Token is missing.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const client = await pool.connect();
        
        // 1. Check if the user is already verified
        const userCheckResult = await client.query('SELECT is_verified FROM user_accounts WHERE user_id = $1', [decoded.userId]);
        const user = userCheckResult.rows[0];

        if (!user) {
            client.release();
            return res.status(400).json({ message: 'User not found for this token.' });
        }

        if (user.is_verified) {
            client.release();
            return res.status(200).json({ message: 'Account has been verified! You can now log in.' });
        }

        // 2. If not verified, proceed with the update
        await client.query('UPDATE user_accounts SET is_verified = TRUE WHERE user_id = $1', [decoded.userId]);
        
        client.release();

        res.status(200).json({ message: 'Account verified successfully!' });

    } catch (err) {
        console.error('Verification error:', err);
        res.status(400).json({ message: 'Verification failed. The token is invalid.' });
    }
});

app.get('/', (req, res) => {
  res.json({ message: 'Express server is running and healthy!' });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

const shouldUseTavily = (messages) => {
  return messages.some(msg =>
    msg.role === 'user' && /search on the web|look this up|find online|what is|how to/i.test(msg.content)
  );
};

app.post('/api/chat-with-ollama', async (req, res) => {
  const { messages, prompt } = req.body; // Support both new messages format and legacy prompt
  const modelName = 'llama3.1';

  let conversationMessages;

  if (messages && Array.isArray(messages)) {
    conversationMessages = messages;
    console.log(`Received conversation with ${messages.length} messages`);
  } else if (prompt) {
    conversationMessages = [{ role: 'user', content: prompt }];
    console.log('Received legacy prompt format');
  } else {
    return res.status(400).json({
      error: 'Either "messages" array or "prompt" string is required in the request body.'
    });
  }

  const isValidMessage = (msg) => {
    return msg &&
               typeof msg === 'object' &&
               msg.role &&
               msg.content &&
               ['system', 'user', 'assistant'].includes(msg.role);
  };

  if (!conversationMessages.every(isValidMessage)) {
    return res.status(400).json({
      error: 'Invalid message format. Each message must have "role" and "content" properties.'
    });
  }

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const userMessagesCount = conversationMessages.filter(m => m.role === 'user').length;
    const assistantMessagesCount = conversationMessages.filter(m => m.role === 'assistant').length;
    const systemMessagesCount = conversationMessages.filter(m => m.role === 'system').length;

    console.log(`Processing conversation: ${systemMessagesCount} system, ${userMessagesCount} user, ${assistantMessagesCount} assistant messages`);

    // --- Tavily Integration Start ---
    console.log('Should use Tavily?', shouldUseTavily(conversationMessages));
    console.log(conversationMessages);

    if (shouldUseTavily(conversationMessages)) {
      console.log('Tavily search triggered by user query.');
      const lastUserMessage = conversationMessages
        .filter(msg => msg.role === 'user')
        .slice(-1)[0]?.content; // Get the content of the last user message

      if (lastUserMessage) {
        const tavilyResult = await performTavilySearch(lastUserMessage);

        if (tavilyResult?.answer) {
          conversationMessages.push({
            role: 'system',
            content: `Web search result from Tavily: ${tavilyResult.answer}`
          });
          console.log('Tavily answer:', tavilyResult.answer);
          console.log('Injected Tavily result as system message into conversation.');
        } else {
          console.log('Tavily search returned no answer or an error.');
        }
      }
    }
    // --- Tavily Integration End ---

    const responseStream = await ollama.chat({
      model: modelName,
      messages: conversationMessages, // Pass the potentially modified conversationMessages
      stream: true,
      options: {
        // Optimize for conversation
        temperature: 0.7,
        top_p: 0.9,
        // Set context length for better conversation handling
        num_ctx: 4096,
      }
    });

    for await (const chunk of responseStream) {
      const content = chunk.message.content || '';

      if (content) {
        res.write(JSON.stringify({
          success: true,
          ollamaResponseChunk: content
        }) + '\n');
      }
    }

    res.end();
    console.log('Response streaming completed successfully');

  } catch (error) {
    console.error('Error communicating with Ollama:', error);

    // Check if headers were already sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to communicate with Ollama server.',
        details: error.message,
      });
    } else {
      // If streaming already started, send error through the stream
      res.write(JSON.stringify({
        success: false,
        error: 'Stream interrupted: Failed to communicate with Ollama server.',
        details: error.message,
      }) + '\n');
      res.end();
    }
  }
});



// Updated summarization endpoint in your Express server
app.post('/api/summarize-with-ollama', async (req, res) => {
  const { messages } = req.body;
  const modelName = 'llama3.1';
  console.log("triggered");

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ 
      success: false,
      error: 'Messages array is required for summarization.' 
    });
  }

  try {
    console.log(`Summarizing conversation with ${messages.length} message(s)`);
    
    const response = await ollama.chat({
      model: modelName,
      messages: messages, // The messages already include the appropriate system prompt
      stream: false,
      options: {
        temperature: 0.5, // Lower temperature for more consistent summaries
        top_p: 0.8,
        num_ctx: 4096,
      }
    });

    const summary = response.message.content.trim();
    
    // Validate and analyze summary
    const wordCount = summary.split(/\s+/).length;
    const charCount = summary.length;
    
    // Check if summary seems reasonable
    if (wordCount < 5) {
      console.warn(`Summary too short (${wordCount} words):`, summary);
    } else if (wordCount > 200) {
      console.warn(`Summary very long (${wordCount} words):`, summary);
    }
    
    console.log(`Summary generated: ${wordCount} words, ${charCount} characters`);
    console.log('Summary content:', summary);
    
    return res.json({ 
      success: true, 
      summary,
      wordCount,
      charCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error with Ollama summarization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary from Ollama.',
      details: error.message,
    });
  }
});

app.get('/api/chats', authenticateToken, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(
            'SELECT chat_id, title, created_at, updated_at FROM chats WHERE created_by_user_id = $1 ORDER BY updated_at DESC',
            [req.user.userId]
        );
        client.release();

        res.json({ chats: result.rows });
    } catch (err) {
        console.error('Error fetching chats:', err);
        res.status(500).json({ message: 'Failed to fetch chats.' });
    }
});

// Create a new chat
app.post('/api/chats', authenticateToken, async (req, res) => {
    const { title } = req.body;

    if (!title || title.trim() === '') {
        return res.status(400).json({ message: 'Chat title is required.' });
    }

    try {
        const client = await pool.connect();
        const result = await client.query(
            'INSERT INTO chats (title, created_by_user_id, context) VALUES ($1, $2, $3) RETURNING chat_id, title, created_at',
            [title.trim(), req.user.userId, JSON.stringify({})]
        );
        client.release();

        res.status(201).json({ 
            message: 'Chat created successfully',
            chat: result.rows[0]
        });
    } catch (err) {
        console.error('Error creating chat:', err);
        res.status(500).json({ message: 'Failed to create chat.' });
    }
});

// Get messages for a specific chat
app.get('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
    const { chatId } = req.params;

    try {
        const client = await pool.connect();
        
        // First verify the user owns this chat
        const chatResult = await client.query(
            'SELECT chat_id FROM chats WHERE chat_id = $1 AND created_by_user_id = $2',
            [chatId, req.user.userId]
        );

        if (chatResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Chat not found or access denied.' });
        }

        // Get messages for this chat
        const messagesResult = await client.query(
            `SELECT message_id, sender_id, content, sent_at 
             FROM messages 
             WHERE chat_id = $1 
             ORDER BY sent_at ASC`,
            [chatId]
        );

        client.release();

        // Transform messages to match your frontend format
        const messages = messagesResult.rows.map(msg => ({
            id: msg.message_id,
            role: msg.sender_id === req.user.userId ? 'user' : 'assistant',
            content: msg.content,
            timestamp: msg.sent_at
        }));

        res.json({ messages });
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Failed to fetch messages.' });
    }
});

// Send a message to a specific chat + ollama
app.post('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
    const { chatId } = req.params;
    const { content } = req.body; // 'content' is the latest user message

    if (!content || content.trim() === '') {
        return res.status(400).json({ message: 'Message content is required.' });
    }

    try {
        const client = await pool.connect();

        // Verify the user owns this chat
        const chatResult = await client.query(
            'SELECT chat_id FROM chats WHERE chat_id = $1 AND created_by_user_id = $2',
            [chatId, req.user.userId]
        );

        if (chatResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Chat not found or access denied.' });
        }

        // Save user message (the new message that just came in)
        await client.query(
            'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3)',
            [chatId, req.user.userId, content]
        );

        // Get updated conversation history for context, including the newly added user message
        const messagesResult = await client.query(
            `SELECT sender_id, content, sent_at
             FROM messages
             WHERE chat_id = $1
             ORDER BY sent_at ASC`,
            [chatId]
        );

        client.release(); // Release client early as database operations for history are done

        // Prepare messages for Ollama, converting database format to Ollama's expected role/content
        let conversationMessages = messagesResult.rows.map(msg => ({
            role: msg.sender_id === req.user.userId ? 'user' : 'assistant', // Map based on sender_id
            content: msg.content
        }));


        // --- Tavily Integration Start ---
        // The last message in conversationMessages is the one just sent by the user
        const lastUserMessageInHistory = conversationMessages.length > 0 &&
                                         conversationMessages[conversationMessages.length - 1].role === 'user' ?
                                         conversationMessages[conversationMessages.length - 1].content : null;

        if (lastUserMessageInHistory && shouldUseTavily([{ role: 'user', content: lastUserMessageInHistory }])) {
            console.log('Tavily search triggered by user query in active chat.');
            const tavilyResult = await performTavilySearch(lastUserMessageInHistory);

            if (tavilyResult?.answer) {
                // Prepend Tavily result as a system message for Ollama context
                // This gives Ollama factual information before generating its response
                conversationMessages.unshift({
                    role: 'system',
                    content: `Web search result from Tavily: ${tavilyResult.answer}. Integrate this information seamlessly into your response without explicitly mentioning that it was looked up or provided to you.`
                });
                console.log('Tavily answer injected into conversation:', tavilyResult.answer);
            } else {
                console.log('Tavily search returned no answer or an error for the user query.');
            }
        }
        // --- Tavily Integration End ---

        // Stream response from Ollama
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const modelName = 'llama3.1';
        const responseStream = await ollama.chat({
            model: modelName,
            messages: conversationMessages, // Pass the potentially modified conversationMessages with Tavily context
            stream: true,
            options: {
                temperature: 0.7,
                top_p: 0.9,
                num_ctx: 4096,
            }
        });

        let fullResponse = '';
        for await (const chunk of responseStream) {
            const content = chunk.message.content || '';
            if (content) {
                fullResponse += content;
                res.write(JSON.stringify({
                    success: true,
                    ollamaResponseChunk: content
                }) + '\n');
            }
        }

        const ASSISTANT_SENDER_ID = '00000000-0000-0000-0000-000000000000'; // Define a fixed ID for the assistant

        // Save assistant response to database
        if (fullResponse.trim()) {
            const clientForSave = await pool.connect(); // Get a new client for saving assistant message
            await clientForSave.query(
                'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3)',
                [chatId, ASSISTANT_SENDER_ID, fullResponse]
            );

            // Update chat's updated_at timestamp
            await clientForSave.query(
                'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE chat_id = $1',
                [chatId]
            );
            clientForSave.release(); // Release client after saving
        }

        res.end();
        console.log('Response streaming and saving completed successfully for chat:', chatId);

    } catch (error) {
        console.error('Error in chat message processing for chat:', chatId, error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Failed to process message.',
                details: error.message,
            });
        } else {
            res.write(JSON.stringify({
                success: false,
                error: 'Stream interrupted.',
                details: error.message,
            }) + '\n');
            res.end();
        }
    }
});

// Delete a chat
app.delete('/api/chats/:chatId', authenticateToken, async (req, res) => {
    const { chatId } = req.params;

    try {
        const client = await pool.connect();
        
        // Verify the user owns this chat
        const chatResult = await client.query(
            'SELECT chat_id FROM chats WHERE chat_id = $1 AND created_by_user_id = $2',
            [chatId, req.user.userId]
        );

        if (chatResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Chat not found or access denied.' });
        }

        // Delete messages first (foreign key constraint)
        await client.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
        
        // Delete the chat
        await client.query('DELETE FROM chats WHERE chat_id = $1', [chatId]);
        
        client.release();

        res.json({ message: 'Chat deleted successfully.' });
    } catch (err) {
        console.error('Error deleting chat:', err);
        res.status(500).json({ message: 'Failed to delete chat.' });
    }
});

// Verify token endpoint (for frontend to check if logged in)
app.get('/api/verify-token', authenticateToken, (req, res) => {
    res.json({ 
        valid: true, 
        user: { 
            userId: req.user.userId, 
            username: req.user.username 
        } 
    });
});

// Add this new endpoint
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT username, email FROM user_accounts WHERE user_id = $1', [req.user.userId]);
        client.release();

        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json({
            message: 'User data fetched successfully.',
            user: {
                userId: req.user.userId,
                username: user.username,
                email: user.email
            }
        });

    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Update a specific chat's context
app.put('/api/chats/:chatId/context', authenticateToken, async (req, res) => {
    const { chatId } = req.params;
    const { context } = req.body; // 'context' should be the updated state object

    if (!context || typeof context !== 'object') {
        return res.status(400).json({ message: 'Valid context object is required.' });
    }

    try {
        const client = await pool.connect();

        // Verify the user owns this chat before updating
        const chatResult = await client.query(
            'SELECT chat_id FROM chats WHERE chat_id = $1 AND created_by_user_id = $2',
            [chatId, req.user.userId]
        );

        if (chatResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Chat not found or access denied.' });
        }

        // Update the context in the database
        await client.query(
            'UPDATE chats SET context = $1, updated_at = CURRENT_TIMESTAMP WHERE chat_id = $2',
            [JSON.stringify(context), chatId]
        );

        client.release();

        res.json({ message: 'Chat context updated successfully.', chatId });
    } catch (err) {
        console.error('Error updating chat context:', err);
        res.status(500).json({ message: 'Failed to update chat context.' });
    }
});


app.get('/api/chats/:chatId/context', authenticateToken, async (req, res) => {
    const { chatId } = req.params;

    try {
        const client = await pool.connect();

        // Verify the user owns this chat before retrieving context
        const chatResult = await client.query(
            'SELECT context FROM chats WHERE chat_id = $1 AND created_by_user_id = $2',
            [chatId, req.user.userId]
        );

        if (chatResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Chat not found or access denied.' });
        }

        const chatContext = chatResult.rows[0].context;
        client.release();

        res.json({ 
            message: 'Chat context retrieved successfully.', 
            chatId,
            context: chatContext || {} 
        });
    } catch (err) {
        console.error('Error retrieving chat context:', err);
        res.status(500).json({ message: 'Failed to retrieve chat context.' });
    }
});




// Health check endpoint for context management
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: ['context-support', 'streaming', 'conversation-history']
  });
});


app.listen(port, () => {
  console.log(`Express server listening at http://localhost:${port}`);
  console.log('Features: Context-aware conversations, Message streaming, History management');
});