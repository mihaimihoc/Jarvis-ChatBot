import React, { forwardRef } from 'react';
import MessageRow from './MessageRow.jsx';
import WelcomeMessage from './WelcomeMessage.jsx';

const ChatMessages = forwardRef(({ 
  messages, 
  messagesEndRef, 
  error, 
  activeListener, 
  isLoaded, 
  isLoading 
}, ref) => {
  return (
    <div ref={ref} className="chat-messages-display custom-scrollbar">
      {messages.length === 0 && (
        <WelcomeMessage
          error={error}
          activeListener={activeListener}
          isLoaded={isLoaded}
          isLoading={isLoading}
        />
      )}

      {messages.map((msg, index) => (
        <MessageRow key={index} message={msg} />
      ))}
      
      <div ref={messagesEndRef} className="chat-scroll-anchor" />
    </div>
  );
});

ChatMessages.displayName = 'ChatMessages';

export default ChatMessages;