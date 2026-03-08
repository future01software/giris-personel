import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;
const TOKEN_KEY = 'token';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((t) => {
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    applyToken(null);
    setLoading(false);
  }, [applyToken]);

  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      return true;
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401 || status === 403) {
        logout();
      } else {
        setLoading(false);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    applyToken(token);
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, applyToken, fetchUser]);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      const { token: newToken, user: newUser } = response.data || {};

      if (!newToken) {
        throw new Error('Login response token missing');
      }

      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(newUser || null);
      applyToken(newToken);

      await fetchUser();
      return true;
    } catch (error) {
      logout();
      throw error;
    } finally {
      setLoading(false);
    }
  }, [applyToken, fetchUser, logout]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({ user, token, login, logout, loading }),
    [user, token, login, logout, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
