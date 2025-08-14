import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import './Auth.css';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');
    const navigate = useNavigate(); // Initialize useNavigate

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            if (response.ok) {
                // Store the JWT in localStorage
                localStorage.setItem('token', data.token);
                setMessage('Login successful!');
                // Redirect to the main chat page or update app state
                navigate('/'); // Use navigate instead of window.location.href
            } else {
                setMessage(data.message || 'Login failed.');
            }
        } catch (error) {
            setMessage('An error occurred. Please try again.');
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-container">
                <header className="auth-header">
                    <h1 className="auth-header-title">Log In</h1>
                    <p className="auth-header-subtitle">Welcome back!</p>
                </header>
                <form onSubmit={handleSubmit} className="auth-form">
                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                    <button type="submit" className="auth-button">Log In</button>
                </form>
                {message && <p className="auth-message">{message}</p>}
                {/* New text and link for registration */}
                <p className="auth-switch-link">
                    Don't have an account? <Link to="/register">Register</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;