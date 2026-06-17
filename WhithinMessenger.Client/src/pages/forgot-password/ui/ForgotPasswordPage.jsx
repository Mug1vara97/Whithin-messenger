import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, FormField } from '../../../shared/ui/atoms';
import GhostBackground from '../../../shared/ui/atoms/GhostBackground';
import { authApi } from '../../../shared/lib/api/authApi';
import '../../../shared/ui/organisms/RegisterForm/AuthForms.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Введите email');
      return;
    }

    try {
      setIsLoading(true);
      const response = await authApi.forgotPassword(email.trim());
      setMessage(
        response?.message ||
          'Если аккаунт с этим email существует, письмо для сброса пароля отправлено'
      );
      setIsSubmitted(true);
    } catch (err) {
      setError(err.message || 'Не удалось отправить письмо.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="auth-container" data-nosnippet>
        <GhostBackground />
        <div className="auth-box">
          <div className="auth-header">
            <h2>Проверьте почту</h2>
            <p>Мы отправили письмо на {email}</p>
          </div>
          <div className="auth-form">
            <div className="auth-success">{message}</div>
            <p className="auth-link">
              <Link to="/login">Перейти ко входу</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" data-nosnippet>
      <GhostBackground />
      <div className="auth-box">
        <div className="auth-header">
          <h2>Забыли пароль?</h2>
          <p>Введите email — мы отправим ссылку для сброса пароля</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <FormField
            type="email"
            name="email"
            label="Email"
            placeholder="Введите ваш email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
          />

          <Button
            type="submit"
            variant="primary"
            size="large"
            disabled={isLoading}
            className="auth-submit"
          >
            {isLoading ? 'Отправка...' : 'Отправить ссылку'}
          </Button>
        </form>

        <p className="auth-link">
          <Link to="/login">Вернуться ко входу</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
