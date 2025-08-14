import React from 'react';

const MicrophoneButton = ({ onClick, isListening, disabled }) => {
  return (
    <button
      onClick={onClick}
      className={`chat-microphone-button ${isListening ? 'listening' : ''}`}
      aria-label={isListening ? 'Stop listening' : 'Start voice input'}
      disabled={disabled}
    >
      {isListening ? (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="listening-icon"
        >
          <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zM12 16a4 4 0 10-4-4 4 4 0 004 4z" />
        </svg>
      ) : (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
};

export default MicrophoneButton;