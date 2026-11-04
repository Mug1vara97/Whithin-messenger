import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import GhostBackground from '../../../shared/ui/atoms/GhostBackground';
import { Button } from '../../../shared/ui/atoms';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { authApi } from '../../../shared/lib/api/authApi';
import '../../../shared/ui/organisms/LoginForm/AuthForms.css';

const QrLoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const sessionId = searchParams.get('session') || '';

  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('В ссылке нет идентификатора QR-сессии.');
      return;
    }

    if (authLoading) return;

    if (!isAuthenticated) {
      setStatus('need-login');
      setMessage('Войдите в аккаунт, чтобы подтвердить вход на другом устройстве.');
      return;
    }

    let cancelled = false;

    const approve = async () => {
      setStatus('loading');
      setMessage('Подтверждаем вход…');
      try {
        await authApi.approveQrLogin(sessionId);
        if (cancelled) return;
        setStatus('success');
        setMessage('Вход подтверждён. Можно вернуться к приложению на другом устройстве.');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error.message || 'Не удалось подтвердить QR-вход.');
      }
    };

    approve();

    return () => {
      cancelled = true;
    };
  }, [sessionId, isAuthenticated, authLoading]);

  const loginRedirect = `/login?redirect=${encodeURIComponent(
    `/qr-login?session=${encodeURIComponent(sessionId || '')}`
  )}`;

  return (
    <div className="auth-container" data-nosnippet data-text-scramble>
      <GhostBackground />
      <div className="auth-box">
        <div className="auth-header">
          <h2>QR-вход</h2>
        </div>

        <div className="auth-form">
          {status === 'loading' && <p className="auth-info">{message}</p>}
          {status === 'success' && <div className="auth-success">{message}</div>}
          {status === 'error' && <div className="auth-error">{message}</div>}
          {status === 'need-login' && (
            <>
              <p className="auth-info">{message}</p>
              <Button
                type="button"
                className="auth-submit"
                onClick={() => navigate(loginRedirect)}
              >
                Войти
              </Button>
            </>
          )}

          {status !== 'loading' && status !== 'need-login' && (
            <p className="auth-link" style={{ marginTop: '16px' }}>
              <Link to={isAuthenticated ? '/' : '/login'}>
                {isAuthenticated ? 'В приложение' : 'Ко входу'}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrLoginPage;
