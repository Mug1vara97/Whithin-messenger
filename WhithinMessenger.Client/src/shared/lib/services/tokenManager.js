class TokenManager {
  constructor() {
    this.ACCESS_TOKEN_KEY = 'accessToken';
    this.REFRESH_TOKEN_KEY = 'refreshToken';
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
      const decoded = this.decodeToken();
      const expFromJwt = decoded?.exp ? Number(decoded.exp) * 1000 : null;
      const fallbackExpiry = Date.now() + (24 * 60 * 60 * 1000);
      const finalExpiry = expFromJwt && !Number.isNaN(expFromJwt) ? expFromJwt : fallbackExpiry;
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, finalExpiry.toString());
      console.log('TokenManager: Token expires at:', new Date(finalExpiry));
    }
  }

  getToken() {
    const token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    console.log('TokenManager: Getting token:', token ? 'Token exists' : 'No token');
    return token;
  }

  setRefreshToken(token) {
    if (!token) return;
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  getRefreshToken() {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  isTokenValid() {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    return !this.isTokenExpired();
  }

  isTokenExpired() {
    let expiryTime = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryTime) {
      const decoded = this.decodeToken();
      const expFromJwt = decoded?.exp ? Number(decoded.exp) * 1000 : null;
      if (expFromJwt && !Number.isNaN(expFromJwt)) {
        expiryTime = expFromJwt.toString();
        localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime);
      } else {
        return true;
      }
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
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }
}

const tokenManager = new TokenManager();
export default tokenManager;
