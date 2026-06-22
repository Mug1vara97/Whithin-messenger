import { useState, useRef, useCallback, useEffect } from 'react';
import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';
import {
  analyzeAudioBuffer,
  cacheAudioDuration,
  probeAudioDurationFromBlobUrl,
  probeVideoDurationFromFile,
} from '../utils/probeAudioDuration';

const VIDEO_NOTE_MAX_SEC = 60;
const MAX_BATCH_MEDIA_COUNT = 10;

const parseUploadError = (xhr) => {
  try {
    const payload = JSON.parse(xhr.responseText);
    if (payload?.error) return payload.error;

    const validationErrors = payload?.errors ? Object.values(payload.errors).flat() : [];
    if (validationErrors.length > 0) return String(validationErrors[0]);

    if (payload?.title && payload.title !== 'One or more validation errors occurred.') {
      return payload.title;
    }
  } catch {
    if (xhr.responseText) return xhr.responseText;
  }
  return `HTTP ${xhr.status}`;
};

const filterSendableFiles = (files) =>
  Array.from(files)
    .filter((file) => !file.type.startsWith('audio/'))
    .slice(0, MAX_BATCH_MEDIA_COUNT);

export const useMediaHandlers = (connection, chatId, userId, username) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [pendingMediaSend, setPendingMediaSend] = useState(null);
  const fileInputRef = useRef(null);
  const uploadProgressSetterRef = useRef(setUploadProgress);
  const recordingTimeRef = useRef(0);
  const recordingStartedAtRef = useRef(null);

  uploadProgressSetterRef.current = setUploadProgress;

  const [isRecordingVideoNote, setIsRecordingVideoNote] = useState(false);
  const [videoNoteRecordingTime, setVideoNoteRecordingTime] = useState(0);
  const videoNoteRecorderRef = useRef(null);
  const videoNoteStreamRef = useRef(null);
  const videoNoteSkipUploadRef = useRef(false);

  useEffect(() => {
    if (!isRecording || !recordingStartedAtRef.current) return undefined;

    const tick = () => {
      const elapsedSeconds = Math.floor(
        (performance.now() - recordingStartedAtRef.current) / 1000
      );
      recordingTimeRef.current = elapsedSeconds;
      setRecordingTime(elapsedSeconds);
    };

    tick();
    const interval = setInterval(tick, 250);
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

  const attachMediaDuration = useCallback(async (file) => {
    if (!file || file.durationSeconds > 0) return file;

    const type = file.type || '';
    if (type.startsWith('video/')) {
      const duration = await probeVideoDurationFromFile(file);
      if (duration > 0) {
        file.durationSeconds = duration;
      }
    }

    return file;
  }, []);

  const uploadFiles = useCallback(
    async (files, caption = '', options = {}) => {
      if (!files?.length || !connection) return false;

      if (!chatId) {
        alert('Ошибка загрузки файла: чат не выбран');
        return false;
      }

      const { isVideoNote = false } = options;
      const fileList = await Promise.all(Array.from(files).map(attachMediaDuration));

      try {
        setUploadingFile({
          name:
            fileList.length === 1
              ? fileList[0].name
              : `${fileList.length} файлов`,
          type: fileList[0].type,
          size: fileList.reduce((sum, file) => sum + file.size, 0),
        });
        setUploadProgress(0);
        setIsUploadProcessing(false);

        const formData = new FormData();
        formData.append('chatId', String(chatId));
        const senderUsername =
          username?.trim() || tokenManager.getUserFromToken()?.username?.trim() || '';
        if (senderUsername) {
          formData.append('username', senderUsername);
        }
        if (caption) {
          formData.append('caption', caption);
        }

        let uploadUrl = `${BASE_URL}/api/media/upload`;

        if (fileList.length > 1) {
          uploadUrl = `${BASE_URL}/api/media/upload-batch`;
          fileList.forEach((file) => formData.append('files', file));
        } else {
          formData.append('file', fileList[0]);
          formData.append('isVideoNote', isVideoNote ? 'true' : 'false');
          if (fileList[0].durationSeconds > 0) {
            formData.append(
              'durationSeconds',
              String(Math.round(fileList[0].durationSeconds * 1000) / 1000)
            );
          }
        }

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const UPLOAD_PROGRESS_CAP = 96;

          xhr.upload.addEventListener('progress', (event) => {
            if (!event.lengthComputable || event.total <= 0) return;
            const pct = Math.min(
              UPLOAD_PROGRESS_CAP,
              Math.round((event.loaded / event.total) * UPLOAD_PROGRESS_CAP)
            );
            uploadProgressSetterRef.current(pct);
            if (event.loaded >= event.total) {
              setIsUploadProcessing(true);
              uploadProgressSetterRef.current(97);
            }
          });
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              uploadProgressSetterRef.current(100);
              const response = JSON.parse(xhr.responseText);
              if (
                fileList.length === 1 &&
                fileList[0].durationSeconds > 0 &&
                response.filePath
              ) {
                cacheAudioDuration(response.filePath, fileList[0].durationSeconds);
              }
              resolve(response);
              return;
            }
            try {
              reject(new Error(parseUploadError(xhr)));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Network error occurred')));
          xhr.open('POST', uploadUrl);
          xhr.withCredentials = true;
          const token = tokenManager.getToken();
          if (token && tokenManager.isTokenValid()) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
          xhr.send(formData);
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
        setUploadingFile(null);
        setUploadProgress(0);
        setIsUploadProcessing(false);
        return true;
      } catch (error) {
        console.error('❌ Ошибка загрузки файла:', error);
        setUploadingFile(null);
        setUploadProgress(0);
        setIsUploadProcessing(false);
        alert(`Ошибка загрузки файла: ${error.message}`);
        return false;
      }
    },
    [connection, chatId, userId, username, attachMediaDuration]
  );

  const handleSendMedia = useCallback(
    async (file, options = {}) => uploadFiles([file], options.caption || '', options),
    [uploadFiles]
  );

  const queueMediaSend = useCallback((input) => {
    const rawFiles =
      input instanceof FileList
        ? Array.from(input)
        : Array.isArray(input)
          ? input
          : input instanceof File
            ? [input]
            : [];

    const files = filterSendableFiles(rawFiles);
    if (!files.length) {
      alert('Голосовые сообщения нельзя отправить вместе с файлами');
      return;
    }
    setPendingMediaSend({ files });
  }, []);

  const cancelMediaSend = useCallback(() => {
    if (uploadingFile) return;
    setPendingMediaSend(null);
  }, [uploadingFile]);

  const confirmMediaSend = useCallback(
    async (caption) => {
      const files = pendingMediaSend?.files;
      if (!files?.length) return;
      const success = await uploadFiles(files, caption);
      if (success) {
        setPendingMediaSend(null);
      }
    },
    [pendingMediaSend, uploadFiles]
  );

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
          type: 'audio/webm',
        });

        let durationSeconds = 0;
        const blobUrl = URL.createObjectURL(audioBlob);
        try {
          const { duration } = await analyzeAudioBuffer(await audioBlob.arrayBuffer(), 'recording');
          if (duration > 0) {
            durationSeconds = duration;
          } else {
            durationSeconds = await probeAudioDurationFromBlobUrl(blobUrl);
          }
        } catch (probeError) {
          console.warn('Voice duration probe failed:', probeError);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }

        if (!durationSeconds && recordingStartedAtRef.current) {
          durationSeconds = Math.max(
            0.1,
            (performance.now() - recordingStartedAtRef.current) / 1000
          );
        }

        audioFile.durationSeconds = durationSeconds;

        await handleSendMedia(audioFile);

        stream.getTracks().forEach((track) => track.stop());
      };

      recordingStartedAtRef.current = performance.now();
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
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
        audio: true,
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
    queueMediaSend,
    cancelMediaSend,
    confirmMediaSend,
    pendingMediaSend,
    handleAudioRecording,
    formatRecordingTime,
    cancelRecording,
    uploadingFile,
    uploadProgress,
    isUploadProcessing,
    isRecordingVideoNote,
    videoNoteRecordingTime,
    handleVideoNoteRecording,
    cancelVideoNoteRecording,
  };
};
