import React from 'react';
import { LoginForm } from '../../../shared/ui/organisms/LoginForm';
import { GhostBackground } from '../../../shared/ui/atoms/GhostBackground';

const LoginPage = () => {
  return (
    <>
      <GhostBackground />
      <LoginForm />
    </>
  );
};

export default LoginPage;
