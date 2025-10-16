import React, { useState, useRef, useCallback } from 'react';
import './MessageInput.css';

const MessageInput = ({ 
  onSendMessage, 
  onSendMedia, 
  onStartRecording, 
  onStopRecording,
  isRecording = false,
  recordingTime = 0,
  placeholder = "Написать сообщение..."
}) => {
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (message.trim() && !isRecording) {
      onSendMessage(message.trim());
      setMessage('');
      setIsEditing(false);
      setEditingMessageId(null);
    }
  }, [message, onSendMessage, isRecording]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file && onSendMedia) {
      onSendMedia(file);
    }
    e.target.value = '';
  }, [onSendMedia]);

  const handleMediaClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleRecordingStart = useCallback(() => {
    if (onStartRecording) {
      onStartRecording();
    }
  }, [onStartRecording]);

  const handleRecordingStop = useCallback(() => {
    if (onStopRecording) {
      onStopRecording();
    }
  }, [onStopRecording]);

  const formatRecordingTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="message-input-container">
      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="message-input"
            disabled={isRecording}
            rows={1}
          />
          
          <div className="input-actions">
            {isRecording ? (
              <div className="recording-controls">
                <div className="recording-indicator">
                  <div className="recording-dot"></div>
                  <span className="recording-time">
                    {formatRecordingTime(recordingTime)}
                  </span>
                </div>
                <button
                  type="button"
                  className="stop-recording-button"
                  onClick={handleRecordingStop}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="media-button"
                  onClick={handleMediaClick}
                  title="Прикрепить файл"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                  </svg>
                </button>
                
                <button
                  type="button"
                  className="voice-button"
                  onMouseDown={handleRecordingStart}
                  onMouseUp={handleRecordingStop}
                  onMouseLeave={handleRecordingStop}
                  title="Записать голосовое сообщение"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                </button>
              </>
            )}
            
            <button
              type="submit"
              className="send-button"
              disabled={!message.trim() && !isRecording}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </form>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default MessageInput;
