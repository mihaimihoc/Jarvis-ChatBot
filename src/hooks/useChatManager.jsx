import { useState, useEffect, useCallback, useRef } from 'react';
import { ContextManager } from '../utils/contextManager.js';

export const useChatManager = ({ authenticatedFetch, navigate }) => {
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [title, setTitle] = useState('');
    
    // Add state to trigger chat list refresh when messages are sent
    const [chatListRefreshTrigger, setChatListRefreshTrigger] = useState(0);

    // Create a persistent context manager instance for the currently selected chat
    const contextManagerRef = useRef(new ContextManager());
    
    // Track if we're in the middle of creating a new chat to prevent loading during creation
    const isCreatingNewChatRef = useRef(false);
    
    // Add a ref to track the current chat ID to prevent stale closures
    const currentChatIdRef = useRef(selectedChatId);
    currentChatIdRef.current = selectedChatId;

    // Add a ref to track if we're currently loading a chat to prevent duplicate loads
    const isLoadingChatRef = useRef(false);

    // Track the chat ID that we just created and are populating with messages
    const newlyCreatedChatIdRef = useRef(null);

    /**
     * Saves messages to the database for the specified chat
     */
    const saveMessagesToDatabase = useCallback(async (chatId, messagesToSave) => {
        if (!chatId || !messagesToSave || messagesToSave.length === 0) {
            return;
        }

        try {
            // Save the messages to ensure they persist
            await authenticatedFetch(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesToSave })
            });
            console.log(`Saved ${messagesToSave.length} messages to database for chat ${chatId}`);
        } catch (error) {
            console.warn('Failed to save messages to database:', error);
        }
    }, [authenticatedFetch]);

    /**
     * Saves the current context to the database for the selected chat
     */
    const saveContextToDatabase = useCallback(async (chatId) => {
        if (!chatId || isCreatingNewChatRef.current) {
            return; // Don't save context if no chat or if creating new chat
        }

        try {
            const contextData = contextManagerRef.current.exportContext();
            await authenticatedFetch(`/api/chats/${chatId}/context`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    context: {
                        runningSummary: contextData.runningSummary,
                        messagesSinceLastSummary: contextData.messagesSinceLastSummary,
                        totalMessagesProcessed: contextData.totalMessagesProcessed,
                        lastUpdated: new Date().toISOString()
                    }
                })
            });
            console.log(`Context saved for chat ${chatId}`);
        } catch (error) {
            console.warn('Failed to save context to database:', error);
        }
    }, [authenticatedFetch]);

    /**
     * Loads context from the database for the specified chat
     */
    const loadContextFromDatabase = useCallback(async (chatId) => {
        try {
            const response = await authenticatedFetch(`/api/chats/${chatId}/context`);
            if (response.ok) {
                const data = await response.json();
                if (data.context && data.context.runningSummary) {
                    // Import the saved context
                    contextManagerRef.current.runningSummary = data.context.runningSummary;
                    contextManagerRef.current.messagesSinceLastSummary = data.context.messagesSinceLastSummary || 0;
                    contextManagerRef.current.totalMessagesProcessed = data.context.totalMessagesProcessed || 0;
                    console.log(`Context loaded from database for chat ${chatId}:`, data.context);
                    return true;
                }
            }
        } catch (error) {
            console.warn('Failed to load context from database:', error);
        }
        return false;
    }, [authenticatedFetch]);

    /**
     * Effect to load messages and restore context when selectedChatId changes.
     * This handles both loading existing chats and clearing for new ones.
     */
    useEffect(() => {
        let isCancelled = false; // Prevent race conditions
        
        const loadChat = async (chatIdToLoad) => {
            // Skip loading if we're in the middle of creating this chat
            if (isCreatingNewChatRef.current) {
                console.log(`Skipping load for chat ${chatIdToLoad} - currently being created`);
                return;
            }

            // Skip loading if this is the chat we just created and are populating
            if (newlyCreatedChatIdRef.current === chatIdToLoad) {
                console.log(`Skipping load for chat ${chatIdToLoad} - newly created, keeping current messages`);
                return;
            }

            // Skip loading if we're already loading this chat
            if (isLoadingChatRef.current) {
                console.log(`Skipping load for chat ${chatIdToLoad} - already loading`);
                return;
            }

            console.log(`Loading chat: ${chatIdToLoad}`);
            isLoadingChatRef.current = true;
            
            try {
                setIsLoading(true);
                setError(null);
                
                const response = await authenticatedFetch(`/api/chats/${chatIdToLoad}/messages`);
                
                if (isCancelled) return; // Don't update state if effect was cancelled
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Loaded ${data.messages?.length || 0} messages for chat ${chatIdToLoad}`);
                    setMessages(data.messages || []);
                    setTitle(data.title || `Chat ${chatIdToLoad.substring(0, 8)}...`);

                    // Try to load saved context first, if that fails, restore from messages
                    const contextLoaded = await loadContextFromDatabase(chatIdToLoad);
                    if (!contextLoaded) {
                        // Restore context from the loaded messages (fallback)
                        contextManagerRef.current.importFromMessages(data.messages || []);
                        console.log(`Context for chat ${chatIdToLoad} restored from messages with ${data.messages?.length || 0} messages.`);
                    }

                    // Trigger chat list refresh to ensure proper selection state
                    setChatListRefreshTrigger(prev => prev + 1);

                } else if (response.status === 404) {
                    console.error(`Chat ${chatIdToLoad} not found or access denied`);
                    setError('Chat not found or access denied');
                    setMessages([]);
                    // Redirect to home if chat doesn't exist or user doesn't have access
                    navigate('/', { replace: true });
                } else {
                    const errorData = await response.json();
                    setError(errorData.message || 'Failed to load chat messages');
                    setMessages([]);
                }
            } catch (err) {
                if (!isCancelled) {
                    console.error('Error loading chat messages:', err);
                    setError('Failed to connect to server or load chat history.');
                    setMessages([]);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                    isLoadingChatRef.current = false;
                }
            }
        };

        if (selectedChatId) {
            loadChat(selectedChatId);
        } else {
            // This path is for a "new chat" session (no chatId selected)
            console.log('No chat selected, setting up for new chat');
            
            // Only clear state if we're not in the middle of creating a chat
            if (!isCreatingNewChatRef.current) {
                setMessages([]);
                setTitle('New Chat');
                setError(null);
                setIsLoading(false);
                isLoadingChatRef.current = false;
                newlyCreatedChatIdRef.current = null; // Clear the newly created chat tracking
                
                // Clear context for a fresh start on a new chat
                contextManagerRef.current.clearContext();
                console.log('useChatManager: Switched to new chat session, context cleared.');
            } else {
                console.log('Skipping state clear - currently creating new chat');
            }
        }

        // Cleanup function to prevent race conditions
        return () => {
            isCancelled = true;
            isLoadingChatRef.current = false;
        };
    }, [selectedChatId, authenticatedFetch, loadContextFromDatabase, navigate]);

    /**
     * Sends a message, handles new chat creation if necessary, and streams the response.
     * @param {string} messageContent - The content of the user's message.
     */
    const sendMessage = useCallback(async (messageContent) => {
        const contentToSend = messageContent.trim();
        if (contentToSend === '') return;

        let currentChatIdentifier = currentChatIdRef.current; // Use ref to avoid stale closure

        // If no chat is currently selected, create a new one first
        if (!currentChatIdentifier) {
            setIsLoading(true);
            setError(null);
            console.log("No chat selected, initiating new chat creation...");
            
            // Mark that we're creating a new chat to prevent loading during creation
            isCreatingNewChatRef.current = true;
            
            try {
                // Determine a temporary title for the new chat
                const chatTitle = contentToSend.substring(0, 50) || "New Conversation";
                
                // Call the backend to create a new chat
                const newChatResponse = await authenticatedFetch('/api/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: chatTitle })
                });

                if (!newChatResponse.ok) {
                    const errorData = await newChatResponse.json();
                    throw new Error(`Failed to create new chat: ${errorData.message || newChatResponse.statusText}`);
                }

                const newChatData = await newChatResponse.json();
                currentChatIdentifier = newChatData.chat.chat_id;
                console.log(`New chat created with ID: ${currentChatIdentifier}`);
                
                // Mark this chat as newly created to prevent loading from database
                newlyCreatedChatIdRef.current = currentChatIdentifier;
                
                // Update state immediately
                setTitle(newChatData.chat.title || chatTitle);
                setSelectedChatId(currentChatIdentifier);
                
                // Navigate to the new chat URL
                navigate(`/${currentChatIdentifier}`, { replace: true });
                
                console.log(`Chat creation complete, ID: ${currentChatIdentifier}`);

            } catch (createChatError) {
                console.error('Error creating new chat:', createChatError);
                setMessages(prev => [...prev, { 
                    role: 'error', 
                    content: `Failed to start new chat: ${createChatError.message}`, 
                    timestamp: new Date().toISOString() 
                }]);
                setIsLoading(false);
                isCreatingNewChatRef.current = false;
                return;
            }
        }

        const userMessage = { 
            role: 'user', 
            content: contentToSend,
            timestamp: new Date().toISOString()
        };
        
        // Optimistic UI update: Add user message to UI immediately
        setMessages(prevMessages => [...prevMessages, userMessage]);
        setIsLoading(true);
        setError(null);

        // Add user message to context manager
        contextManagerRef.current.addMessage(userMessage);

        let assistantMessageIndex = -1;
        setMessages(prevMessages => {
            const newMessages = [...prevMessages, { 
                role: 'assistant', 
                content: 'Thinking...', 
                thinking: true,
                timestamp: new Date().toISOString()
            }];
            assistantMessageIndex = newMessages.length - 1;
            return newMessages;
        });

        try {
            // Send message to backend
            const response = await authenticatedFetch(`/api/chats/${currentChatIdentifier}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: contentToSend }), 
            });

            if (!response.body) {
                throw new Error('Response body is null or undefined.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let isStreamError = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    try {
                        const parsedChunk = JSON.parse(line);
                        if (parsedChunk.success) {
                            const newContent = parsedChunk.ollamaResponseChunk || '';
                            accumulatedContent += newContent;
                            setMessages(prevMessages => {
                                const updatedMessages = [...prevMessages];
                                if (assistantMessageIndex !== -1 && updatedMessages[assistantMessageIndex]) {
                                    updatedMessages[assistantMessageIndex] = {
                                        ...updatedMessages[assistantMessageIndex],
                                        content: accumulatedContent,
                                        thinking: false,
                                    };
                                }
                                return updatedMessages;
                            });
                        } else {
                            if (!isStreamError) {
                                setMessages(prevMessages => {
                                    const updatedMessages = [...prevMessages];
                                    const errorMessage = {
                                        role: 'error',
                                        content: `Server Stream Error: ${parsedChunk.error || 'Unknown'}. Details: ${parsedChunk.details || 'N/A'}`,
                                        timestamp: new Date().toISOString()
                                    };
                                    if (assistantMessageIndex !== -1) {
                                        updatedMessages.splice(assistantMessageIndex, 1, errorMessage);
                                    } else {
                                        updatedMessages.push(errorMessage);
                                    }
                                    return updatedMessages;
                                });
                                isStreamError = true;
                            }
                        }
                    } catch (jsonParseError) {
                        console.warn('Could not parse JSON chunk from stream:', line, jsonParseError);
                        if (!isStreamError) {
                            setMessages(prevMessages => {
                                const updatedMessages = [...prevMessages];
                                const errorMessage = {
                                    role: 'error',
                                    content: `Stream Parsing Error: Could not read server response. (${jsonParseError.message})`,
                                    timestamp: new Date().toISOString()
                                };
                                if (assistantMessageIndex !== -1) {
                                    updatedMessages.splice(assistantMessageIndex, 1, errorMessage);
                                } else {
                                    updatedMessages.push(errorMessage);
                                }
                                return updatedMessages;
                            });
                            isStreamError = true;
                        }
                    }
                }
            }
            
            // Add final assistant response to context manager after stream completes
            if (accumulatedContent && !isStreamError) {
                const assistantMessage = { role: 'assistant', content: accumulatedContent, timestamp: new Date().toISOString() };
                await contextManagerRef.current.addMessage(assistantMessage);
                console.log('Assistant response fully received and added to context.');
                
                // Save the updated context to database
                await saveContextToDatabase(currentChatIdentifier);
                
                // Clear the newly created chat tracking since we've completed the conversation
                if (newlyCreatedChatIdRef.current === currentChatIdentifier) {
                    newlyCreatedChatIdRef.current = null;
                    console.log('Cleared newly created chat tracking - conversation complete');
                }
                
                // Trigger chat list refresh to update order
                setChatListRefreshTrigger(prev => prev + 1);
                console.log('Triggering chat list refresh after message completion');
            }

            if (!accumulatedContent && !isStreamError) {
                setMessages(prevMessages => {
                    const updatedMessages = [...prevMessages];
                    if (assistantMessageIndex !== -1 && updatedMessages[assistantMessageIndex]) {
                        updatedMessages[assistantMessageIndex] = {
                            ...updatedMessages[assistantMessageIndex],
                            thinking: false,
                            content: updatedMessages[assistantMessageIndex].content === 'Thinking...' ? 'No response received.' : updatedMessages[assistantMessageIndex].content,
                        };
                    }
                    return updatedMessages;
                });
            }

        } catch (error) {
            console.error('Error sending message or processing stream:', error);
            if (error.message === 'Authentication failed') {
                setError('Your session has expired. Please log in again.');
                return;
            }
            setMessages(prevMessages => {
                const updatedMessages = [...prevMessages];
                const errorMessage = {
                    role: 'error',
                    content: `Network error: Failed to get response. (${error.message})`,
                    timestamp: new Date().toISOString()
                };
                if (assistantMessageIndex !== -1) {
                    updatedMessages.splice(assistantMessageIndex, 1, errorMessage);
                } else {
                    updatedMessages.push(errorMessage);
                }
                return updatedMessages;
            });
        } finally {
            setIsLoading(false);
            isCreatingNewChatRef.current = false;
            
            // If there was an error, clear the newly created chat tracking
            if (newlyCreatedChatIdRef.current === currentChatIdentifier && !accumulatedContent) {
                newlyCreatedChatIdRef.current = null;
                console.log('Cleared newly created chat tracking due to error');
            }
        }
    }, [authenticatedFetch, navigate, saveContextToDatabase]);

    /**
     * Selects a chat by its ID, updating the hook's internal state.
     * @param {string|null} chatId - The ID of the chat to select, or null for a new chat.
     */
    const selectChat = useCallback((chatId) => {
        console.log(`selectChat called with: ${chatId}, current selectedChatId: ${selectedChatId}, isCreating: ${isCreatingNewChatRef.current}`);
        
        // If we're in the middle of creating a chat, don't interfere with the process
        if (isCreatingNewChatRef.current) {
            console.log('Skipping selectChat - currently creating new chat');
            return;
        }
        
        // Always update the selected chat ID, even if it appears to be the same
        // This ensures that direct URL navigation works properly
        setSelectedChatId(chatId);
        setError(null);
        
        // Reset loading state if we're switching to a different chat
        if (chatId !== selectedChatId) {
            isLoadingChatRef.current = false;
        }
    }, [selectedChatId]);

    /**
     * Clears the current chat selection and state, preparing for a new chat session.
     */
    const clearCurrentChat = useCallback(() => {
        console.log('Clearing current chat');
        setSelectedChatId(null);
        setError(null);
        isLoadingChatRef.current = false;
        newlyCreatedChatIdRef.current = null; // Clear newly created chat tracking
    }, []);

    return {
        selectedChatId,
        messages,
        isLoading,
        error,
        title,
        sendMessage,
        selectChat,
        clearCurrentChat,
        contextManager: contextManagerRef.current,
        // Expose the refresh trigger for ChatList
        chatListRefreshTrigger
    };
};