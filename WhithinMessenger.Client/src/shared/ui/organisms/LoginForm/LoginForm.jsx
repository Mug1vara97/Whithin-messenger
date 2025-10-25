import React, { useState } from 'react';
import { Button, FormField } from '../../atoms';
import GhostBackground from '../../atoms/GhostBackground';
import { validateLogin } from '../../../lib/validation';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import './AuthForms.css';

const LoginForm = () => {
  const { login, isLoading, error } = useAuthContext();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState({});

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
        </form>

        <p className="auth-link">
          Need an account? <a href="/register">Register</a>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
