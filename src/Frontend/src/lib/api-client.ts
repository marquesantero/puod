import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
});

// Helper to check if token is expired
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    // Check if token expires in less than 30 seconds
    return Date.now() >= (exp - 30000);
  } catch {
    return true;
  }
}

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Check if token is expired before making request
      if (isTokenExpired(token)) {
        console.log('[API Client] Access token expired, will attempt refresh');
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track if we're already redirecting to avoid multiple redirects
let isRedirecting = false;

// Optional: Add a response interceptor to handle token refresh on 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;

    if (status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken && !isRedirecting) {
        try {
          console.log('[API Client] Attempting to refresh token...');
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/refresh`,
            { refreshToken }
          );
          const { accessToken, refreshToken: newRefreshToken } = response.data;

          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken;
          originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;

          console.log('[API Client] Token refreshed successfully');
          return apiClient(originalRequest);
        } catch (refreshError) {
          console.error('[API Client] Token refresh failed:', refreshError);
          // If refresh fails, clear tokens and redirect to login
          handleSessionExpired();
          return Promise.reject(refreshError);
        }
      } else if (!isRedirecting) {
        console.log('[API Client] No refresh token available or already redirecting');
        handleSessionExpired();
      }
    }
    return Promise.reject(error);
  }
);

// Handle session expiration with user notification
function handleSessionExpired() {
  if (isRedirecting) return;

  isRedirecting = true;
  console.log('[API Client] Session expired, redirecting to login');

  // Clear tokens
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');

  // Show notification (will be visible briefly before redirect)
  const event = new CustomEvent('session-expired', {
    detail: { message: 'Your session has expired. Please log in again.' }
  });
  window.dispatchEvent(event);

  // Small delay to allow any pending state updates
  setTimeout(() => {
    window.location.href = '/login';
  }, 100);
}


export default apiClient;
