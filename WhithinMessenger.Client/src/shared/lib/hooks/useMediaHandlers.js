import { useState, useRef, useCallback, useEffect } from 'react';
import { BASE_URL } from '../constants/apiEndpoints';

export const useMediaHandlers = (connection, chatId, userId, username) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleSendMedia = useCallback(async (file) => {
    if (!file || !connection) return;

    try {
      // Устанавливаем состояние загрузки
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

      /**
       * Используем XMLHttpRequest вместо Fetch API
       * 
       * Почему XMLHttpRequest, а не Fetch?
       * - Fetch API НЕ поддерживает отслеживание прогресса ОТПРАВКИ (upload progress)
       * - xhr.upload.onprogress - единственный нативный способ отслеживать загрузку файлов
       * - Fetch может отслеживать только прогресс СКАЧИВАНИЯ ответа через ReadableStream
       * - Для upload progress XMLHttpRequest - это правильный и единственный выбор
       * 
       * Альтернативы: библиотеки типа axios, которые внутри тоже используют XMLHttpRequest
       */
      const xhr = new XMLHttpRequest();

      // Promise для обработки результата
      const uploadPromise = new Promise((resolve, reject) => {
        // Отслеживаем прогресс отправки файла
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
          }
        });

        // Обработка успешного ответа
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

        // Обработка сетевых ошибок
        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'));
        });

        // Обработка отмены
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });
      });

      // Отправляем запрос
      xhr.open('POST', `${BASE_URL}/api/media/upload`);
      xhr.withCredentials = true;
      xhr.send(formData);

      // Ждем результата
      await uploadPromise;
      
      console.log('✅ Файл успешно загружен');
      
      // Небольшая задержка для плавности UI
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Сбрасываем состояние загрузки
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
        
        stream.getTracks().forEach(track => track.stop());
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
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

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

  return {
    isRecording,
    recordingTime,
    fileInputRef,
    handleSendMedia,
    handleAudioRecording,
    formatRecordingTime,
    cancelRecording,
    uploadingFile,
    uploadProgress
  };
};
