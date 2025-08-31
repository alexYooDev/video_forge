import axios from 'axios';

const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'http://13.210.68.108:8000/api'
    : 'http://localhost:8000/api/';

const api = axios.create({
baseURL: API_BASE_URL,
timeout: 10000,
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