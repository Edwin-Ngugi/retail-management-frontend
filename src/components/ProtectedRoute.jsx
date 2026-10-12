import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');

  // If no token exists, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the child route/component
  return <Outlet />;
}