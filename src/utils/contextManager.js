// Updated CONTEXT_CONFIG with new running summary approach
export const CONTEXT_CONFIG = {
    INITIAL_MESSAGES_FOR_FIRST_SUMMARY: 8, // Create first summary after this many messages (wait longer)
    MESSAGES_BEFORE_UPDATE: 4, // Update summary after this many new messages (less frequent updates)
    MAX_RECENT_MESSAGES: 12, // Keep this many recent messages alongside summary (keep more recent context)
    MAX_SUMMARY_WORDS: 1000, // Maximum words for summary (more concise)
    SYSTEM_MESSAGE: {
        role: 'system',
        content: `You are JARVIS, an advanced AI assistant inspired by Tony Stark's AI companion. You are helpful, intelligent, and maintain a slightly sophisticated but friendly tone. You remember the conversation context and can reference previous messages naturally.`
    }
};

export class ContextManager {
    constructor() {
        this.conversationHistory = [];
        this.runningSummary = null;
        this.messagesSinceLastSummary = 0;
        this.isOptimizing = false;
        this.totalMessagesProcessed = 0;
    }

    /**
     * Adds a new message to the conversation history and triggers context optimization.
     * @param {object} message - The message object (must have role and content).
     */
    async addMessage(message) {
        if (message.role === 'user' || message.role === 'assistant') {
            this.conversationHistory.push({
                role: message.role,
                content: message.content,
                timestamp: Date.now()
            });
            
            this.messagesSinceLastSummary++;
            this.totalMessagesProcessed++;
            
            console.log(`Context Manager: Added ${message.role} message. Total: ${this.conversationHistory.length}, Since last summary: ${this.messagesSinceLastSummary}`);
        }

        // Call the optimization method
        // Using an IIFE to allow async operation without blocking the main thread
        (async () => {
            await this.optimizeContext();
        })(); 
    }

    /**
     * Gets the current context array formatted for sending to the LLM backend.
     * Includes system message, running summary (if available), and recent conversation history.
     * @returns {Array<object>} An array of messages representing the conversation context.
     */
    getContextForServer() {
        const context = [CONTEXT_CONFIG.SYSTEM_MESSAGE];
        
        // Add the running summary if it exists
        if (this.runningSummary && this.runningSummary.trim()) {
            context.push({
                role: 'system', // Summary is treated as a system message to provide context
                content: `Conversation context: ${this.runningSummary}`
            });
        }
        
        // Add recent conversation history
        // This slice ensures we only send the actively managed recent messages
        context.push(...this.conversationHistory.slice(-CONTEXT_CONFIG.MAX_RECENT_MESSAGES));
        
        return context;
    }

    /**
     * Manages and optimizes the conversation context, generating or updating summaries as needed.
     * Prevents multiple optimization calls from running concurrently.
     */
    async optimizeContext() {
        if (this.isOptimizing) {
            console.log('Context Manager: Optimization already in progress, skipping.');
            return;
        }

        const shouldCreateFirstSummary = !this.runningSummary && 
            this.totalMessagesProcessed >= CONTEXT_CONFIG.INITIAL_MESSAGES_FOR_FIRST_SUMMARY;
        
        const shouldUpdateSummary = this.runningSummary && 
            this.messagesSinceLastSummary >= CONTEXT_CONFIG.MESSAGES_BEFORE_UPDATE;

        if (shouldCreateFirstSummary || shouldUpdateSummary) {
            this.isOptimizing = true;
            console.log(`Context Manager: Starting optimization. First summary needed: ${shouldCreateFirstSummary}, Update needed: ${shouldUpdateSummary}`);
            try {
                if (shouldCreateFirstSummary) {
                    console.log(`Context Manager: Creating initial summary (${this.totalMessagesProcessed} total messages processed)`);
                    await this.createInitialSummary();
                } else if (shouldUpdateSummary) {
                    console.log(`Context Manager: Updating summary (${this.messagesSinceLastSummary} new messages since last summary)`);
                    await this.updateRunningSummary();
                }
            } catch (error) {
                console.error('Error during context optimization:', error);
            } finally {
                this.isOptimizing = false;
                console.log("Context Manager: Optimization complete.");
            }
        }
        
        // Keep only recent messages alongside the summary
        // This is done regardless of whether a summary was generated/updated
        if (this.conversationHistory.length > CONTEXT_CONFIG.MAX_RECENT_MESSAGES) {
            const messagesToRemove = this.conversationHistory.length - CONTEXT_CONFIG.MAX_RECENT_MESSAGES;
            this.conversationHistory.splice(0, messagesToRemove);
            console.log(`Context Manager: Trimmed ${messagesToRemove} old messages, kept ${this.conversationHistory.length} recent messages`);
        }
    }

