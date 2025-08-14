import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './Auth.css';

const VerificationPage = () => {
    const [verificationStatus, setVerificationStatus] = useState('Verifying...');
    const location = useLocation();

    useEffect(() => {
        const verifyToken = async () => {
            const params = new URLSearchParams(location.search);
            const token = params.get('token');

            if (!token) {
                setVerificationStatus('Invalid verification link.');
                return;
            }

            try {
                const response = await fetch(`/api/verify?token=${token}`);
                const data = await response.json();

                if (response.ok) {
                    setVerificationStatus(data.message || 'Email verified successfully! You can now log in.');
                } else {
                    setVerificationStatus(data.message || 'Verification failed. The link may be expired or invalid.');
                }
            } catch (error) {
                setVerificationStatus('An error occurred during verification.');
            }
        };

        verifyToken();
    }, [location]);

    return (
        <div className="auth-wrapper">
            <div className="auth-container">
                <header className="auth-header">
                    <h1 className="auth-header-title">Account Verification</h1>
                    <p className="auth-header-subtitle">{verificationStatus}</p>
                </header>
                <div className="auth-message-container">
                    <p className="auth-message">{verificationStatus}</p>
                </div>
            </div>
        </div>
    );
};

export default VerificationPage;