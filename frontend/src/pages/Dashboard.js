// src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlerts } from '../contexts/AlertContext';
// import Layout from '../components/Layout'; // Provided globally
import {
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Clock, // Added Clock icon
  MapPin,
  Shield,
  LogIn,
  LogOut,
  History,
  ChevronRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'; // Added Dialog imports
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { toTurkishUpperCase } from '../utils/textHelpers';
import axios from 'axios';
import { useWebSocket } from '../contexts/WebSocketContext';
// Chart imports removed as they are unused

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;
const ALERT_DAYS = 30;
const LOG_POLL_MS = 60000; // Increased to 60s because WebSocket is active
const LOG_WINDOW_HOURS = 24;

// --- Helper Functions ---
const pad2 = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayYMD = () => ymdOf(new Date());
const yesterdayYMD = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return ymdOf(d);
};



const normalizeAction = (log) => {
  const raw = log?.action ?? log?.type ?? log?.decision ?? log?.status ?? '';
  const v = String(raw).trim().toLowerCase();

  // Entry Keywords
  if (['in', 'entry', 'enter', 'entered', 'approved', 'allow', 'allowed', 'accepted', 'ok', 'giris', 'giriş'].includes(v)) return 'in';

  // Exit Keywords (Including Turkish 'cikis', 'çıkış')
  if (['out', 'exit', 'exited', 'rejected', 'deny', 'denied', 'not_ok', 'no', 'cikis', 'çıkış', 'cikisi'].includes(v)) return 'out';

  return '';
};

// --- Optimized Global Timer Hook ---
// Shares a single interval across all components to prevent timer thrashing
const useGlobalTicker = (intervalMs = 1000) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
};

const getLogTs = (x) => x?.timestamp || x?.created_at || x?.entry_time || x?.exit_time || x?.createdAt || '';