    /**
     * Generates the initial summary from the current `conversationHistory`.
     */
    async createInitialSummary() {
        console.log('Context Manager: Creating initial summary...');
        
        const messagesToSummarize = [...this.conversationHistory]; // Summarize current history
        
        if (messagesToSummarize.length === 0) {
            console.log('Context Manager: No messages to summarize for initial summary.');
            return;
        }
        
        const summary = await this.generateSummary(messagesToSummarize, 'initial');
        
        if (summary && summary.trim()) {
            this.runningSummary = summary.trim();
            this.messagesSinceLastSummary = 0; // Reset count after summary
            console.log('Context Manager: Initial summary created:', this.runningSummary);
            console.log(`Context Manager: Summarized ${messagesToSummarize.length} messages.`);
        } else {
            console.warn('Context Manager: Initial summary generation returned empty or null.');
        }
    }

    /**
     * Updates the existing running summary with newly added messages.
     */
    async updateRunningSummary() {
        console.log('Context Manager: Updating running summary...');
        
        // Get the new messages added since the last summary operation
        const newMessages = this.conversationHistory.slice(-this.messagesSinceLastSummary);
        
        if (!this.runningSummary || newMessages.length === 0) {
            console.log('Context Manager: No existing summary or no new messages to update with.');
            return;
        }

        const updatedSummary = await this.updateSummaryWithNewMessages(this.runningSummary, newMessages);
        
        if (updatedSummary && updatedSummary.trim()) {
            this.runningSummary = updatedSummary.trim();
            this.messagesSinceLastSummary = 0; // Reset count after summary update
            console.log('Context Manager: Summary updated:', this.runningSummary);
        } else {
            console.warn('Context Manager: Updated summary generation returned empty or null. Keeping old summary.');
        }
    }

