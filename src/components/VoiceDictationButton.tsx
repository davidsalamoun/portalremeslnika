import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  className?: string;
  buttonText?: string;
  compact?: boolean;
}

// Typová deklarace pro Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  onError,
  className = '',
  buttonText = 'Diktovat hlasem',
  compact = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'cs-CZ';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }

        if (finalTranscript.trim()) {
          onTranscript(finalTranscript.trim());
          triggerHaptic('success');
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        triggerHaptic('error');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition initialization error:', e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [onTranscript]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) {
      triggerHaptic('error');
      onError?.('Váš webový prohlížeč nepodporuje hlasové diktování. Doporučujeme Google Chrome nebo Safari.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
        triggerHaptic('selection');
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        triggerHaptic('impact');
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setIsListening(false);
      }
    }
  };

  if (!isSupported) {
    return null;
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleListening}
        title={isListening ? 'Klepněte pro ukončení diktování' : 'Diktovat hlasem (česky)'}
        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          isListening
            ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/30 animate-pulse'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
        } ${className}`}
      >
        {isListening ? (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <MicOff className="w-4 h-4" />
          </div>
        ) : (
          <Mic className="w-4 h-4 text-rose-500" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
        isListening
          ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/30 ring-2 ring-rose-400 animate-pulse'
          : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
      } ${className}`}
    >
      {isListening ? (
        <>
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
          <MicOff className="w-4 h-4" />
          <span>Poslouchám... (Klepněte pro ukončení)</span>
        </>
      ) : (
        <>
          <Mic className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
};
