import axios from 'axios';

// Use environment-specific API base URL, fallback to relative path for production builds
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';


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
            // Don't redirect during authentication flows (login/register endpoints)
            const isAuthEndpoint = error.config?.url?.includes('/auth/login') ||
                                   error.config?.url?.includes('/auth/register') ||
                                   error.config?.url?.includes('/auth/mfa');

            // Don't redirect if it's an MFA challenge response
            const isMFAChallenge = error.response?.data?.error === 'MFA_REQUIRED';

            if (!isAuthEndpoint && !isMFAChallenge) {
                // Token expired or invalid for protected endpoints
                localStorage.removeItem('video_forge_token');
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

export default api;