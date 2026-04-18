import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export const PublicOnlyRoute = () => {
    const token = localStorage.getItem('token');
    const location = useLocation();

    if (token && !location.state?.fromLanding && !location.state?.fromAuthPage) {
        return <Navigate to="/lattice" replace />;
    }

    return <Outlet />;
};
