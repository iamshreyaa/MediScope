import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children, role }) => {
  const { currentUser, userData } = useAuth();

  if (!currentUser || !userData) {
    // Auth state still loading or user not logged in
    return <Navigate to="/login" replace />;
  }

  if (role && userData.role !== role.toLowerCase()) {
    // User logged in but wrong role
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
