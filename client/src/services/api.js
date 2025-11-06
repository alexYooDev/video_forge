import axios from 'axios';

// Use environment-specific API base URL, fallback to relative path for production builds
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  'https://9aprzwxo9g.execute-api.ap-southeast-2.amazonaws.com/prod/api';


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

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

// auth error handling with automatic token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401) {
            // Don't refresh during authentication flows (login/register/refresh endpoints)
            const isAuthEndpoint = error.config?.url?.includes('/auth/login') ||
                                   error.config?.url?.includes('/auth/register') ||
                                   error.config?.url?.includes('/auth/refresh') ||
                                   error.config?.url?.includes('/auth/mfa');

            // Don't redirect if it's an MFA challenge response
            const isMFAChallenge = error.response?.data?.error === 'MFA_REQUIRED';

            if (!isAuthEndpoint && !isMFAChallenge && !originalRequest._retry) {
                if (isRefreshing) {
                    // If already refreshing, queue this request
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then(token => {
                        originalRequest.headers['Authorization'] = 'Bearer ' + token;
                        return api(originalRequest);
                    }).catch(err => {
                        return Promise.reject(err);
                    });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    // Dynamically import authService to avoid circular dependency
                    const { authService } = await import('./auth.js');
                    const { token } = await authService.refreshToken();

                    processQueue(null, token);
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    localStorage.removeItem('video_forge_token');
                    localStorage.removeItem('video_forge_user');
                    localStorage.removeItem('video_forge_access_token');
                    localStorage.removeItem('video_forge_refresh_token');
                    window.location.href = '/';
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            if (!isAuthEndpoint && !isMFAChallenge) {
                console.error('401 Unauthorized error:', error.response?.data);
                console.error('Request URL:', error.config?.url);
            }
        }
        return Promise.reject(error);
    }
);

export default api;