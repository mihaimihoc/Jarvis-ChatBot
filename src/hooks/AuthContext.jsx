import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children, onRedirectToLogin }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        // Function to check for the JWT token
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                // Here, you would ideally send the token to your backend to verify it's still valid
                // For this example, we'll just assume it's valid if it exists.
                try {
                    const response = await fetch('/api/user', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        setIsAuthenticated(true);
                        setUser(userData.user);
                    } else {
                        // Token is invalid, remove it and redirect
                        localStorage.removeItem('token');
                        onRedirectToLogin();
                    }
                } catch (error) {
                    // Network error or server unreachable
                    localStorage.removeItem('token');
                    onRedirectToLogin();
                }
            } else {
                setIsAuthenticated(false);
            }
            setLoading(false);
        };

        checkAuth();
    }, [onRedirectToLogin]);

    // Function to perform an authenticated fetch request
    const authenticatedFetch = async (url, options = {}) => {
        const token = localStorage.getItem('token');
        if (!token) {
            onRedirectToLogin();
            return new Response(JSON.stringify({ message: 'No token found' }), { status: 401 });
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
            // Token expired or invalid, handle redirect
            localStorage.removeItem('token');
            onRedirectToLogin();
        }

        return response;
    };

    // Logout function
    const logout = () => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
        onRedirectToLogin();
    };

    const contextValue = {
        isAuthenticated,
        loading,
        user,
        authenticatedFetch,
        logout, // Add logout to context
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};