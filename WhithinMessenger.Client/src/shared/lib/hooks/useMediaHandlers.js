import { useState, useRef, useCallback, useEffect } from 'react';
import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';

const VIDEO_NOTE_MAX_SEC = 60;

export const useMediaHandlers = (connection, chatId, userId, username) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const [isRecordingVideoNote, setIsRecordingVideoNote] = useState(false);
  const [videoNoteRecordingTime, setVideoNoteRecordingTime] = useState(0);
  const videoNoteRecorderRef = useRef(null);
  const videoNoteStreamRef = useRef(null);
  const videoNoteSkipUploadRef = useRef(false);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    let interval;
    if (isRecordingVideoNote) {
      interval = setInterval(() => {
        setVideoNoteRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecordingVideoNote]);

  useEffect(() => {
    if (!isRecordingVideoNote || videoNoteRecordingTime < VIDEO_NOTE_MAX_SEC) return;
    const rec = videoNoteRecorderRef.current;
    if (rec && rec.state === 'recording') {
      rec.stop();
    }
  }, [videoNoteRecordingTime, isRecordingVideoNote]);

  const handleSendMedia = useCallback(async (file, options = {}) => {
    if (!file || !connection) return;

    const { isVideoNote = false } = options;

    try {
      setUploadingFile({
        name: file.name,
        type: file.type,
        size: file.size
      });
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);
      formData.append('caption', '');
      formData.append('userId', userId);
      formData.append('username', username);
      formData.append('isVideoNote', isVideoNote ? 'true' : 'false');

      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });
      });

      xhr.open('POST', `${BASE_URL}/api/media/upload`);
      xhr.withCredentials = true;
      const token = tokenManager.getToken();
      if (token && tokenManager.isTokenValid()) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);

      await uploadPromise;

      await new Promise((resolve) => setTimeout(resolve, 300));

      setUploadingFile(null);
      setUploadProgress(0);

      return true;
    } catch (error) {
      console.error('❌ Ошибка загрузки файла:', error);
      setUploadingFile(null);
      setUploadProgress(0);
      alert(`Ошибка загрузки файла: ${error.message}`);
    }
    return false;
  }, [connection, chatId, userId, username]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `audio-message-${Date.now()}.webm`, {
          type: 'audio/webm'
        });

        await handleSendMedia(audioFile);

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Не удалось получить доступ к микрофону');
    }
  }, [handleSendMedia]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setRecordingTime(0);
    }
  }, [mediaRecorder, isRecording]);

  const handleAudioRecording = useCallback(() => {
    if (isRecordingVideoNote) {
      alert('Сначала закончите или отмените запись видеокружка');
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, isRecordingVideoNote, startRecording, stopRecording]);

  const formatRecordingTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setRecordingTime(0);
    }
  }, [mediaRecorder, isRecording]);

  const handleVideoNoteRecording = useCallback(async () => {
    if (!connection) return;
    if (isRecording) {
      alert('Сначала закончите запись голосового сообщения');
      return;
    }
    if (isRecordingVideoNote && videoNoteRecorderRef.current) {
      if (videoNoteRecorderRef.current.state === 'recording') {
        videoNoteRecorderRef.current.stop();
      }
      return;
    }

    videoNoteSkipUploadRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });
      videoNoteStreamRef.current = stream;
      const chunks = [];
      let mime = '';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mime = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mime = 'video/webm';
      }
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      videoNoteRecorderRef.current = rec;

      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        videoNoteStreamRef.current = null;
        videoNoteRecorderRef.current = null;
        setIsRecordingVideoNote(false);
        setVideoNoteRecordingTime(0);
        if (videoNoteSkipUploadRef.current) {
          videoNoteSkipUploadRef.current = false;
          return;
        }
        const blobType = rec.mimeType || 'video/webm';
        const blob = new Blob(chunks, { type: blobType });
        if (blob.size === 0) return;
        const ext = blobType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `video-note-${Date.now()}.${ext}`, { type: blobType });
        await handleSendMedia(file, { isVideoNote: true });
      };

      rec.start(1000);
      setIsRecordingVideoNote(true);
      setVideoNoteRecordingTime(0);
    } catch (error) {
      console.error('Error starting video note:', error);
      alert('Не удалось получить доступ к камере');
    }
  }, [connection, isRecording, isRecordingVideoNote, handleSendMedia]);

  const cancelVideoNoteRecording = useCallback(() => {
    if (!videoNoteRecorderRef.current || !isRecordingVideoNote) return;
    videoNoteSkipUploadRef.current = true;
    if (videoNoteRecorderRef.current.state === 'recording') {
      videoNoteRecorderRef.current.stop();
    } else {
      videoNoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      videoNoteStreamRef.current = null;
      videoNoteRecorderRef.current = null;
      setIsRecordingVideoNote(false);
      setVideoNoteRecordingTime(0);
    }
  }, [isRecordingVideoNote]);

  return {
    isRecording,
    recordingTime,
    fileInputRef,
    handleSendMedia,
    handleAudioRecording,
    formatRecordingTime,
    cancelRecording,
    uploadingFile,
    uploadProgress,
    isRecordingVideoNote,
    videoNoteRecordingTime,
    handleVideoNoteRecording,
    cancelVideoNoteRecording
  };
};
