import React from 'react';

const ScrollToBottomButton = ({ onClick }) => {
  return (
    <button className="scroll-to-bottom-button" onClick={onClick}>
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
          d="M19 14l-7 7m0 0l-7-7m7 7V3" 
        />
      </svg>
    </button>
  );
};

export default ScrollToBottomButton;