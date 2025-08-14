import React from 'react';
import { CONSTANTS } from '../utils/constants.js';
import LoadingSpinner from './LoadingSpinner.jsx';

const MessageRow = ({ message }) => {
  const { role, content, thinking } = message;
  
  return (
    <div className={`message-row ${role === 'user' ? 'message-row-user' : 'message-row-assistant'}`}>
      {role === 'assistant' && (
        <div className="assistant-info-container">
          <img
            src={CONSTANTS.JARVIS_AVATAR_URL}
            alt="Jarvis Avatar"
            className="assistant-avatar"
            onError={(e) => { 
              e.target.onerror = null; 
              e.target.src = "https://placehold.co/36x36/cccccc/ffffff?text=J"; 
            }}
          />
          <span className="assistant-name">Jarvis</span>
          {thinking && <LoadingSpinner />}
        </div>
      )}

      <div
        className={`message-bubble ${
          role === 'user'
            ? 'message-bubble-user'
            : role === 'assistant'
            ? 'message-bubble-assistant'
            : 'message-bubble-error'
        }`}
      >
        <p className="message-content">
          {content}
        </p>
      </div>
    </div>
  );
};

export default MessageRow;