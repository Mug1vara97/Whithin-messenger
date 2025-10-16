import React from 'react';
import './FormField.css';

const FormField = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  placeholder, 
  error, 
  errorMessage, 
  required = false, 
  disabled = false,
  autoComplete,
  className = '',
  ...props 
}) => {
  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label className="form-field__label">
          {label}
          {required && <span className="form-field__required">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`form-field__input ${error ? 'form-field__input--error' : ''}`}
        {...props}
      />
      {error && errorMessage && (
        <span className="form-field__error">{errorMessage}</span>
      )}
    </div>
  );
};

export default FormField;
























