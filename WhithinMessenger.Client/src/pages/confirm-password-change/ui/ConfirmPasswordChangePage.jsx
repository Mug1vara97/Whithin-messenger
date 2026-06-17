import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import GhostBackground from '../../../shared/ui/atoms/GhostBackground';
import { authApi } from '../../../shared/lib/api/authApi';
import '../../../shared/ui/organisms/RegisterForm/AuthForms.css';

const ConfirmPasswordChangePage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Подтверждаем смену пароля...');

  useEffect(() => {
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');

    if (!userId || !token) {
      setStatus('error');
      setMessage('Ссылка подтверждения неполная или повреждена.');
      return;
    }

    let cancelled = false;

    const confirm = async () => {
      try {
        const response = await authApi.confirmPasswordChange({ userId, token });
        if (cancelled) return;
        setStatus('success');
        setMessage(response?.message || 'Пароль успешно изменён.');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error.message || 'Не удалось подтвердить смену пароля.');
      }
    };

    confirm();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="auth-container" data-nosnippet>
      <GhostBackground />
      <div className="auth-box">
        <div className="auth-header">
          <h2>Смена пароля</h2>
        </div>

        <div className="auth-form">
          {status === 'loading' && <p className="auth-info">{message}</p>}
          {status === 'success' && <div className="auth-success">{message}</div>}
          {status === 'error' && <div className="auth-error">{message}</div>}

          {status !== 'loading' && (
            <p className="auth-link" style={{ marginTop: '16px' }}>
              <Link to="/login">Перейти ко входу</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmPasswordChangePage;
