import React, { useState } from 'react';
import { Button, FormField } from '../../atoms';
import { validateRegister } from '../../../lib/validation';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import './AuthForms.css';

const RegisterForm = () => {
  const { register, isLoading, error } = useAuthContext();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
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
    
    const validation = validateRegister(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    await register(formData);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h2>Create an account</h2>
          <p>Join our community today!</p>
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
            label="Username"
            placeholder="Enter your username"
            value={formData.username}
            onChange={handleInputChange}
            error={!!errors.username}
            errorMessage={errors.username}
            required
            disabled={isLoading}
            autoComplete="username"
          />

          <FormField
            type="email"
            name="email"
            label="Email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleInputChange}
            error={!!errors.email}
            errorMessage={errors.email}
            required
            disabled={isLoading}
            autoComplete="email"
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
            autoComplete="new-password"
          />

          <FormField
            type="password"
            name="confirmPassword"
            label="Confirm Password"
            placeholder="Confirm your password"
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
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="auth-link">
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;