const formatDuration = (ms, t) => {
  const diffSecs = Math.floor(ms / 1000);
  // Less than 1 minute
  if (diffSecs < 60) return `< 1${t('minutesUnit')}`;

  const hours = Math.floor(diffSecs / 3600);
  const mins = Math.floor((diffSecs % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');

  return (hours > 0 ? `${hours}${t('hoursUnit')} ` : '') + `${pad(mins)}${t('minutesUnit')}`;
};

// --- Optimized Duration Component ---
const LiveDuration = React.memo(({ startTime, isEntry, staticDuration, now, t }) => {
  if (!isEntry) return staticDuration || '-';
  const diffMs = Math.max(0, now - new Date(startTime).getTime());
  return formatDuration(diffMs, t);
});

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { alerts, loading: alertsLoading } = useAlerts();
  const navigate = useNavigate();

  // Global Ticker: Runs once every 30 seconds (sufficient for min-level updates)
  const now = useGlobalTicker(30000);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [securityLogsLoading, setSecurityLogsLoading] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false); // Added state for alerts modal

  // WebSocket Integration
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'NEW_ENTRY') {
      const newEntry = lastMessage.data;

      const normalizedEntry = {
        ...newEntry,
        _norm_action: normalizeAction(newEntry),
        _norm_ts: newEntry.timestamp,
        _norm_ts_ms: new Date(newEntry.timestamp).getTime(),
        _pid: newEntry.personnel_id || newEntry.person_id,
        _full_name: newEntry.person_full_name || '—',
        _gate: newEntry.gate
      };

      setSecurityLogs((prev) => [normalizedEntry, ...prev]);

      setStats((prev) => {
        if (!prev) return prev;
        let newInsideCount = prev.inside_count || 0;
        if (normalizedEntry._norm_action === 'in') {
          newInsideCount++;
        } else if (normalizedEntry._norm_action === 'out') {
          newInsideCount = Math.max(0, newInsideCount - 1);
        }
        return {
          ...prev,
          inside_count: newInsideCount
        };
      });
    }
  }, [lastMessage]);

  const fetchData = async () => {
    try {
      const statsRes = await axios.get(`${API}/dashboard/stats`);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityLogs = useCallback(async () => {
    setSecurityLogsLoading(true);
    try {
      // Optimized: Reduced from 400 to 100 records per day for better performance
      const [todayRes, yestRes] = await Promise.all([
        axios.get(`${API}/entry-logs/paginated?page=1&limit=100&day=${todayYMD()}`),
        axios.get(`${API}/entry-logs/paginated?page=1&limit=100&day=${yesterdayYMD()}`),
      ]);

      const list = [...(todayRes?.data?.data || []), ...(yestRes?.data?.data || [])];
      const nowMs = Date.now();
      const cutoffMs = nowMs - LOG_WINDOW_HOURS * 60 * 60 * 1000;

      const normalized = list
        .map((x) => {
          const ts = getLogTs(x);
          return {
            ...x,
            _norm_action: normalizeAction(x),
            _norm_ts: ts,
            _norm_ts_ms: ts ? new Date(ts).getTime() : NaN,
            _pid: x.person_id || x.personnel_id,
            _full_name: x.person_full_name || x.personnel_name || '—',
          };
        })
        .filter((x) => x._pid && (x._norm_action === 'in' || x._norm_action === 'out') && x._norm_ts_ms >= cutoffMs);

      setSecurityLogs(normalized);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setSecurityLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchSecurityLogs();
    // Optimized: Removed polling interval since WebSocket provides real-time updates
    // Users can manually refresh using the refresh button if needed
  }, [fetchSecurityLogs]);

  const chartData = useMemo(() => {
    const buckets = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      buckets.push({
        hour: d.getHours(),
        label: `${String(d.getHours()).padStart(2, '0')}:00`,
        entries: 0,
        exits: 0
      });
    }
    securityLogs.forEach(log => {
      const d = new Date(log._norm_ts_ms);
      const h = d.getHours();
      const bucket = buckets.find(b => b.hour === h);
      if (bucket) {
        if (log._norm_action === 'in') bucket.entries++;
        else bucket.exits++;
      }
    });
    return buckets;
  }, [securityLogs]);

  const recentEntries = useMemo(() => {
    const latestMap = new Map();
    securityLogs.forEach(log => {
      const existing = latestMap.get(log._pid);
      if (!existing || log._norm_ts_ms > existing._norm_ts_ms) {
        latestMap.set(log._pid, log);
      }
    });
    return Array.from(latestMap.values())
      .sort((a, b) => b._norm_ts_ms - a._norm_ts_ms)
      .slice(0, 10);
  }, [securityLogs]);

  const StatCard = React.memo(({ title, value, icon: Icon, onClick, bgClass, iconColorClass, textColorClass }) => (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-[2.5rem] p-6 transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''} ${bgClass} border border-transparent dark:border-white/5 hover:dark:border-white/10`}
    >
      <div className="flex items-center gap-6">
        {/* Circular Icon Container */}
        <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/5 group-hover:scale-110 transition-transform duration-300">
          <Icon className={`w-7 h-7 stroke-[2.5] ${iconColorClass}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col">
            <span className={`text-2xl font-bold tracking-tight ${textColorClass}`}>
              {value}
            </span>
            <span className={`text-sm font-medium opacity-60 ${textColorClass}`}>
              {title}
            </span>
          </div>
        </div>
      </div>
    </div>
  ));

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {t('dashboard')}
            </h1>
            <p className="text-slate-400 dark:text-slate-500 font-medium mt-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date().toLocaleDateString(i18n.language, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))
          ) : (
            <>
              <StatCard
                title={t('totalPersonnel')}
                value={stats?.total_personnel || 0}
                icon={Users}
                bgClass="bg-[#EFF6FF] dark:bg-[#080808]"
                iconColorClass="text-[#3B82F6]"
                textColorClass="text-[#1E40AF] dark:text-blue-400"
                onClick={() => navigate('/personnel')}
              />
              <StatCard
                title={t('canEnter')}
                value={stats?.can_enter || 0}
                icon={CheckCircle}
                bgClass="bg-[#F0FDF4] dark:bg-[#080808]"
                iconColorClass="text-[#10B981]"
                textColorClass="text-[#065F46] dark:text-emerald-400"
                onClick={() => navigate('/personnel?status=can')}
              />
              <StatCard
                title={t('cannotEnter')}
                value={stats?.cannot_enter || 0}
                icon={XCircle}
                bgClass="bg-[#FEF2F2] dark:bg-[#080808]"
                iconColorClass="text-[#EF4444]"
                textColorClass="text-[#991B1B] dark:text-red-400"
                onClick={() => navigate('/personnel?status=cannot')}
              />
              <StatCard
                title={t('urgentAlerts')}
                value={alerts.length}
                icon={AlertTriangle}
                bgClass="bg-[#FFF7ED] dark:bg-[#080808]"
                iconColorClass="text-[#F59E0B]"
                textColorClass="text-[#9A3412] dark:text-orange-400"
                onClick={() => setIsAlertsOpen(true)}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#080808] p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-white/5 rounded-lg text-blue-600 dark:text-blue-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {t('entryExitLogsTitle')}
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">
                      {recentEntries.length}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500">{t('last24Hours')}</p>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${(stats?.inside_count || 0) > 0 ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${(stats?.inside_count || 0) > 0 ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                      </span>
                      <span className={`text-xs font-medium ${(stats?.inside_count || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                        {t('insideLabel')} {stats?.inside_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs h-8"
                  onClick={() => navigate('/entry-logs')}
                >
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  {t('openLogsArchive')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs h-8"
                  onClick={fetchSecurityLogs}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${securityLogsLoading ? 'animate-spin' : ''}`} />
                  {t('refresh')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {recentEntries.map((log, idx) => {
                const isEntry = log._norm_action === 'in';
                const logDate = new Date(log._norm_ts_ms);
                const timeStr = logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const GATE_NAMES = {
                  'ADMIN_BUILDING': t('ADMIN_BUILDING'),
                  'PORT_FACILITY': t('PORT_FACILITY'),
                  'OFFDOCK1_SAYINLAR': t('OFFDOCK1_SAYINLAR'),
                  'OFFDOCK2_KOMURLER': t('OFFDOCK2_KOMURLER'),
                  'MAIN_GATE': t('mainGate')
                };

                // Calculate duration for exit if missing
                let displayDuration = log.duration;
                if (!isEntry && !displayDuration) {
                  const prevIn = securityLogs.find(l =>
                    l._pid === log._pid &&
                    l._norm_action === 'in' &&
                    l._norm_ts_ms < log._norm_ts_ms
                  );
                  if (prevIn) {
                    displayDuration = formatDuration(log._norm_ts_ms - prevIn._norm_ts_ms, t);
                  }
                }

                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-[#080808] rounded-2xl px-4 py-3.5 border border-slate-100/50 dark:border-white/5 shadow-soft hover:shadow-premium transition-all duration-300 group flex flex-col md:flex-row gap-4 items-start md:items-center justify-between relative overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/personnel/${log._pid}`)}
                  >
                    <div className="flex-1 min-w-0 relative z-10 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-soft ${isEntry ? 'bg-softGreen text-softGreenText' : 'bg-softRose text-softRoseText'}`}>
                        {log._full_name?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
                          {log._full_name}
                        </h4>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wider">
                          <MapPin className="w-3 h-3 stroke-[2.1]" />
                          {GATE_NAMES[log._gate] || log._gate || t('mainGate')}
                        </div>
                      </div>
                    </div>
                    <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-6">
                      <div className="flex flex-col items-end">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {timeStr}
                        </div>
                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                          {isEntry ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              {/* Calculate time since entry */}
                              {formatDuration(Date.now() - log._norm_ts_ms, t)} {t('insideTime')}
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {displayDuration ? (
                                <>
                                  <span className="font-normal text-slate-500 dark:text-slate-500 mr-1">
                                    {t('totalDuration')}:
                                  </span>
                                  {displayDuration}
                                </>
                              ) : '-'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-soft ${isEntry ? 'bg-softGreen text-softGreenText' : 'bg-softRose text-softRoseText'}`}>
                        {isEntry ? t('entryBadge') : t('exitBadge')}
                      </div>
                    </div>
                  </div >
                );
              })}
              {
                recentEntries.length === 0 && (
                  <div className="bg-white dark:bg-[#080808] rounded-2xl p-8 text-center border border-slate-100 dark:border-white/5">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">{t('noRecentActivity')}</p>
                  </div>
                )
              }
            </div >
          </div >
        </div >
      </div >

      <Dialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#080808] border border-slate-100 dark:border-white/5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              {t('actionRequired')}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">{t('expiringDocumentsSubtitle')}</p>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{alert.full_name}</p>
                  <p className="text-xs text-slate-500">{alert.expiring_documents[0]?.document_type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold px-2 py-1 bg-red-100 text-red-600 rounded">
                    {alert.expiring_documents[0]?.days_until_expiry} {t('days')}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setIsAlertsOpen(false); navigate(`/personnel/${alert.personnel_id}`); }}>
                    {t('review')}
                  </Button>
                </div>
              </div>
            ))}
            {alerts.length === 0 && <div className="text-center py-8 text-slate-500 text-sm">{t('noUrgentAlerts')}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Dashboard;
