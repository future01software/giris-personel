// src/pages/EntryLogsSearch.jsx
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
// import Layout from '../components/Layout';
import { Search, ArrowLeft, Clock, LogIn, LogOut } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const pad2 = (n) => String(n).padStart(2, '0');
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const normalize = (s) => String(s || '').toLocaleLowerCase('tr-TR').trim();

const getLogDateValue = (log) => log?.created_at || log?.timestamp || '';
const formatLogDateTR = (log) => {
  const v = getLogDateValue(log);
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDurationSec = (sec, t) => {
  if (sec === null || sec === undefined) return '-';
  const s = Number(sec);
  if (!Number.isFinite(s) || s <= 0) return t('lessThanOneMinute');

  const totalMin = Math.floor(s / 60);
  if (totalMin <= 0) return t('lessThanOneMinute');

  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  if (h <= 0) return t('minutesShort', { m });
  return t('hoursMinutesShort', { h, m });
};

// ✅ SAHA / GATE LABELS - Use i18n keys
const GATE_LABELS = {
  ADMIN_BUILDING: 'ADMIN_BUILDING',
  PORT_FACILITY: 'PORT_FACILITY',
  OFFDOCK1_SAYINLAR: 'OFFDOCK1_SAYINLAR',
  OFFDOCK2_KOMURLER: 'OFFDOCK2_KOMURLER',
};

const gateText = (gate, t) => (gate ? (t(GATE_LABELS[gate]) || gate) : '');

const EntryLogsSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [ioFilter, setIoFilter] = useState('all');

  const [useDayFilter, setUseDayFilter] = useState(true);
  const [day, setDay] = useState(todayYMD());

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [info, setInfo] = useState({ scannedPages: 0, totalPages: 0, found: 0 });

  const [dayTotals, setDayTotals] = useState({});
  const [dayTotalsLoading, setDayTotalsLoading] = useState(false);

  const fetchOnePage = useCallback(async ({ page, limit, dayOpt }) => {
    const dayQuery = dayOpt ? `&day=${encodeURIComponent(dayOpt)}` : '';
    const url = `${API}/entry-logs/paginated?page=${page}&limit=${limit}${dayQuery}`;
    const res = await axios.get(url);
    return {
      data: res.data?.data || [],
      pages: res.data?.pages || 1,
      total: res.data?.total || 0,
    };
  }, []);

  const fetchDayTotalsForSelectedDay = useCallback(async (selectedDay) => {
    setDayTotalsLoading(true);
    try {
      const res = await axios.get(`${API}/entry-logs/day-totals?day=${encodeURIComponent(selectedDay)}`);
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
  }, []);

  const doSearch = useCallback(async () => {
    const term = q.trim();

    setLoading(true);
    setResults([]);
    setInfo({ scannedPages: 0, totalPages: 0, found: 0 });
    setDayTotals({});

    try {
      const limit = 200;
      const dayOpt = useDayFilter ? day : null;
      const actionOpt = ioFilter !== 'all' ? ioFilter : null;

      // Use the dedicated search endpoint which handles filtering and duration calculations on server
      const params = new URLSearchParams({
        q: term,
        limit: limit,
      });
      if (dayOpt) params.append('day', dayOpt);
      if (actionOpt) params.append('action', actionOpt);

      const res = await axios.get(`${API}/entry-logs/search?${params.toString()}`);
      const rawItems = res.data?.items || [];

      // Normalize + gate (saha) - Keep this as it adds client-side UI labels
      const items = rawItems.map((x) => {
        const action = String(x.action || '').toUpperCase();
        const gate = x?.gate || x?.site || x?.location || x?.area || x?.yard || '';

        return {
          ...x,
          action,
          _gate: gate,
          _gate_label: gateText(gate, t),
        };
      });

      setResults(items);
      setInfo({ scannedPages: 1, totalPages: 1, found: items.length });

      if (useDayFilter && items.length > 0) {
        await fetchDayTotalsForSelectedDay(day);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
      setInfo({ scannedPages: 0, totalPages: 0, found: 0 });
      setDayTotals({});
    } finally {
      setLoading(false);
    }
  }, [q, ioFilter, useDayFilter, day, fetchDayTotalsForSelectedDay, t]);

  const hint = useMemo(() => {
    if (useDayFilter) return t('searchDayFilterOn');
    return t('searchDayFilterOff');
  }, [useDayFilter, t]);

  return (
    //    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-normal">
              {t('logsSearchTitle')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('searchDetailedHint')}
            </p>
          </div>
        </div>

        <button
          onClick={doSearch}
          disabled={loading}
          className="px-4 py-2 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {t('searchButton')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#080808] rounded-xl border border-slate-100 dark:border-white/5 shadow-sm p-5">
        <div className="flex flex-col gap-4">
          {/* Search Input */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doSearch();
            }}
            placeholder={t('searchRecord')}
            className="w-full px-4 py-3 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Day Filter */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={useDayFilter}
                onChange={(e) => setUseDayFilter(e.target.checked)}
                className="w-4 h-4 accent-blue-500 rounded"
              />
              {t('dayFilter')}
            </label>

            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              disabled={!useDayFilter}
              className="px-3 py-2 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5 rounded-lg text-slate-900 dark:text-slate-100 text-sm disabled:opacity-60"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIoFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ioFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
            >
              {t('all')}
            </button>

            <button
              onClick={() => setIoFilter('IN')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ioFilter === 'IN'
                ? 'bg-blue-500 text-white'
                : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                }`}
            >
              <div className="flex items-center gap-1.5">
                <LogIn className="w-3.5 h-3.5" />
                {t('entryBadge')}
              </div>
            </button>

            <button
              onClick={() => setIoFilter('OUT')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ioFilter === 'OUT'
                ? 'bg-purple-500 text-white'
                : 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                }`}
            >
              <div className="flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5" />
                {t('exitBadge')}
              </div>
            </button>
          </div>

          {/* Info Text */}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </div>

          {!!info.scannedPages && (
            <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#0A0A0A] rounded-lg px-3 py-2 border border-slate-200 dark:border-white/5">
              Taranan sayfa: <b>{info.scannedPages}</b> / {info.totalPages} — Bulunan: <b>{info.found}</b>
              {useDayFilter && (
                <>
                  {' '}— {t('totalDuration')}: {dayTotalsLoading ? <b>{t('calculating')}</b> : <b>{t('ready')}</b>}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results - Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-[#080808] rounded-xl border border-slate-100 dark:border-white/5 p-12 text-center">
            <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400">{t('searching')}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-12 text-center">
            <Search className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">{t('noResultsFound')}</p>
          </div>
        ) : (
          results.map((log) => {
            const action = String(log.action || '').toUpperCase();
            const isIn = action === 'IN';

            const pid = log.person_id || log.personnel_id;
            const totalSec = pid ? dayTotals[pid] : null;

            return (
              <div
                key={log.id}
                className="bg-white dark:bg-[#080808] rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Person Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-white mb-0.5">
                      {log.person_full_name || '-'}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {log.person_company || '-'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {formatLogDateTR(log)}
                    </p>

                    {/* ✅ SAHA */}
                    {(log._gate_label || log._gate || log.gate || log.site || log.location) ? (
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                        📍 {log._gate_label || gateText(log._gate || log.gate || log.site || log.location || '', t)}
                      </p>
                    ) : null}

                    {log.note && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t('noteLabel')}: {log.note}
                      </p>
                    )}
                  </div>

                  {/* Center: Status Badge */}
                  <div className="flex items-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${isIn ? 'bg-blue-500 text-white shadow-sm' : 'bg-purple-500 text-white shadow-sm'
                        }`}
                    >
                      {isIn ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                      {isIn ? t('entryBadge') : t('exitBadge')}
                    </span>
                  </div>

                  {/* Right: Time Info */}
                  <div className="flex flex-col gap-1.5 text-xs min-w-[200px]">
                    {useDayFilter && !isIn && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{t('totalDuration')}:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {dayTotalsLoading ? '...' : formatDurationSec(totalSec, t)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">{t('guardLabel')}</span>
                      <span className="text-slate-900 dark:text-white">{log.created_by_name || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
    //    </Layout>
  );
};

export default EntryLogsSearch;
