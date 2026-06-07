import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, FormField } from '../../../shared/ui/atoms';
import GhostBackground from '../../../shared/ui/atoms/GhostBackground';
import { authApi } from '../../../shared/lib/api/authApi';
import '../../../shared/ui/organisms/RegisterForm/AuthForms.css';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!formData.newPassword) {
      nextErrors.newPassword = 'Введите новый пароль';
    } else if (formData.newPassword.length < 6) {
      nextErrors.newPassword = 'Пароль должен содержать минимум 6 символов';
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Подтвердите пароль';
    } else if (formData.newPassword !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Пароли не совпадают';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!userId || !token) {
      setSubmitError('Ссылка сброса неполная или повреждена.');
      return;
    }

    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await authApi.resetPassword({
        userId,
        token,
        newPassword: formData.newPassword,
      });
      setSuccessMessage(response?.message || 'Пароль успешно изменён.');
      setIsSuccess(true);
    } catch (err) {
      setSubmitError(err.message || 'Не удалось сбросить пароль.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!userId || !token) {
    return (
      <div className="auth-container">
        <GhostBackground />
        <div className="auth-box">
          <div className="auth-header">
            <h2>Сброс пароля</h2>
          </div>
          <div className="auth-form">
            <div className="auth-error">Ссылка сброса неполная или повреждена.</div>
            <p className="auth-link">
              <Link to="/forgot-password">Запросить новую ссылку</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="auth-container">
        <GhostBackground />
        <div className="auth-box">
          <div className="auth-header">
            <h2>Сброс пароля</h2>
          </div>
          <div className="auth-form">
            <div className="auth-success">{successMessage}</div>
            <p className="auth-link">
              <Link to="/login">Перейти ко входу</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <GhostBackground />
      <div className="auth-box">
        <div className="auth-header">
          <h2>Новый пароль</h2>
          <p>Задайте новый пароль для вашего аккаунта</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {submitError && <div className="auth-error">{submitError}</div>}

          <FormField
            type="password"
            name="newPassword"
            label="Новый пароль"
            placeholder="Введите новый пароль"
            value={formData.newPassword}
            onChange={handleInputChange}
            error={!!errors.newPassword}
            errorMessage={errors.newPassword}
            required
            disabled={isLoading}
            autoComplete="new-password"
          />

          <FormField
            type="password"
            name="confirmPassword"
            label="Подтверждение пароля"
            placeholder="Повторите новый пароль"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            error={!!errors.confirmPassword}
            errorMessage={errors.confirmPassword}
            required
            disabled={isLoading}
            autoComplete="new-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="large"
            disabled={isLoading}
            className="auth-submit"
          >
            {isLoading ? 'Сохранение...' : 'Сбросить пароль'}
          </Button>
        </form>

        <p className="auth-link">
          <Link to="/login">Вернуться ко входу</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
