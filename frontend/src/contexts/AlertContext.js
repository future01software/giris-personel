import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const AlertContext = createContext();

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;
const CACHE_KEY = 'CLEAR2WORK_ALERTS_CACHE';
const ALERT_DAYS = 30;

export const AlertProvider = ({ children }) => {
    const { token, user } = useAuth();

    const [alerts, setAlerts] = useState(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            return [];
        }
    });

    const [loading, setLoading] = useState(() => {
        return !localStorage.getItem(CACHE_KEY);
    });

    const fetchAlerts = useCallback(async () => {
        if (!token) {
            setAlerts([]);
            setLoading(false);
            return;
        }

        const role = (user?.role || '').toLowerCase();

        // Sadece yetkili roller alerts endpoint'ini çağırsın
        if (!['admin', 'supervisor'].includes(role)) {
            setAlerts([]);
            localStorage.removeItem(CACHE_KEY);
            setLoading(false);
            return;
        }

        try {
            const response = await axios.get(
                `${API}/alerts/expiring-documents?days=${ALERT_DAYS}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const rawAlerts = response?.data?.alerts || [];

            const filtered = rawAlerts
                .filter(a => {
                    if (a.has_any_expired === true || (a.expired_count || 0) > 0) return false;
                    if (!a.expiring_documents || a.expiring_documents.length === 0) return false;

                    const hasAlreadyExpiredDoc = a.expiring_documents.some(d => {
                        return d.is_expired || (d.days_until_expiry !== undefined && d.days_until_expiry <= 0);
                    });

                    if (hasAlreadyExpiredDoc) return false;

                    const futureExpiring = a.expiring_documents.filter(d => {
                        if (d.is_expired) return false;
                        if (d.days_until_expiry !== undefined && d.days_until_expiry <= 0) return false;
                        return true;
                    });

                    return futureExpiring.length > 0;
                })
                .map(a => ({
                    ...a,
                    expiring_documents: a.expiring_documents.filter(
                        d => !d.is_expired && d.days_until_expiry > 0
                    )
                }));

            setAlerts(filtered);
            localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.error('Failed to fetch alerts:', error);

            // 403 veya başka hata durumunda kullanıcıyı sistemden atma
            setAlerts([]);
            localStorage.removeItem(CACHE_KEY);
        } finally {
            setLoading(false);
        }
    }, [token, user]);

    useEffect(() => {
        fetchAlerts();

        const interval = setInterval(() => {
            fetchAlerts();
        }, 60000);

        return () => clearInterval(interval);
    }, [fetchAlerts]);

    return (
        <AlertContext.Provider value={{ alerts, loading, refreshAlerts: fetchAlerts }}>
            {children}
        </AlertContext.Provider>
    );
};

export const useAlerts = () => useContext(AlertContext);