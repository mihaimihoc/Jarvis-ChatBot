import { useEffect, useRef } from 'react';
import { CONSTANTS } from '../utils/constants.js';

export const usePorcupineEngine = ({
  isLoaded,
  activeListener,
  setActiveListener,
  isLoading,
  init,
  start,
  stop,
  release,
  keywordDetection,
  startSpeechRecognition
}) => {
  const keywordDetectionRef = useRef(null);

  // PORCUPINE ENGINE INITIALIZATION AND LIFECYCLE MANAGEMENT
  useEffect(() => {
    let isInitializing = false;
    
    const initializePorcupine = async () => {
      if (isInitializing) return;
      isInitializing = true;
      
      console.log("Porcupine: Initializing...");
      try {
        await init(
          CONSTANTS.PORCUPINE_ACCESS_KEY, 
          CONSTANTS.PORCUPINE_KEYWORD, 
          CONSTANTS.PORCUPINE_MODEL
        );
        console.log("Porcupine: Initialization successful.");
        if (!isLoading) {
          await start();
          setActiveListener('porcupine');
          console.log("Porcupine: Listening for wake word...");
        }
      } catch (e) {
        console.error("Porcupine: Failed to initialize.", e);
      } finally {
        isInitializing = false;
      }
    };
    
    if (!isLoaded && activeListener === 'none') {
      initializePorcupine();
    }
    
    // Only release on unmount, not on every re-render
    return () => {
      if (isLoaded) {
        console.log("Porcupine: Releasing resources on unmount...");
        release();
      }
    };
  }, [isLoaded]); // Removed problematic dependencies

  // Add a separate useEffect to handle initial Porcupine startup
  useEffect(() => {
    const startPorcupineIfReady = async () => {
      if (isLoaded && activeListener === 'none' && !isLoading) {
        try {
          await start();
          setActiveListener('porcupine');
          console.log("Porcupine: Started listening for wake word.");
        } catch (e) {
          console.error("Porcupine: Failed to start listening:", e);
        }
      }
    };

    startPorcupineIfReady();
  }, [isLoaded, isLoading]);

  // Handle keyword detection with debouncing
  useEffect(() => {
    if (keywordDetection !== null && 
        keywordDetection !== keywordDetectionRef.current && 
        activeListener === 'porcupine' && 
        !isLoading) {
      
      console.log(`Porcupine: Wake word detected: ${keywordDetection.label}.`);
      console.log("Porcupine: Stopping and handing off to Web Speech API.");
      
      // Update the ref to prevent duplicate triggers
      keywordDetectionRef.current = keywordDetection;
      
      const handoff = async () => {
        try {
          await stop();
          setActiveListener('none');
          // Add a small delay before starting speech recognition to ensure Porcupine is fully stopped
          setTimeout(() => {
            startSpeechRecognition();
          }, CONSTANTS.SPEECH_HANDOFF_DELAY);
        } catch (e) {
          console.error("Porcupine: Error during handoff to speech:", e);
          // Fallback: restart Porcupine if handoff fails
          setTimeout(async () => {
            try {
              await start();
              setActiveListener('porcupine');
            } catch (restartError) {
              console.error("Porcupine: Failed to restart after handoff error:", restartError);
            }
          }, CONSTANTS.PORCUPINE_RESTART_DELAY);
        }
      };
      handoff();
    }
  }, [keywordDetection, isLoading, stop, startSpeechRecognition, activeListener, setActiveListener]);
};