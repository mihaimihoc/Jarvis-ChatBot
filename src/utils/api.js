// utils/api.js
const getAuthToken = () => {
    return localStorage.getItem('token');
};

export const fetchWithAuth = async (url, options = {}) => {
    const token = getAuthToken();
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Handle token expiration or invalidity
    if (response.status === 401 || response.status === 403) {
        // Redirect to login page
        localStorage.removeItem('token');
        window.location.href = '/login'; 
    }

    return response;
};