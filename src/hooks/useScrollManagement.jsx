import { useState, useEffect } from 'react';
import { CONSTANTS } from '../utils/constants.js';

export const useScrollManagement = ({ chatDisplayRef, messagesEndRef, messages }) => {
  const [isAutoScrollingActive, setIsAutoScrollingActive] = useState(true);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);

  // Auto-scroll effect
  useEffect(() => {
    if (isAutoScrollingActive) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    }
  }, [messages, isAutoScrollingActive, messagesEndRef]);

  // Scroll event listener
  useEffect(() => {
    const element = chatDisplayRef.current;
    if (element) {
      const handleScroll = () => {
        const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
        setIsAutoScrollingActive(distanceFromBottom <= CONSTANTS.SCROLL_TOLERANCE_FOR_BOTTOM);
        setShowScrollToBottomButton(distanceFromBottom > CONSTANTS.SCROLL_THRESHOLD);
      };

      element.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => {
        element.removeEventListener('scroll', handleScroll);
      };
    }
  }, [chatDisplayRef]);

  return { isAutoScrollingActive, showScrollToBottomButton };
};