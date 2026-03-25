import axios from 'axios';

// Automatically determine the backend API URL.
const getBaseURL = () => {
  const stored = localStorage.getItem('api_url');
  if (stored) return stored;

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // If running locally on port 5173, fallback to port 3001
  if (window.location.port === '5173') {
    return `http://${window.location.hostname}:3001/api`;
  }
  
  // Default to relative path
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
