import React, { useState, useEffect, useRef } from 'react';

const ChatList = ({ 
    selectedChatId, 
    onChatSelect, 
    onNewChat,
    authenticatedFetch,
    user,
    onLogout,
    refreshTrigger
}) => {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const previousSelectedChatIdRef = useRef(selectedChatId);
    const previousRefreshTriggerRef = useRef(refreshTrigger);
    const hasFetchedRef = useRef(false);
    const fetchedChatsRef = useRef([]);

    // Main effect to fetch chats
    useEffect(() => {
        const shouldFetch = (
            !hasFetchedRef.current || // First time
            (refreshTrigger !== previousRefreshTriggerRef.current && refreshTrigger > 0) || // Refresh trigger changed
            (selectedChatId && selectedChatId !== previousSelectedChatIdRef.current) // Different chat selected
        );

        if (shouldFetch) {
            console.log('ChatList: Fetching chats due to:', {
                firstTime: !hasFetchedRef.current,
                refreshTrigger: refreshTrigger !== previousRefreshTriggerRef.current,
                newSelectedChat: selectedChatId !== previousSelectedChatIdRef.current,
                selectedChatId
            });
            fetchChats();
        }

        // Update refs
        previousSelectedChatIdRef.current = selectedChatId;
        previousRefreshTriggerRef.current = refreshTrigger;
    }, [selectedChatId, refreshTrigger, authenticatedFetch]);

    const fetchChats = async () => {
        try {
            // Only show loading spinner on the very first fetch
            setLoading(!hasFetchedRef.current);
            setError(null);
            
            console.log('ChatList: Fetching chats from server...');
            const response = await authenticatedFetch('/api/chats');
            
            if (response.ok) {
                const data = await response.json();
                const sortedChats = (data.chats || []).sort((a, b) => 
                    new Date(b.updated_at) - new Date(a.updated_at)
                );
                
                setChats(sortedChats);
                fetchedChatsRef.current = sortedChats;
                hasFetchedRef.current = true;
                
                console.log(`ChatList: Fetched ${sortedChats.length} chats. Selected: ${selectedChatId}`);
                
                // Check if the selected chat exists in the fetched chats
                if (selectedChatId) {
                    const selectedChat = sortedChats.find(chat => chat.chat_id === selectedChatId);
                    if (selectedChat) {
                        console.log(`ChatList: Selected chat found: "${selectedChat.title}"`);
                    } else {
                        console.warn(`ChatList: Selected chat ${selectedChatId} not found in fetched chats`);
                    }
                }
                
            } else {
                console.error('ChatList: Failed to fetch chats:', response.status, response.statusText);
                setError('Failed to load chats');
            }
        } catch (err) {
            console.error('ChatList: Error fetching chats:', err);
            setError('Failed to connect to server. Please check your network and try again.');
        } finally {
            setLoading(false);
        }
    };

    // Force refresh chats (useful after creating/deleting)
    const refreshChats = () => {
        console.log('ChatList: Manual refresh requested');
        fetchChats();
    };

    const handleNewChatClick = () => {
        console.log('ChatList: New chat button clicked');
        onNewChat();
    };

    const handleChatItemClick = (chatId) => {
        console.log(`ChatList: Chat item clicked: ${chatId}`);
        onChatSelect(chatId);
    };

    const handleDeleteChat = async (chatId, e) => {
        e.stopPropagation();
        
        if (!window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
            return;
        }

        console.log(`ChatList: Deleting chat: ${chatId}`);

        try {
            const response = await authenticatedFetch(`/api/chats/${chatId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Remove the chat from the local state
                setChats(prevChats => prevChats.filter(chat => chat.chat_id !== chatId));
                fetchedChatsRef.current = fetchedChatsRef.current.filter(chat => chat.chat_id !== chatId);
                
                // If the deleted chat was the currently selected one, navigate to new chat
                if (selectedChatId === chatId) {
                    console.log('ChatList: Deleted chat was selected, navigating to new chat');
                    onNewChat();
                }
                
                console.log(`ChatList: Chat ${chatId} deleted successfully`);
            } else {
                const errorData = await response.json();
                setError(`Failed to delete chat: ${errorData.message || response.statusText}`);
            }
        } catch (err) {
            console.error('ChatList: Error deleting chat:', err);
            setError('Failed to delete chat. Server unreachable.');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInHours < 24 * 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    // Show loading only on the very first fetch
    if (loading && !hasFetchedRef.current) {
        return (
            <div className="chat-list-container">
                <div className="chat-list-header">
                    <div className="user-info">
                        <span className="username">Loading...</span>
                    </div>
                </div>
                <div className="loading-chats">
                    <div className="loading-spinner"></div>
                    <p>Loading chats...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-list-container">
            <div className="chat-list-header">
                <div className="user-info">
                    <div className="user-avatar">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="username">{user?.username || 'User'}</span>
                </div>
                <div className="header-buttons">
                    <button 
                        className="new-chat-button"
                        onClick={handleNewChatClick}
                        title="Start a new conversation"
                    >
                        +
                    </button>
                    <button 
                        className="logout-button"
                        onClick={onLogout}
                        title="Logout"
                    >
                        ⏻
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    <p>{error}</p>
                    <button onClick={refreshChats} className="retry-button">
                        Retry
                    </button>
                </div>
            )}

            <div className="chat-list">
                {chats.length === 0 && !loading ? (
                    <div className="no-chats">
                        <p>No chats yet</p>
                        <button onClick={handleNewChatClick} className="create-first-chat">
                            Start your first chat
                        </button>
                    </div>
                ) : (
                    chats.map(chat => {
                        const isSelected = selectedChatId === chat.chat_id;
                        return (
                            <div
                                key={chat.chat_id}
                                className={`chat-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleChatItemClick(chat.chat_id)}
                            >
                                <div className="chat-info">
                                    <div className="chat-title">{chat.title}</div>
                                    <div className="chat-date">{formatDate(chat.updated_at)}</div>
                                </div>
                                <button
                                    className="delete-chat-button"
                                    onClick={(e) => handleDeleteChat(chat.chat_id, e)}
                                    title="Delete chat"
                                >
                                    ×
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChatList;