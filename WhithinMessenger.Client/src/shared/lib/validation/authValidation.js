export const validateLogin = (credentials) => {
  const errors = {};

  if (!credentials.username || credentials.username.trim() === '') {
    errors.username = 'Username is required';
  } else if (credentials.username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
  }

  if (!credentials.password || credentials.password.trim() === '') {
    errors.password = 'Password is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateRegister = (userData) => {
  const errors = {};

  if (!userData.username || userData.username.trim() === '') {
    errors.username = 'Username is required';
  } else if (userData.username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
  } else if (userData.username.length > 20) {
    errors.username = 'Username must be less than 20 characters';
  } else if (!/^[a-zA-Z0-9_]+$/.test(userData.username)) {
    errors.username = 'Username can only contain letters, numbers, and underscores';
  }

  if (!userData.password || userData.password.trim() === '') {
    errors.password = 'Password is required';
  } else if (userData.password.length > 128) {
    errors.password = 'Password must be less than 128 characters';
  }

  if (!userData.confirmPassword || userData.confirmPassword.trim() === '') {
    errors.confirmPassword = 'Please confirm your password';
  } else if (userData.password !== userData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
