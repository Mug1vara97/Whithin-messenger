class TokenManager {
  constructor() {
    this.ACCESS_TOKEN_KEY = 'accessToken';
    this.TOKEN_EXPIRY_KEY = 'accessTokenExpiry';
  }

  setToken(token, expiresIn = null) {
    console.log('TokenManager: Setting token:', token ? 'Token received' : 'No token');
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
    
    if (expiresIn) {
      const expiryTime = Date.now() + (expiresIn * 1000);
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
      console.log('TokenManager: Token expires at:', new Date(expiryTime));
    } else {
      // Если не передано время истечения, устанавливаем 24 часа по умолчанию
      const defaultExpiry = Date.now() + (24 * 60 * 60 * 1000);
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, defaultExpiry.toString());
      console.log('TokenManager: Token expires at (default 24h):', new Date(defaultExpiry));
    }
  }

  getToken() {
    const token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    console.log('TokenManager: Getting token:', token ? 'Token exists' : 'No token');
    return token;
  }

  isTokenValid() {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    return !this.isTokenExpired();
  }

  isTokenExpired() {
    const expiryTime = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryTime) {
      return true;
    }
    const currentTime = Date.now();
    const expired = currentTime > parseInt(expiryTime, 10);
    if (expired) {
      console.log('TokenManager: Token expired.');
    }
    return expired;
  }

  isTokenExpiringSoon() {
    const expiryTime = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryTime) {
      return true;
    }
    const currentTime = Date.now();
    const fiveMinutesFromNow = currentTime + (5 * 60 * 1000);
    return parseInt(expiryTime, 10) < fiveMinutesFromNow;
  }

  // Простое декодирование JWT без проверки подписи (только для получения данных)
  decodeToken() {
    const token = this.getToken();
    if (!token) {
      return null;
    }
    try {
      // JWT состоит из трех частей, разделенных точками
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      // Декодируем payload (вторая часть)
      const payload = parts[1];
      // Добавляем padding если нужно
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decodedPayload = atob(paddedPayload);
      return JSON.parse(decodedPayload);
    } catch (error) {
      console.error('TokenManager: Error decoding token:', error);
      return null;
    }
  }

  getUserFromToken() {
    const decoded = this.decodeToken();
    if (decoded) {
      return {
        id: decoded.UserId,
        username: decoded.Username,
        email: decoded.email,
      };
    }
    return null;
  }

  clearTokens() {
    console.log('TokenManager: Clearing tokens.');
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }
}

const tokenManager = new TokenManager();
export default tokenManager;
