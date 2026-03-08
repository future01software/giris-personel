// src/pages/EntryLogs.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
// import Layout from '../components/Layout';
import { Search, Clock, LogIn, LogOut, Shield, MapPin, User, FileDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toTurkishUpperCase } from '../utils/textHelpers';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const pad2 = (n) => String(n).padStart(2, '0');
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};



const normalizeAction = (log) => {
  const raw = log?.action ?? log?.type ?? log?.decision ?? log?.status ?? '';
  const v = String(raw).trim().toLowerCase();

  // Entry Keywords
  if (['in', 'entry', 'enter', 'entered', 'approved', 'allow', 'allowed', 'accepted', 'ok', 'giris', 'giriş'].includes(v)) return 'in';

  // Exit Keywords (Including Turkish 'cikis', 'çıkış')
  if (['out', 'exit', 'exited', 'rejected', 'deny', 'denied', 'not_ok', 'no', 'cikis', 'çıkış', 'cikisi'].includes(v)) return 'out';

  return 'unknown';
};

const EntryLogs = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [ioFilter, setIoFilter] = useState('all');
  const [day, setDay] = useState(todayYMD());

  const [dayTotals, setDayTotals] = useState({});
  const [dayTotalsLoading, setDayTotalsLoading] = useState(false);

  // Report Modal State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportLoading, setReportLoading] = useState(false);

  const handleDownloadReport = async () => {
    setReportLoading(true);
    try {
      const response = await axios.get(`${API}/entry-logs/monthly-report-excel`, {
        params: { year: reportYear, month: reportMonth },
        responseType: 'blob', // Important for file download
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Aylik_Rapor_${reportYear}_${String(reportMonth).padStart(2, '0')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setIsReportOpen(false);
    } catch (error) {
      console.error('Download failed:', error);
      alert(t('downloadFailed'));
    } finally {
      setReportLoading(false);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    const diffSecs = Math.floor(ms / 1000);
    const hours = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const secs = diffSecs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return (hours > 0 ? `${hours}${t('hoursUnit')} ` : '') + `${pad(mins)}${t('minutesUnit')} ${pad(secs)}${t('secondsUnit')}`;
  };

  useEffect(() => {
    setPage(1);
  }, [ioFilter, day]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/entry-logs/paginated?page=${page}&limit=${limit}&day=${day}`
      );
      setLogs(res.data.data || []);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setLogs([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, day]);

  const fetchDayTotals = useCallback(async () => {
    setDayTotalsLoading(true);
    try {
      const res = await axios.get(`${API}/entry-logs/day-totals?day=${day}`);
      const map = {};
      (res.data.items || []).forEach((it) => {
        if (it.person_id) map[it.person_id] = it.total_sec || 0;
      });
      setDayTotals(map);
    } catch (err) {
      console.error('Failed to fetch day totals:', err);
      setDayTotals({});
    } finally {
      setDayTotalsLoading(false);
    }
  }, [day]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchDayTotals();
  }, [fetchDayTotals]);

  const filteredLogs = useMemo(() => {
    if (ioFilter === 'all') return logs;
    return logs.filter((l) => normalizeAction(l).toUpperCase() === ioFilter);
  }, [logs, ioFilter]);

  if (loading) {
    return (
      //      <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600 dark:text-slate-300">{t('loading')}</div>
      </div>
      //      </Layout>
    );
  }

  return (

    //    <Layout>
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-normal uppercase">
                {i18n.language === 'tr' ? toTurkishUpperCase(t('entryExitRecords')) : t('entryExitRecords')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('showingLast24Hours')}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsReportOpen(true)}
              className="px-5 py-2.5 bg-emerald-600 border border-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm font-bold"
            >
              <FileDown className="w-4 h-4" />
              {t('downloadReport')}
            </button>
            <button
              onClick={() => navigate('/entry-logs/search')}
              className="px-5 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-full hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm font-bold"
            >
              <Search className="w-4 h-4 text-blue-600" />
              {t('searchRecord')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-[#080808] rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIoFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ioFilter === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
              >
                {t('all')}
              </button>

              <button
                onClick={() => setIoFilter('IN')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ioFilter === 'IN'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5" />
                  {t('entry')}
                </div>
              </button>

              <button
                onClick={() => setIoFilter('OUT')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ioFilter === 'OUT'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20'
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5" />
                  {t('exit')}
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('day')}:</span>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 text-sm"
              />
              <button
                onClick={fetchDayTotals}
                disabled={dayTotalsLoading}
                className="px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                {t('refresh')}
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t('totalRecords', { count: total })}
              </span>
            </div>
          </div>
        </div>

        {/* Cards */}

        <div className="space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="bg-white dark:bg-[#080808] rounded-xl border border-slate-100 dark:border-white/5 p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">{t('noRecordsFound')}</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const action = normalizeAction(log);
              const isIn = action === 'in';
              const logDate = new Date(log.created_at);
              const timeStr = logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              const personId = log.person_id || log.personnel_id;

              // Calculate Duration for Exit
              let durationStr = '-';
              if (!isIn) {
                if (log.duration) {
                  durationStr = log.duration;
                } else {
                  const entry = filteredLogs.find(l =>
                    l.person_id === log.person_id &&
                    normalizeAction(l) === 'in' &&
                    new Date(l.created_at) < logDate
                  );
                  if (entry) {
                    const diff = logDate - new Date(entry.created_at);
                    durationStr = formatDuration(diff);
                  }
                }
              }

              // Security Source Logic
              let securitySource = log.created_by_name;
              if (!securitySource) {
                securitySource = t('security');
              }
              if (securitySource && securitySource.toLowerCase().includes('admin')) securitySource = t('admin');

              return (
                <div
                  key={log.id}
                  className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-4 border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
                >
                  {/* Left: Identity & Location */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-normal truncate">
                        {log.person_full_name || '-'}
                      </h4>
                      <div className={`md:hidden inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider text-white uppercase ${isIn ? 'bg-emerald-500' : 'bg-red-600'
                        }`}>
                        {isIn ? t('entryBadge') : t('exitBadge')}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-500 uppercase tracking-wide">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        {securitySource}
                      </div>
                      <span className="text-slate-300">|</span>
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {t(log.gate || 'mainGate')}
                      </div>
                    </div>
                  </div>

                  {/* Right: Unified Status & Timer */}
                  <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-6 md:pl-6 md:border-l md:border-slate-100 md:dark:border-slate-800">

                    {/* Timer / Duration Block */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5 text-slate-500 text-xs font-medium mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isIn ? t('entryTime') : t('duration')}</span>
                      </div>
                      <div className={`text-base font-bold font-mono tracking-tight ${isIn ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                        {isIn ? timeStr : durationStr}
                      </div>
                    </div>

                    {/* Status Badge & Time */}
                    <div className="flex flex-col items-end gap-1 min-w-[80px]">
                      <div className={`w-full text-center py-2 rounded-lg text-xs font-bold tracking-widest text-white uppercase shadow-sm ${isIn ? 'bg-emerald-500 shadow-emerald-200' : 'bg-red-600 shadow-red-200'
                        }`}>
                        {isIn ? t('entryBadge') : t('exitBadge')}
                      </div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                        {isIn ? '' : timeStr}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {t('previous')}
            </button>

            <span className="text-sm text-slate-600 dark:text-slate-300 px-3">
              {page} / {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {t('next')}
            </button>
          </div>
        )}
      </div>

      {/* Report Dialog */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileDown className="w-5 h-5 text-emerald-600" />
              {t('downloadMonthlyReport')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('year')}</label>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('month')}</label>
                <select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Date(0, m - 1).toLocaleString(i18n.language, { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleDownloadReport}
              disabled={reportLoading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {reportLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {t('downloadExcel')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </>
    //    </Layout>
  );
};

export default EntryLogs;
