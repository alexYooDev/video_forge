import axios from 'axios';

// Use environment-specific API base URL, fallback to relative path for production builds
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// for auth token auto request 
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('video_forge_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// auth error handling 
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('video_forge_token');
        window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default api;