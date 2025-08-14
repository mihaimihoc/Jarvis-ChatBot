import React from 'react';
import MicrophoneButton from './MicrophoneButton.jsx';
import SendButton from './SendButton.jsx';

const ChatInput = ({
  input,
  onChange,
  onKeyPress,
  onSend,
  onToggleSpeech,
  isLoading,
  isListeningForSpeech,
  recognitionRef
}) => {
  return (
    <div className="chat-input-area">
      {recognitionRef.current && (
        <MicrophoneButton
          onClick={onToggleSpeech}
          isListening={isListeningForSpeech}
          disabled={isLoading}
        />
      )}

      <textarea
        className="chat-input-field"
        placeholder="Type your message here..."
        value={input}
        onChange={onChange}
        onKeyPress={onKeyPress}
        disabled={isLoading || isListeningForSpeech}
        rows={1}
      />
      
      <SendButton
        onClick={onSend}
        disabled={isLoading || input.trim() === ''}
      />
    </div>
  );
};

export default ChatInput;