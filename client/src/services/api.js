import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Crucial for sending/receiving HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to handle authentication expiration cleanly
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 Unauthorized occurs on protected routes (except during auth check/login/register), redirect or inform
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/me') && !url.includes('/auth/login') && !url.includes('/auth/register')) {
        // Clear local storage if any and trigger logout state
        console.warn('Session expired or unauthorized');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
