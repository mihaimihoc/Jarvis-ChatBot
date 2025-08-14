import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { usePorcupine } from "@picovoice/porcupine-react";
import ChatHeader from './components/ChatHeader.jsx';
import ChatMessages from './components/ChatMessages.jsx';
import ChatInput from './components/ChatInput.jsx';
import ScrollToBottomButton from './components/ScrollToBottomButton.jsx';
import ChatList from './components/ChatList.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth, AuthProvider } from './hooks/AuthContext.jsx';
import { useChatManager } from './hooks/useChatManager.jsx';
import { useSpeechRecognition } from './hooks/useSpeechRecognition.jsx';
import { usePorcupineEngine } from './hooks/usePorcupineEngine.jsx';
import { useMessageHandler } from './hooks/useMessageHandler.jsx';
import { useScrollManagement } from './hooks/useScrollManagement.jsx';
import { CONSTANTS } from './utils/constants.js';
import './App.css';

// A new component to contain the main chat UI logic
// A new component to contain the main chat UI logic
function MainChatWindow() {
    // --- STATE AND REFS DECLARATIONS ---
    const { authenticatedFetch, user, logout } = useAuth(); // Add logout from useAuth
    const { chatId } = useParams();
    const navigate = useNavigate();
    
    // Add a ref to track if we've initialized the chat selection
    const hasInitializedRef = useRef(false);

    // Use the central useChatManager hook
    const {
        selectedChatId,
        messages,
        isLoading: isChatLoading,
        error: chatError,
        title,
        sendMessage: sendChatMessage,
        selectChat,
        clearCurrentChat,
        contextManager,
        chatListRefreshTrigger // Get the refresh trigger
    } = useChatManager({ authenticatedFetch, navigate });

    const [input, setInput] = useState('');
    const [isListeningForSpeech, setIsListeningForSpeech] = useState(false);
    const [activeListener, setActiveListener] = useState('none');
    const [isInputLoading, setIsInputLoading] = useState(false);

    const recognitionRef = useRef(null);
    const listeningTimeoutRef = useRef(null);
    const inputRef = useRef('');
    const messagesRef = useRef([]);
    const chatDisplayRef = useRef(null);
    const messagesEndRef = useRef(null);

    // --- PORCUPINE HOOKS ---
    const {
        keywordDetection,
        isLoaded,
        error, // Porcupine error
        init,
        start,
        stop,
        release,
    } = usePorcupine();

    // --- CUSTOM HOOKS (adapted) ---
    const { handleSendMessage: handleInputSendMessage, clearContext, getContextStats } = useMessageHandler({
        input,
        setInput,
        setIsLoading: setIsInputLoading,
        activeListener,
        setActiveListener,
        stop,
        start,
        isLoading: isChatLoading,
        authenticatedFetch,
        selectedChatId,
        sendCoreMessage: sendChatMessage
    });

    const { startSpeechRecognition, stopSpeechRecognition, toggleSpeechRecognition } = useSpeechRecognition({
        recognitionRef,
        listeningTimeoutRef,
        setInput,
        setIsListeningForSpeech,
        setActiveListener,
        handleSendMessage: handleInputSendMessage,
        start,
        stop,
        activeListener,
        isLoading: isChatLoading,
        isListeningForSpeech
    });

    const { isAutoScrollingActive, showScrollToBottomButton } = useScrollManagement({
        chatDisplayRef,
        messagesEndRef,
        messages
    });

    // Initialize Porcupine engine
    usePorcupineEngine({
        isLoaded,
        activeListener,
        setActiveListener,
        isLoading: isChatLoading,
        init,
        start,
        stop,
        release,
        keywordDetection,
        startSpeechRecognition
    });

    // --- EFFECT TO SYNC URL CHAT ID WITH useChatManager's selectedChatId ---
    useEffect(() => {
        // Always call selectChat on mount or when chatId changes
        // This handles both initial page load and navigation changes
        console.log(`URL chatId is: ${chatId}, selectedChatId is: ${selectedChatId}, hasInitialized: ${hasInitializedRef.current}`);
        
        // Call selectChat if:
        // 1. We haven't initialized yet (first render), OR
        // 2. The chatId from URL is different from currently selected chat
        // BUT only if we're not in the middle of loading or creating
        if ((!hasInitializedRef.current || chatId !== selectedChatId) && !isChatLoading) {
            console.log(`Selecting chat from URL: ${chatId || 'new chat'}`);
            selectChat(chatId || null);
            hasInitializedRef.current = true;
        }
    }, [chatId, selectedChatId, selectChat, isChatLoading]);

    // --- SYNC REFS WITH STATE ---
    useEffect(() => {
        inputRef.current = input;
    }, [input]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // --- EVENT HANDLERS ---
    const handleInputChange = (e) => {
        setInput(e.target.value);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                e.preventDefault();
                setInput(prevInput => prevInput + '\n');
            } else if (!isInputLoading && !isChatLoading) {
                e.preventDefault();
                handleInputSendMessage();
            }
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Chat selection logic: navigate to the chat ID directly
    const handleChatSelect = (id) => {
        console.log(`Navigating to chat: ${id}`);
        navigate(`/${id}`);
    };

    // Handle creation of a new chat: navigate to the root path
    const handleNewChat = () => {
        console.log('Creating new chat - navigating to root');
        navigate('/');
    };

    return (
        <div className="chat-app-container">
            <ChatList
                selectedChatId={selectedChatId}
                onChatSelect={handleChatSelect}
                onNewChat={handleNewChat}
                authenticatedFetch={authenticatedFetch}
                user={user}
                onLogout={logout}
                refreshTrigger={chatListRefreshTrigger} // Pass the refresh trigger
            />

            <div className="main-chat-window">
                <ChatHeader chatTitle={title} />
                <ChatMessages
                    ref={chatDisplayRef}
                    messages={messages}
                    messagesEndRef={messagesEndRef}
                    error={chatError || error}
                    activeListener={activeListener}
                    isLoaded={isLoaded}
                    isLoading={isChatLoading}
                />
                {showScrollToBottomButton && (
                    <ScrollToBottomButton onClick={scrollToBottom} />
                )}
                <ChatInput
                    input={input}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    onSend={handleInputSendMessage}
                    onToggleSpeech={toggleSpeechRecognition}
                    isLoading={isInputLoading || isChatLoading}
                    isListeningForSpeech={isListeningForSpeech}
                    recognitionRef={recognitionRef}
                />
            </div>
        </div>
    );
}

// Top-level App component (remains mostly the same)
function App() {
    const navigate = useNavigate();

    const onRedirectToLogin = () => {
        navigate('/login');
    };

    return (
        <AuthProvider onRedirectToLogin={onRedirectToLogin}>
            <AppContent />
        </AuthProvider>
    );
}

// Component to render inside the router
function AppContent() {
    const { isAuthenticated, loading } = useAuth();

    return (
        <div className="app-wrapper">
            <Routes >
                <Route path="/login" element={<div>Login Page (Placeholder)</div>} />
                <Route
                    path="/:chatId?"
                    element={
                        <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading} onRedirectToLogin={() => { /* Handled by AuthProvider */ }}>
                            <MainChatWindow />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </div>
    );
}

export default App;