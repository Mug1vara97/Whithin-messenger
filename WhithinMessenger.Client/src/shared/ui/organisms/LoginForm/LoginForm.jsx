import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, FormField } from '../../atoms';
import GhostBackground from '../../atoms/GhostBackground';
import { validateLogin } from '../../../lib/validation';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { authApi } from '../../../lib/api/authApi';
import QRCode from 'qrcode';
import './AuthForms.css';

const LoginForm = () => {
  const { login, consumeQrLoginSession, isLoading, error } = useAuthContext();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');
  const [qrHint, setQrHint] = useState('Откройте камеру на Android и сканируйте код');
  const qrFlowDismissedRef = useRef(false);

  const closeQrOverlay = useCallback(() => {
    qrFlowDismissedRef.current = true;
    setIsQrLoading(false);
    setQrSession(null);
    setQrImage('');
    setQrError('');
    setQrHint('Откройте камеру на Android и сканируйте код');
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validation = validateLogin(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    await login(formData);
  };

  const createQrSession = async () => {
    qrFlowDismissedRef.current = false;
    try {
      setIsQrLoading(true);
      setQrError('');
      setQrHint('Создаем QR-сессию...');

      const response = await authApi.createQrLoginSession();
      if (qrFlowDismissedRef.current) {
        return;
      }
      if (!response?.sessionId || !response?.qrPayload) {
        throw new Error('Server returned invalid QR session payload');
      }

      setQrSession(response);
      setQrHint('Сканируйте QR-код в приложении Whithin на Android');
    } catch (sessionError) {
      if (!qrFlowDismissedRef.current) {
        setQrError(sessionError.message || 'Не удалось создать QR-код');
        setQrSession(null);
        setQrHint('');
      }
    } finally {
      if (!qrFlowDismissedRef.current) {
        setIsQrLoading(false);
      }
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const generateQr = async () => {
      if (!qrSession?.qrPayload) {
        setQrImage('');
        return;
      }

      try {
        const imageData = await QRCode.toDataURL(qrSession.qrPayload, {
          width: 220,
          margin: 1
        });

        if (!isCancelled) {
          setQrImage(imageData);
        }
      } catch (renderError) {
        if (!isCancelled) {
          setQrError(renderError.message || 'Не удалось отрисовать QR-код');
        }
      }
    };

    generateQr();

    return () => {
      isCancelled = true;
    };
  }, [qrSession]);

  useEffect(() => {
    if (!qrSession?.sessionId || !qrSession?.expiresAt) {
      return undefined;
    }

    let isCancelled = false;
    let isRequestInFlight = false;
    const expiresAtMs = Date.parse(qrSession.expiresAt);

    const poll = async () => {
      if (isRequestInFlight || isCancelled) {
        return;
      }

      if (Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
        setQrHint('QR-код истек, обновите его');
        setQrSession(null);
        return;
      }

      isRequestInFlight = true;

      try {
        const result = await consumeQrLoginSession(qrSession.sessionId);
        if (isCancelled) {
          return;
        }

        if (result.success) {
          setQrHint('Вход подтвержден, выполняем авторизацию...');
          return;
        }

        if (result.status === 'expired') {
          setQrHint('QR-код истек, создайте новый');
          setQrSession(null);
        }
      } finally {
        isRequestInFlight = false;
      }
    };

    const intervalId = window.setInterval(poll, 2000);
    poll();

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [consumeQrLoginSession, qrSession]);

  const qrOverlayOpen = isQrLoading || Boolean(qrSession);

  useEffect(() => {
    if (!qrOverlayOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [qrOverlayOpen]);

  useEffect(() => {
    if (!qrOverlayOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeQrOverlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [qrOverlayOpen, closeQrOverlay]);

  return (
    <div className="auth-container">
      <GhostBackground />
      <div className="auth-box">
        <div className="auth-header">
          <h2>Whithin</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <FormField
            type="text"
            name="username"
            label="Username or Email"
            placeholder="Enter your username or email"
            value={formData.username}
            onChange={handleInputChange}
            error={!!errors.username}
            errorMessage={errors.username}
            required
            disabled={isLoading}
            autoComplete="username"
          />

          <FormField
            type="password"
            name="password"
            label="Password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleInputChange}
            error={!!errors.password}
            errorMessage={errors.password}
            required
            disabled={isLoading}
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="large"
            disabled={isLoading}
            className="auth-submit"
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </Button>

          <div className="auth-qr-section">
            <Button
              type="button"
              variant="secondary"
              size="large"
              disabled={isLoading || isQrLoading}
              className="auth-submit"
              onClick={createQrSession}
            >
              {isQrLoading ? 'Generating QR...' : 'Log In with Android QR'}
            </Button>
            {qrError && !(isQrLoading || qrSession) && <div className="auth-error">{qrError}</div>}
          </div>
        </form>

        <p className="auth-link">
          Need an account? <a href="/register">Register</a>
        </p>
      </div>

      {qrOverlayOpen &&
        createPortal(
          <div
            className="auth-qr-overlay"
            role="presentation"
            onClick={(e) => e.target === e.currentTarget && closeQrOverlay()}
          >
            <div
              className="auth-qr-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-qr-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="auth-qr-close"
                onClick={closeQrOverlay}
                aria-label="Закрыть"
              >
                ×
              </button>
              <h3 id="auth-qr-title" className="auth-qr-title">
                Вход через Android
              </h3>
              {qrError && <div className="auth-error auth-qr-error">{qrError}</div>}
              {isQrLoading && !qrSession && <p className="auth-qr-hint">{qrHint}</p>}
              {qrImage && (
                <div className="auth-qr-box">
                  <img src={qrImage} alt="QR-код для входа в веб-клиент" className="auth-qr-image" />
                  <p className="auth-qr-hint">{qrHint}</p>
                </div>
              )}
              {qrSession && !qrImage && !qrError && <p className="auth-qr-hint">{qrHint}</p>}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default LoginForm;
