import { useCallback, useEffect } from 'react';
import { CONSTANTS } from '../utils/constants.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useSpeechRecognition = ({
  recognitionRef,
  listeningTimeoutRef,
  setInput,
  setIsListeningForSpeech,
  setActiveListener,
  handleSendMessage,
  start,
  stop,
  activeListener,
  isLoading,
  isListeningForSpeech
}) => {

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      console.log("Web Speech API: Attempting to stop...");
      recognitionRef.current.stop();
    }
  }, []);

  const startSpeechRecognition = useCallback(() => {
    if (recognitionRef.current && !isLoading) {
      console.log("Web Speech API: Attempting to start...");
      try {
        recognitionRef.current.start();
        setActiveListener('speech');
      } catch (e) {
        console.error("Web Speech API: Error starting recognition:", e);
        // If it fails to start, hand control back to Porcupine
        start();
        setActiveListener('porcupine');
      }
    }
  }, [isLoading, start, setActiveListener]);
  
  const toggleSpeechRecognition = useCallback(async () => {
    if (isLoading) {
      console.log("Cannot toggle speech recognition while a response is loading.");
      return;
    }

    if (isListeningForSpeech && activeListener === 'speech') {
      // User clicked to stop Web Speech API - restart Porcupine
      console.log("Manual stop: Stopping Web Speech API...");
      stopSpeechRecognition();
      setActiveListener('none');
      // Add small delay to ensure Web Speech API fully stops
      setTimeout(async () => {
        try {
          await start();
          setActiveListener('porcupine');
          console.log("Porcupine: Resumed listening after manual speech stop.");
        } catch (e) {
          console.error("Porcupine: Failed to restart after manual speech stop:", e);
        }
      }, CONSTANTS.SPEECH_END_DELAY);
    } else if (activeListener === 'porcupine' || activeListener === 'none') {
      // User clicked to start Web Speech API manually
      console.log("Manual start: Starting Web Speech API...");
      if (activeListener === 'porcupine') {
        await stop();
        setActiveListener('none');
        // Small delay to ensure Porcupine stops completely
        setTimeout(() => {
          startSpeechRecognition();
        }, 100);
      } else {
        startSpeechRecognition();
      }
    }
  }, [isLoading, isListeningForSpeech, activeListener, stopSpeechRecognition, setActiveListener, start, stop, startSpeechRecognition]);

  // Initialize Web Speech API
  useEffect(() => {
    if (SpeechRecognition && !recognitionRef.current) {
        recognitionRef.current = new SpeechRecognition();
    }

    if (!recognitionRef.current) {
      console.error("Web Speech API is not supported in this browser.");
      return;
    }

    const recognition = recognitionRef.current;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    const handleStart = () => {
      console.log('Web Speech API: Started listening...');
      setIsListeningForSpeech(true);
      setActiveListener('speech');
      setInput('');
    };

    const handleResult = (event) => {
      clearTimeout(listeningTimeoutRef.current);
      
      let finalTranscript = '';
      let interimTranscript = '';
      let isFinal = false;
      
      // Process all results
      Array.from(event.results).forEach(result => {
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += transcript;
          isFinal = true;
        } else {
          interimTranscript += transcript;
        }
      });

      // Show interim results in the input field
      setInput(interimTranscript || finalTranscript);

      if (isFinal) {
        console.log('Web Speech API: Final result received:', finalTranscript);
        
        const messageToSend = finalTranscript.trim();
        
        console.log('Web Speech API: Message to send:', messageToSend);
        
        if (messageToSend && messageToSend.length > 0) {
          // Clear input and send the message
          setInput('');
          handleSendMessage(messageToSend);
        } else {
          console.log('Web Speech API: No valid message after cleaning. Stopping.');
          setInput('');
          stopSpeechRecognition();
          // Restart Porcupine after a brief delay
          setTimeout(async () => {
            if (activeListener === 'speech') {  // Only restart if we were using speech
              setActiveListener('none');
              try {
                await start();
                setActiveListener('porcupine');
                console.log("Porcupine: Resumed listening for wake word after empty speech.");
              } catch (e) {
                console.error("Porcupine: Failed to restart after empty speech:", e);
              }
            }
          }, CONSTANTS.PORCUPINE_RESTART_DELAY);
        }
      } else {
        // Set timeout for interim results
        listeningTimeoutRef.current = setTimeout(() => {
          console.log('Web Speech API: Timeout reached. Stopping.');
          stopSpeechRecognition();
          // Restart Porcupine after timeout
          setTimeout(async () => {
            if (activeListener === 'speech') {  // Only restart if we were using speech
              setActiveListener('none');
              try {
                await start();
                setActiveListener('porcupine');
                console.log("Porcupine: Resumed listening for wake word after timeout.");
              } catch (e) {
                console.error("Porcupine: Failed to restart after timeout:", e);
              }
            }
          }, CONSTANTS.PORCUPINE_RESTART_DELAY);
        }, CONSTANTS.SPEECH_RECOGNITION_TIMEOUT);
      }
    };

    const handleEnd = () => {
      console.log('Web Speech API: Ended.');
      setIsListeningForSpeech(false);
      clearTimeout(listeningTimeoutRef.current);
      
      // Only restart Porcupine if we're not in a loading state and there's no active listener
      setTimeout(async () => {
        if (activeListener === 'speech' && !isLoading) {
          setActiveListener('none');
          try {
            await start();
            setActiveListener('porcupine');
            console.log("Porcupine: Resumed listening because Web Speech ended.");
          } catch (e) {
            console.error("Porcupine: Failed to restart from onEnd:", e);
          }
        }
      }, CONSTANTS.SPEECH_END_DELAY);
    };

    const handleError = (event) => {
      console.error('Web Speech API: Error:', event.error);
      setIsListeningForSpeech(false);
      clearTimeout(listeningTimeoutRef.current);
      
      // Only restart Porcupine if we're currently using speech and not loading
      setTimeout(async () => {
        if (activeListener === 'speech' && !isLoading) {
          setActiveListener('none');
          try {
            await start();
            setActiveListener('porcupine');
            console.log("Porcupine: Resumed listening for wake word after speech error.");
          } catch (e) {
            console.error("Porcupine: Failed to restart after speech error:", e);
          }
        }
      }, CONSTANTS.PORCUPINE_RESTART_DELAY);
    };

    recognition.onstart = handleStart;
    recognition.onresult = handleResult;
    recognition.onend = handleEnd;
    recognition.onerror = handleError;
    
    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
    };
  }, [handleSendMessage, stopSpeechRecognition, start, setInput, setIsListeningForSpeech, setActiveListener, activeListener, isLoading]);

  return { startSpeechRecognition, stopSpeechRecognition, toggleSpeechRecognition };
};