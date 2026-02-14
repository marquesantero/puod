import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to watch token expiration and auto-logout
 */
export function useTokenWatcher() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if token is expired
    const checkTokenExpiration = () => {
      const token = localStorage.getItem('accessToken');

      if (!token) {
        // No token, nothing to check
        return;
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();

        // If token is expired or expires in less than 10 seconds
        if (now >= exp - 10000) {
          const expiredAgo = Math.floor((now - exp) / 1000);
          const expiresIn = Math.floor((exp - now) / 1000);

          if (expiredAgo > 0) {
            console.log(`[Token Watcher] Token expired ${expiredAgo} seconds ago, logging out...`);
          } else {
            console.log(`[Token Watcher] Token expires in ${expiresIn} seconds, logging out preemptively...`);
          }

          // Clear all auth data
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');

          // Dispatch event for toast notification
          const event = new CustomEvent('session-expired', {
            detail: { message: 'Your session has expired. Please log in again.' }
          });
          window.dispatchEvent(event);

          // Redirect to login
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 500);
        } else {
          // Log remaining time every 5 minutes
          const minutesRemaining = Math.floor((exp - now) / 60000);
          const lastLoggedMinute = parseInt(sessionStorage.getItem('lastTokenLogMinute') || '0');

          if (minutesRemaining <= 5 && minutesRemaining !== lastLoggedMinute) {
            console.log(`[Token Watcher] Token expires in ${minutesRemaining} minute(s)`);
            sessionStorage.setItem('lastTokenLogMinute', minutesRemaining.toString());
          }
        }
      } catch (error) {
        console.error('[Token Watcher] Error parsing token:', error);
        // If token is invalid, clear it
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
      }
    };

    // Check immediately on mount
    checkTokenExpiration();

    // Check every 30 seconds
    const interval = setInterval(checkTokenExpiration, 30000);

    return () => clearInterval(interval);
  }, [navigate]);
}