    /**
     * Makes an API call to generate a summary from a set of messages.
     * @param {Array<object>} messages - Messages to summarize.
     * @param {string} type - Type of summary ('initial' or 'update').
     * @returns {Promise<string|null>} The generated summary or null if failed.
     */
    async generateSummary(messages, type = 'initial') {
        if (!messages || messages.length === 0) {
            return null;
        }

        const summaryPrompt = {
            role: 'system',
            content: `You are a conversation summarizer. Your task is to analyze the ENTIRE conversation history and create a concise summary that:
1. Captures ALL key points and topics discussed
2. Maintains the current state of any ongoing activities/games
3. Preserves important details from earlier in the conversation
4. Is written in third-person perspective
5. Does NOT exceed ${CONTEXT_CONFIG.MAX_SUMMARY_WORDS} words

SPECIAL INSTRUCTIONS FOR WORD ASSOCIATION GAME:
- Track the complete sequence of words used in the game
- Note whose turn it currently is
- Preserve any special rules or patterns established

Conversation to summarize:`
        };

        const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: `${msg.role}: ${msg.content}`
        }));

        const summarizationMessages = [
            summaryPrompt,
            ...formattedMessages,
            {
                role: 'user',
                content: 'Please generate a comprehensive summary of the above conversation, focusing particularly on maintaining the accurate state of any ongoing games or activities.'
            }
        ];

        try {
            const response = await fetch('/api/summarize-with-ollama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: summarizationMessages }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (data.success && data.summary) {
                console.log(`Context Manager: ${type} summary generated (${data.wordCount || 'unknown'} words)`);
                return data.summary;
            } else {
                throw new Error(data.error || 'No summary received from server');
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            return null;
        }
    }

    /**
     * Makes an API call to update an existing summary with new messages.
     * @param {string} currentSummary - The existing summary.
     * @param {Array<object>} newMessages - New messages to incorporate.
     * @returns {Promise<string>} The updated summary or the original summary if failed.
     */
    async updateSummaryWithNewMessages(currentSummary, newMessages) {
        if (!newMessages || newMessages.length === 0) {
            return currentSummary;
        }

        const updatePrompt = {
            role: 'system',
            content: `You are a conversation summarizer. Your task is to update an existing summary with new messages while:
1. Preserving ALL important information from the current summary
2. Incorporating relevant new information
3. Maintaining accurate state of any ongoing games/activities
4. Keeping the summary concise (under ${CONTEXT_CONFIG.MAX_SUMMARY_WORDS} words)
5. Using third-person perspective

SPECIAL INSTRUCTIONS FOR WORD ASSOCIATION GAME:
- Track the complete sequence of words used in the game
- Note whose turn it currently is
- Preserve any special rules or patterns established

Current Summary:
"${currentSummary}"

New messages to incorporate:`
        };

        const formattedNewMessages = newMessages.map(msg => ({
            role: msg.role,
            content: `${msg.role}: ${msg.content}`
        }));

        const updateMessages = [
            updatePrompt,
            ...formattedNewMessages,
            {
                role: 'user',
                content: 'Please update the summary by combining the current summary with the new messages, ensuring all game states and important details are preserved.'
            }
        ];

        try {
            const response = await fetch('/api/summarize-with-ollama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updateMessages }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (data.success && data.summary) {
                console.log(`Context Manager: Summary updated (${data.wordCount || 'unknown'} words)`);
                return data.summary;
            } else {
                throw new Error(data.error || 'No updated summary received from server');
            }
        } catch (error) {
            console.error('Error updating summary:', error);
            return currentSummary;
        }
    }

    /**
     * Clears all conversation context, summary, and statistics.
     */
    clearContext() {
        this.conversationHistory = [];
        this.runningSummary = null;
        this.messagesSinceLastSummary = 0;
        this.totalMessagesProcessed = 0;
        this.isOptimizing = false;
        console.log('Context Manager: All context cleared');
    }

    /**
     * Populates the context manager with an array of messages, typically from a database load.
     * @param {Array<object>} messages - An array of message objects with `role` and `content`.
     */
    importFromMessages(messages) {
        if (!messages || !Array.isArray(messages)) {
            console.warn("Context Manager: importFromMessages received invalid data.");
            return;
        }
        this.clearContext(); // Ensure a clean slate before importing
        messages.forEach(msg => {
            // Only add 'user' and 'assistant' roles to history
            // Ensure content is a string
            if ((msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string') {
                this.conversationHistory.push({
                    role: msg.role,
                    content: msg.content,
                    // Use sent_at from DB if available, otherwise current timestamp
                    timestamp: msg.sent_at ? new Date(msg.sent_at).getTime() : Date.now() 
                });
            }
        });
        this.totalMessagesProcessed = this.conversationHistory.length;
        // Do not generate a summary immediately; let optimizeContext decide later if needed
        console.log(`Context Manager: Imported ${this.conversationHistory.length} messages from database.`);
    }

    /**
     * Gets current statistics about the conversation context.
     * @returns {object} An object containing various context statistics.
     */
    getStats() {
        const recentMessages = this.conversationHistory;
        return {
            recentMessageCount: recentMessages.length,
            totalMessagesProcessed: this.totalMessagesProcessed,
            messagesSinceLastSummary: this.messagesSinceLastSummary,
            estimatedTokens: this.estimateTokens(recentMessages),
            oldestRecentMessage: recentMessages.length > 0 ?
                new Date(recentMessages[0].timestamp).toLocaleString() : null,
            newestMessage: recentMessages.length > 0 ?
                new Date(recentMessages[recentMessages.length - 1].timestamp).toLocaleString() : null,
            runningSummary: this.runningSummary,
            hasSummary: !!(this.runningSummary && this.runningSummary.trim()),
            summaryWordCount: this.runningSummary ? this.runningSummary.split(/\s+/).length : 0,
            isOptimizing: this.isOptimizing
        };
    }

    /**
     * Estimates the number of tokens in the current conversation history and summary.
     * (Rough estimate: 1 token ≈ 4 characters)
     * @param {Array<object>} messages - Messages to estimate tokens from.
     * @returns {number} Estimated token count.
     */
    estimateTokens(messages) {
        let totalChars = 0;
        
        // Count characters in recent messages
        totalChars += messages.reduce((sum, msg) => sum + (msg.content ? msg.content.length : 0), 0);
        
        // Count characters in summary
        if (this.runningSummary) {
            totalChars += this.runningSummary.length;
        }
        
        // Add a buffer for system messages and formatting
        totalChars += CONTEXT_CONFIG.SYSTEM_MESSAGE.content.length;
        if (this.runningSummary) {
             totalChars += "Conversation context: ".length; // For the summary prefix
        }

        return Math.ceil(totalChars / 4);
    }

    /**
     * Exports the current context for debugging or saving purposes.
     * @returns {object} An object containing the current context state.
     */
    exportContext() {
        return {
            recentHistory: this.conversationHistory,
            runningSummary: this.runningSummary,
            messagesSinceLastSummary: this.messagesSinceLastSummary,
            totalMessagesProcessed: this.totalMessagesProcessed,
            config: CONTEXT_CONFIG,
            stats: this.getStats()
        };
    }

    /**
     * Imports a previously exported context to restore a session.
     * @param {object} contextData - The context data to import.
     */
    importContext(contextData) {
        if (contextData && contextData.recentHistory && Array.isArray(contextData.recentHistory)) {
            this.conversationHistory = contextData.recentHistory;
            if (contextData.runningSummary) {
                this.runningSummary = contextData.runningSummary;
            }
            this.messagesSinceLastSummary = contextData.messagesSinceLastSummary || 0;
            this.totalMessagesProcessed = contextData.totalMessagesProcessed || this.conversationHistory.length;
            this.isOptimizing = false;
            console.log('Context Manager: Context imported successfully');
        } else {
            console.warn('Context Manager: Invalid context data provided for importContext.');
        }
    }

    /**
     * Forces a summary update (useful for testing or manual triggers).
     */
    async forceSummaryUpdate() {
        if (this.conversationHistory.length > 0) {
            this.messagesSinceLastSummary = CONTEXT_CONFIG.MESSAGES_BEFORE_UPDATE; // Trigger an update
            await this.optimizeContext();
        }
    }
}
