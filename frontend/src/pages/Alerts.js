// src/pages/Alerts.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import { AlertTriangle, Calendar, ArrowLeft, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Alerts = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Varsayılan 14 gün
  const [days, setDays] = useState(14);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      // AuthContext yapına göre olası token alanları
      const token =
        user?.access_token ||
        user?.token ||
        user?.jwt ||
        user?.data?.access_token ||
        user?.data?.token;

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.get(
        `${API}/alerts/expiring-documents?days=${days}`,
        { headers }
      );

      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [days, user]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    let result = [...alerts];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (alert) =>
          alert.full_name?.toLowerCase().includes(term) ||
          alert.company?.toLowerCase().includes(term) ||
          alert.phone?.toLowerCase().includes(term)
      );
    }

    // Sort: expiring soon first, expired at bottom
    result.sort((a, b) => {
      const aDays = a.most_urgent_days;
      const bDays = b.most_urgent_days;

      if (aDays < 0 && bDays < 0) return bDays - aDays; // less negative first
      if (aDays < 0) return 1;
      if (bDays < 0) return -1;
      return aDays - bDays;
    });

    setFilteredAlerts(result);
  }, [alerts, searchTerm]);

  const expiredCount = alerts.filter((a) => a.most_urgent_days < 0).length;
  const expiringCount = alerts.filter((a) => a.most_urgent_days >= 0).length;

  if (loading) {
    return (
      //      <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600 dark:text-slate-300">
          {t('loading')}
        </div>
      </div>
      //      </Layout>
    );
  }

  return (
    //    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </Button>

          <h1 className="page-title">
            {t('expiringDocuments')}
          </h1>
        </div>

        {/* Days Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {t('timeFilter')}:
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-10 px-3 rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-white/10 shadow-inner"
            data-testid="days-filter"
          >
            <option value={7}>7 {t('days')}</option>
            <option value={14}>14 {t('days')}</option>
            <option value={30}>30 {t('days')}</option>
            <option value={60}>60 {t('days')}</option>
            <option value={90}>90 {t('days')}</option>
            <option value={365}>365 {t('days')}</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-amber-100 dark:bg-amber-950/40 px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-900">
          <span className="text-amber-800 dark:text-amber-200 font-medium">
            ⚠️ {t('expiringSoon')}: {expiringCount}
          </span>
        </div>

        <div className="bg-red-100 dark:bg-rose-950/40 px-4 py-2 rounded-lg border border-red-200 dark:border-rose-900">
          <span className="text-red-800 dark:text-rose-200 font-medium">
            ❌ {t('alreadyExpiredCount')}: {expiredCount}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
        <Input
          placeholder={t('searchByNameCompanyPhone')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner"
          data-testid="alerts-search-input"
        />
      </div>

      {/* Table / List */}
      <div className="bg-white dark:bg-[#080808] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-600 dark:text-amber-300" />
            {t('totalRecords')} {filteredAlerts.length} {t('records')} •{' '}
            {t('showingExpiringFirst')}
          </p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-white/5">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              {searchTerm ? t('noSearchResults') : t('noAlerts')}
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.personnel_id}
                className={`flex items-center justify-between p-4 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${alert.most_urgent_days < 0
                  ? 'bg-red-50/50 dark:bg-rose-950/20'
                  : ''
                  }`}
                onClick={() => navigate(`/personnel/${alert.personnel_id}`)}
                data-testid={`alert-row-${alert.personnel_id}`}
              >
                {/* Left */}
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {alert.full_name}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {alert.company}
                  </p>
                  {alert.phone && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Tel: {alert.phone}
                    </p>
                  )}
                </div>

                {/* Right */}
                <div className="flex items-center gap-6">
                  <div className="text-right space-y-1">
                    {(alert.expiring_documents || []).map((doc, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">
                          {doc.document_type}:
                        </span>{' '}
                        {doc.is_expired ? (
                          <span className="text-red-600 dark:text-rose-300 font-bold">
                            {t('alreadyExpired')}
                          </span>
                        ) : (
                          <span
                            className={
                              doc.days_until_expiry <= 7
                                ? 'text-red-600 dark:text-rose-300 font-semibold'
                                : 'text-amber-600 dark:text-amber-300'
                            }
                          >
                            {doc.days_until_expiry} {t('daysLeft')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <Calendar
                    className={`w-6 h-6 ${alert.most_urgent_days < 0
                      ? 'text-red-500 dark:text-rose-300'
                      : 'text-amber-500 dark:text-amber-300'
                      }`}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    //    </Layout>
  );
};

export default Alerts;
