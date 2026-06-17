import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import GhostBackground from '../../../shared/ui/atoms/GhostBackground';
import { authApi } from '../../../shared/lib/api/authApi';
import '../../../shared/ui/organisms/RegisterForm/AuthForms.css';

const ConfirmEmailChangePage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Подтверждаем смену email...');

  useEffect(() => {
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const token = searchParams.get('token');

    if (!userId || !email || !token) {
      setStatus('error');
      setMessage('Ссылка подтверждения неполная или повреждена.');
      return;
    }

    let cancelled = false;

    const confirm = async () => {
      try {
        const response = await authApi.confirmEmailChange({ userId, newEmail: email, token });
        if (cancelled) return;
        setStatus('success');
        setMessage(response?.message || 'Email успешно изменён.');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error.message || 'Не удалось подтвердить смену email.');
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
          <h2>Смена email</h2>
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

export default ConfirmEmailChangePage;
