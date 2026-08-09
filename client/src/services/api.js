import axios from 'axios';

/**
 * Central Axios instance. All API calls go through here so auth headers,
 * base URL, and error handling live in one place.
 *
 * withCredentials lets the browser send/receive the httpOnly JWT cookie
 * (the preferred auth transport per the phase plan).
 */
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || ''}/api`,
  withCredentials: true,
});

/**
 * Normalize errors so callers get a clean message. The server sends
 * { message } on failure; surface that as error.message. A 401 on any route
 * other than the session-restore probe (GET /auth/me) means the session
 * expired mid-use — AuthContext handles clearing state, so we just re-throw.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMessage = error.response?.data?.message;
    if (serverMessage) error.message = serverMessage;
    return Promise.reject(error);
  }
);

export default api;
