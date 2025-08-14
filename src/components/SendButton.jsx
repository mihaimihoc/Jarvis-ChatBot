import React from 'react';

const SendButton = ({ onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      className="chat-send-button"
      disabled={disabled}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M14 5l7 7m0 0l-7 7m7-7H3" 
        />
      </svg>
    </button>
  );
};

export default SendButton;