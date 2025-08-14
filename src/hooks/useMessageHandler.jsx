import { useCallback, useRef } from 'react';
import { CONSTANTS } from '../utils/constants.js';
// ContextManager is now primarily managed by useChatManager, so it's not directly needed here
// import { ContextManager } from '../utils/contextManager.js';

export const useMessageHandler = ({
    input,
    setInput,
    // setMessages, // Messages are now managed by useChatManager
    setIsLoading, // This refers to the input loading state, can be used to disable input
    activeListener,
    setActiveListener,
    stop, // Porcupine stop
    start, // Porcupine start
    isLoading, // Overall loading state from MainChatWindow (driven by useChatManager)
    // authenticatedFetch, // No longer directly used here for API calls
    // selectedChatId,     // No longer directly used here for API calls
    sendCoreMessage // NEW PROP: The core message sending function from useChatManager
}) => {
    // contextManagerRef is now managed by useChatManager, removed from here
    // const contextManagerRef = useRef(new ContextManager());
    
    // Placeholder: This should be handled by the useSpeechRecognition hook directly
    // or passed down from MainChatWindow if it needs to trigger this.
    const stopSpeechRecognition = useCallback(() => {
      // This will be handled in the speech recognition hook
    }, []);

    const handleSendMessage = useCallback(async (messageContent) => {
        const contentToSend = typeof messageContent === 'string' ? messageContent.trim() : input.trim();
        if (contentToSend === '' || isLoading) { // Prevent sending if loading or empty
            console.log("Message is empty or app is loading, skipping send.");
            return;
        }
        
        // Explicitly stop all listening before sending the message
        stopSpeechRecognition();
        if (activeListener === 'porcupine') {
            await stop();
            setActiveListener('none');
            console.log("Porcupine: Stopped for message sending.");
        }
        
        // Clear input field immediately
        setInput(''); 
        // setIsLoading(true); // This might be redundant if isLoading comes from useChatManager

        // Delegate the actual message sending logic to the core function provided by useChatManager
        try {
            await sendCoreMessage(contentToSend);
        } catch (error) {
            console.error("useMessageHandler: Error sending message via core function:", error);
            // Error handling will primarily be managed by useChatManager and displayed in ChatMessages
        } finally {
            // Re-enable listening after a short delay
            setTimeout(async () => {
                if (!isLoading) { // Only restart if the overall app is not loading (i.e., LLM response finished)
                    try {
                        await start();
                        setActiveListener('porcupine');
                        console.log("Porcupine: Resumed listening for wake word.");
                    } catch (e) {
                        console.error("Porcupine: Failed to restart after message completion:", e);
                    }
                }
            }, CONSTANTS.PORCUPINE_RESTART_DELAY);
        }
    }, [input, isLoading, activeListener, stop, start, stopSpeechRecognition, setInput, sendCoreMessage]);

    // The following functions are context manager specific, which is now owned by useChatManager.
    // They are left as placeholders or removed if not needed directly by the input handler.
    const clearContext = useCallback(() => {
        // This should now be handled via useChatManager.clearCurrentChat or a dedicated context clear function from useChatManager
        // contextManagerRef.current.clearContext();
        console.warn('Clear context called in useMessageHandler. Should be handled by useChatManager.');
    }, []);

    const getContextStats = useCallback(() => {
        // This should be retrieved from useChatManager's exposed contextManager
        // return contextManagerRef.current.getStats();
        console.warn('Get context stats called in useMessageHandler. Should be retrieved from useChatManager.');
        return {};
    }, []);

    // Other context-related functions like forceSummaryUpdate, exportContext, importContext
    // are also now part of useChatManager's responsibility or its exposed contextManager.

    return { 
        handleSendMessage, 
        clearContext, 
        getContextStats,
        // forceSummaryUpdate, exportContext, importContext, contextManager are no longer returned here
    };
};
