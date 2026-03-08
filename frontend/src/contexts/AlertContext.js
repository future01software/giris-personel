import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const AlertContext = createContext();

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CACHE_KEY = 'CLEAR2WORK_ALERTS_CACHE';
const ALERT_DAYS = 30;

export const AlertProvider = ({ children }) => {
    const { token } = useAuth();

    // Initialize from cache if available to prevent "0" flash
    const [alerts, setAlerts] = useState(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            return [];
        }
    });

    // Loading is true only if we have NO data. If we have cache, we show it (loading=false) while fetching fresh.
    const [loading, setLoading] = useState(() => {
        return !localStorage.getItem(CACHE_KEY);
    });

    const fetchAlerts = useCallback(async () => {
        if (!token) return; // Wait for token
        try {
            const response = await axios.get(`${API}/alerts/expiring-documents?days=${ALERT_DAYS}`);
            const rawAlerts = response?.data?.alerts || [];

            // Strict Filter: Only show people who are VALID now but have UPCOMING expiry.
            // Exclude anyone who is already expired (has_any_expired).
            const filtered = rawAlerts.filter(a => {
                // 1. Must NOT have any already expired documents
                if (a.has_any_expired === true || (a.expired_count || 0) > 0) return false;

                // 2. Must have expiring documents
                if (!a.expiring_documents || a.expiring_documents.length === 0) return false;

                // 3. AGGRESSIVE CHECK:
                // If the person has ANY document with days_until_expiry <= 0, they are technically "expired" or "invalid" right now.
                // We must exclude them from the "Approaching" list because they belong in the "Blocked" list.
                const hasAlreadyExpiredDoc = a.expiring_documents.some(d => {
                    return d.is_expired || (d.days_until_expiry !== undefined && d.days_until_expiry <= 0);
                });

                if (hasAlreadyExpiredDoc) return false;

                // 4. Double check: Ensure the expiring documents are actually in the future (just in case backend leaks)
                const futureExpiring = a.expiring_documents.filter(d => {
                    if (d.is_expired) return false;
                    if (d.days_until_expiry !== undefined && d.days_until_expiry <= 0) return false;
                    return true;
                });

                return futureExpiring.length > 0;
            }).map(a => ({
                ...a,
                // Only keep the valid future expiring docs for display
                expiring_documents: a.expiring_documents.filter(d => !d.is_expired && d.days_until_expiry > 0)
            }));

            setAlerts(filtered);
            localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) fetchAlerts();

        const interval = setInterval(() => {
            if (token) fetchAlerts();
        }, 60000);
        return () => clearInterval(interval);
    }, [fetchAlerts, token]);

    return (
        <AlertContext.Provider value={{ alerts, loading, refreshAlerts: fetchAlerts }}>
            {children}
        </AlertContext.Provider>
    );
};

export const useAlerts = () => useContext(AlertContext);
