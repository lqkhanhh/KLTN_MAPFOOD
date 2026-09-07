import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TOKEN_KEY } from '../api';

export function ProtectedRoute({ allowedRoles, children }: { allowedRoles: string[]; children: ReactNode }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  if (!currentUser || !localStorage.getItem(TOKEN_KEY)) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!allowedRoles.includes(currentUser.role)) return <Navigate replace to={currentUser.role === 'merchant' ? '/merchant/dashboard' : currentUser.role === 'admin' ? '/admin/overview' : '/'} />;
  return <>{children}</>;
}
