import React from 'react';

const WelcomeMessage = ({ error, activeListener, isLoaded, isLoading }) => {
  return (
    <div className="chat-welcome-message">
      <p>👋 Hello! Type a message to start chatting with Ollama (Llama 3.1)!</p>
      <p className="chat-welcome-message-hint">Or say "Hey Jarvis..." to send a message hands-free!</p>
      {error && <p className="error-message">Porcupine Error: {error.message}</p>}
      {activeListener === 'none' && !isLoaded && <p>Loading Porcupine engine...</p>}
      {activeListener === 'none' && isLoaded && !isLoading && (
        <p className="warning-message">
          Waiting for Porcupine to start. Check browser microphone permissions.
        </p>
      )}
    </div>
  );
};

export default WelcomeMessage;