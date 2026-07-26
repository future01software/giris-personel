// src/pages/SecurityCheck.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Search, MapPin, User, DoorOpen, DoorClosed, LogIn, LogOut, Moon, Sun, Clock, FileText, CheckCircle, XCircle, AlertTriangle, Filter, Calendar, ChevronRight, Bell } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GATE_KEY = 'GK_SELECTED_GATE';

const GATES = [
  { value: 'ADMIN_BUILDING', label: 'İdari Bina' },
  { value: 'PORT_FACILITY', label: 'Liman Tesisi' },
  { value: 'OFFDOCK1_SAYINLAR', label: 'Offdock1 Sahası (Sayınlar)' },
  { value: 'OFFDOCK2_KOMURLER', label: 'Offdock2 Sahası (Kömürler)' },
];

const formatDuration = (ms, t) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);

  const pad2 = (n) => String(n).padStart(2, '0');

  if (days > 0) return `${days}${t('daysShort') || 'd'} ${pad2(hours)}${t('hoursUnit')} ${pad2(mins)}${t('minutesUnit')}`;
  if (hours > 0) return `${hours}${t('hoursUnit')} ${pad2(mins)}${t('minutesUnit')}`;
  return `${mins}${t('minutesUnit')}`;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeAction = (log) => {
  const raw = log?.action ?? log?.type ?? log?.decision ?? log?.status ?? '';
  const v = String(raw).trim().toLowerCase();

  if (v === 'in' || v === 'entry' || v === 'enter' || v === 'entered') return 'in';
  if (v === 'out' || v === 'exit' || v === 'exited') return 'out';
  if (v === 'approved' || v === 'allow' || v === 'allowed' || v === 'accepted' || v === 'ok')
    return 'in';
  if (v === 'rejected' || v === 'deny' || v === 'denied' || v === 'not_ok' || v === 'no')
    return 'out';

  return '';
};

const normalizeDecision = (x) => {
  const v = normalizeAction(x);
  if (v === 'in') return 'IN';
  if (v === 'out') return 'OUT';
  return '';
};

const getLogTs = (x) =>
  x?.timestamp ||
  x?.created_at ||
  x?.createdAt ||
  x?.entry_time ||
  x?.exit_time ||
  '';

const getLogGate = (x) => x?.gate || x?.gate_key || x?.gateKey || x?.location_gate || '';

const sameInside = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      String(a[i]?.personnel_id) !== String(b[i]?.personnel_id) ||
      Number(a[i]?.last_ts || 0) !== Number(b[i]?.last_ts || 0) ||
      String(a[i]?.gate || '') !== String(b[i]?.gate || '')
    ) return false;
  }
  return true;
};

const computeInsideFromLogs = (logs, gate) => {
  const latestByPid = new Map();

  for (const x of logs || []) {
    const pid =
      x?.personnel_id || x?.personnelId || x?.person_id || x?.personId || x?.personnel?.id;

    if (!pid) continue;

    const g = getLogGate(x);
    // Gate filtresi: loglarda gate varsa uygula, yoksa genel liste olur
    if (gate && g && String(g) !== String(gate)) continue;

    const ts = new Date(getLogTs(x) || 0).getTime();
    const prev = latestByPid.get(String(pid));
    if (!prev || ts > prev.ts) {
      latestByPid.set(String(pid), { ts, log: x });
    }
  }

  const items = [];
  for (const [pid, v] of latestByPid.entries()) {
    const dec = normalizeDecision(v.log);
    if (dec !== 'IN') continue;

    const p = v.log?.personnel || v.log?.person || {};
    const fullName =
      v.log?.full_name ||
      p?.full_name ||
      `${p?.first_name || ''} ${p?.last_name || ''}`.trim() ||
      `ID: ${pid}`;

    const g = getLogGate(v.log) || '';
    const gateLabel = GATES.find((z) => z.value === g)?.label || '';

    items.push({
      personnel_id: pid,
      full_name: fullName,
      company: v.log?.company || p?.company || '',
      last_ts: v.ts,
      gate: g,
      gate_label: gateLabel,
    });
  }

  // En yeni giriş üstte
  items.sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0));
  return items;
};

const SecurityCheck = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [searchForm, setSearchForm] = useState({ name: '', surname: '', tc: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personDetail, setPersonDetail] = useState(null);
  const [searching, setSearching] = useState(false);

  const [entryLoading, setEntryLoading] = useState(false);
  const [isInside, setIsInside] = useState(false);

  const [insideList, setInsideList] = useState([]);
  const [insideLoading, setInsideLoading] = useState(false);

  // sürelerin akması için
  const [nowTick, setNowTick] = useState(Date.now());

  // içeride listesi scroll zıplamasın diye
  const insideScrollRef = useRef(null);
  const insideScrollTopRef = useRef(0);

  const [selectedGate, setSelectedGate] = useState(
    () => localStorage.getItem(GATE_KEY) || 'PORT_FACILITY'
  );

  useEffect(() => {
    localStorage.setItem(GATE_KEY, selectedGate);
  }, [selectedGate]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Clear results when all inputs are cleared
  useEffect(() => {
    if (!searchForm.name && !searchForm.surname && !searchForm.tc) {
      setSearchResults([]);
      setSelectedPerson(null);
      setPersonDetail(null);
    }
  }, [searchForm]);

  // Hızlı çıkış (Inside Listeden)
  const handleQuickExit = async (personInfo) => {
    if (!personInfo?.personnel_id) return;
    if (!window.confirm(`${personInfo.full_name} için çıkış işlemi yapılsın mı?`)) return;

    setEntryLoading(true);
    try {
      const payload = {
        personnel_id: personInfo.personnel_id,
        direction: 'OUT',
        gate: selectedGate,
        action_by: user?.full_name || 'Security'
      };

      await axios.post(`${API}/entry-logs`, payload);
      toast.success(t('exitSaved'));

      // Refresh lists
      fetchInside();
    } catch (error) {
      console.error(error);
      toast.error(t('operationFailed'));
    } finally {
      setEntryLoading(false);
    }
  };

  const handleSearch = async () => {
    // Only search if at least one field has data
    if (!searchForm.name.trim() && !searchForm.surname.trim() && !searchForm.tc.trim()) {
      toast.warning(t('enterAtLeastOne') || 'Lütfen en az bir alan doldurun');
      return;
    }

    setSearching(true);
    try {
      // Build Query Params manually
      const params = new URLSearchParams();
      if (searchForm.name.trim()) params.append('name', searchForm.name.trim());
      if (searchForm.surname.trim()) params.append('surname', searchForm.surname.trim());
      if (searchForm.tc.trim()) params.append('tc', searchForm.tc.trim());

      const response = await axios.get(
        `${API}/personnel/search?${params.toString()}`
      );
      setSearchResults(Array.isArray(response.data) ? response.data : []);

      if (response.data.length === 0) {
        toast.info(t('noResultsFound') || 'Sonuç bulunamadı');
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error(t('searchFailed') || 'Arama başarısız');
    } finally {
      setSearching(false);
    }
  };

  const fetchInside = async ({ silent = false } = {}) => {
    // otomatik yenilemede loading açma -> kıpırdama biter
    if (!silent) setInsideLoading(true);

    // scroll pozisyonu koru
    const el = insideScrollRef.current;
    if (el) insideScrollTopRef.current = el.scrollTop;

    try {
      const logsRes = await axios.get(`${API}/entry/logs?limit=1000`);
      const list = Array.isArray(logsRes.data)
        ? logsRes.data
        : logsRes.data?.data || logsRes.data?.items || [];

      const inside = computeInsideFromLogs(list, selectedGate);

      setInsideList((prev) => (sameInside(prev, inside) ? prev : inside));
    } catch (e) {
      console.error('Failed to fetch inside list', e);
      // silent refresh'te boşaltma yapma -> ekrandaki liste zıplamasın
      if (!silent) setInsideList([]);
    } finally {
      if (!silent) setInsideLoading(false);

      // scroll geri yükle (render sonrası)
      requestAnimationFrame(() => {
        const el2 = insideScrollRef.current;
        if (el2) el2.scrollTop = insideScrollTopRef.current;
      });
    }
  };

  // Gate değişince + 10sn polling (silent)
  useEffect(() => {
    fetchInside({ silent: false });

    const id = setInterval(() => {
      fetchInside({ silent: true });
    }, 10000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGate]);

  const handleSelectPerson = async (person) => {
    setSelectedPerson(person);
    setPersonDetail(null);
    setSearchResults([]); // kişi seçince arama sonuçlarını temizle (istersen kaldırabilirsin)

    try {
      const response = await axios.get(`${API}/personnel/${person.id}`);
      setPersonDetail(response.data);

      // seçilen kişinin içeride mi kontrolü
      try {
        const logsRes = await axios.get(`${API}/entry/logs?limit=2000`);
        const list = Array.isArray(logsRes.data)
          ? logsRes.data
          : logsRes.data?.data || logsRes.data?.items || [];

        const pid = person.id;

        const my = list
          .filter((x) => {
            const id =
              x?.personnel_id || x?.personnelId || x?.person_id || x?.personId || x?.personnel?.id;
            return String(id || '') === String(pid);
          })
          .sort((a, b) => new Date(getLogTs(b) || 0) - new Date(getLogTs(a) || 0));

        const last = my[0];
        const a = normalizeAction(last);
        setIsInside(a === 'in');
      } catch (e) {
        console.warn('Could not load last entry status', e);
        setIsInside(false);
      }
    } catch (error) {
      console.error('Failed to fetch person detail:', error);
      toast.error(t('failedToLoadDetails') || 'Failed to load details');
      setPersonDetail(null);
      setIsInside(false);
    }
  };

  const getStatusMessage = () => {
    if (!personDetail) return '';
    if (Array.isArray(personDetail.restriction_reasons) && personDetail.restriction_reasons.length > 0)
      return t('entryRestricted');
    if (personDetail.assignment_expired)
      return t('assignmentExpired') || 'Görev süresi dolmuş - GİRİŞ YASAK';
    if (personDetail.overall_status === 'red')
      return t('documentsExpired') || 'Evrakları eksik/süresi geçmiş - GİRİŞ YASAK';
    if (personDetail.overall_status === 'yellow')
      return t('documentsWarning') || 'Evraklar yakında süre dolacak - UYARI';
    return t('allDocumentsValid') || 'Tüm evraklar geçerli - GİRİŞ İZNİ VAR';
  };

  const canEnter = () => {
    if (!personDetail) return false;
    if (personDetail.assignment_expired) return false;
    if (isInside) return false;

    const s = String(personDetail.overall_status || '').toLowerCase();
    return s === 'green' || s === 'yellow';
  };

  const canExit = () => {
    if (!personDetail) return false;
    return isInside === true;
  };

  const submitEntry = async (action) => {
    const personId = personDetail?.personnel?.id || selectedPerson?.id;

    if (!personId) {
      toast.error(t('personNotFound') || 'Personel bulunamadı');
      return;
    }

    if (action === 'IN' && !canEnter()) {
      toast.error(
        t('noEntryPermission') ||
        'Bu personelin giriş izni yok. (Eksik/süresi geçmiş evrak veya görev süresi dolmuş olabilir.)'
      );
      return;
    }

    if (action === 'OUT' && !canExit()) {
      toast.error(
        t('cannotExit') ||
        'Çıkış verilemez. Personel içeride değil ya da evrak/görev durumu uygun değil.'
      );
      return;
    }

    setEntryLoading(true);
    try {
      await axios.post(`${API}/entry/decision`, {
        personnel_id: personId,
        decision: action,
        reason: '',
        gate: selectedGate,
      });

      toast.success(
        action === 'IN'
          ? t('entrySaved') || 'Giriş kaydedildi'
          : t('exitSaved') || 'Çıkış kaydedildi'
      );

      setIsInside(action === 'IN');

      // ✅ içeridekileri anında güncelle (manuel gibi, loading göstermeden de olur)
      await fetchInside({ silent: true });
    } catch (e) {
      console.error('Entry log failed:', e);
      toast.error(
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        (t('operationFailed') || 'İşlem başarısız')
      );
    } finally {
      setEntryLoading(false);
    }
  };

  const safePersonnel = personDetail?.personnel || {};
  const safeDocs = useMemo(
    () => (Array.isArray(personDetail?.documents) ? personDetail.documents : []),
    [personDetail]
  );
  const activitySummary = personDetail?.activity_summary || {};
  const restrictionReasons = Array.isArray(personDetail?.restriction_reasons)
    ? personDetail.restriction_reasons
    : [];
  const gateName = (value) => GATES.find((gate) => gate.value === value)?.label || value || '-';
  const restrictionReasonText = (reason) => {
    const documents = Array.isArray(reason?.documents) && reason.documents.length
      ? `: ${reason.documents.filter(Boolean).join(', ')}`
      : '';
    const detail = reason?.detail ? `: ${reason.detail}` : '';
    const labels = {
      assignment_not_started: t('assignmentNotStarted'),
      assignment_expired: t('assignmentExpiredReason'),
      admin_blocked: t('adminBlockedReason'),
      mandatory_document_missing: t('mandatoryDocumentMissing'),
      document_expired: t('expiredDocumentReason'),
    };
    return `${labels[reason?.code] || t('entryRestricted')}${documents || detail}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#080808] md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">
            {t('entryCheck')}
          </h1>
          <p className="ml-[15px] mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('searchPersonnelToCheck')}
          </p>
        </div>
        <div className="w-full md:w-[300px]">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('gate')}
          </label>
          <select
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 bg-[#f6f8fb] px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0a4f83] focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          >
            {GATES.map((g) => (
              <option key={g.value} value={g.value}>
                {t(g.value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 min-h-[calc(100dvh-15rem)]">
        {/* Left Panel - Search */}
        <div className="bg-white dark:bg-[#080808] border border-slate-200 dark:border-white/5 rounded-2xl p-5 flex flex-col shadow-sm">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#eef5fb] dark:bg-sky-950/30 rounded-lg flex items-center justify-center text-[#0a4f83] dark:text-sky-300">
              <Search className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('personSearch') || 'Kişi Arama'}
            </h2>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 ml-1">
                {t('name') || 'Ad'}
              </label>
              <input
                value={searchForm.name}
                onChange={(e) => setSearchForm(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full h-12 px-4 rounded-lg bg-[#f6f8fb] dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-[#0a4f83] focus:ring-2 focus:ring-sky-100 outline-none transition-colors font-medium text-slate-900 dark:text-slate-100"
                placeholder=""
              />
            </div>

            {/* Surname */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 ml-1">
                {t('surname') || 'Soyad'}
              </label>
              <input
                value={searchForm.surname}
                onChange={(e) => setSearchForm(prev => ({ ...prev, surname: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full h-12 px-4 rounded-lg bg-[#f6f8fb] dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-[#0a4f83] focus:ring-2 focus:ring-sky-100 outline-none transition-colors font-medium text-slate-900 dark:text-slate-100"
                placeholder=""
              />
            </div>

            {/* TC */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 ml-1">
                {t('tcNumber') || 'TCKN / Kimlik No'}
              </label>
              <input
                value={searchForm.tc}
                onChange={(e) => setSearchForm(prev => ({ ...prev, tc: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full h-12 px-4 rounded-lg bg-[#f6f8fb] dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-[#0a4f83] focus:ring-2 focus:ring-sky-100 outline-none transition-colors font-medium text-slate-900 dark:text-slate-100"
                placeholder=""
              />
            </div>
          </div>

          {/* Search Button */}
          <div className="flex justify-end mb-5">
            <button
              onClick={handleSearch}
              disabled={searching}
              className="h-12 w-full min-w-[170px] px-7 bg-[#0b4f87] hover:bg-[#083d69] text-white rounded-lg font-bold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:w-auto"
            >
              {searching ? (
                <span className="w-5 h-5 border-2 border-slate-400 border-t-slate-100 rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              {t('searchAction') || 'ARA'}
            </button>
          </div>

          <hr className="border-slate-100 dark:border-slate-800 mb-6" />

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => handleSelectPerson(person)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 group ${selectedPerson?.id === person.id
                      ? 'border-[#0a4f83] dark:border-sky-400 bg-[#EFF6FF] dark:bg-sky-950/20 shadow-sm'
                      : 'border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      {person.photo_url ? (
                        <img
                          src={person.photo_url}
                          alt={person.full_name}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 border border-transparent dark:border-white/5">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                          {person.full_name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {person.tc_number}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="h-full flex flex-col justify-end pb-4">
              {/* Info Box */}
              <div className="flex gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#0A0A0A] border border-slate-100 dark:border-white/5">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-white/5 flex items-center justify-center shrink-0 shadow-sm border border-transparent dark:border-white/5">
                  <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                  <Trans i18nKey="searchFormWarning" components={{ 1: <span className="font-semibold text-slate-900 dark:text-slate-200" /> }} />
                </p>
              </div>
            </div>
            }
          </div>
        </div>

        {/* Right Panel */}
        {/* Right Panel - Decision */}
        <div id="inside-personnel" className="bg-white dark:bg-[#080808] border border-slate-200 dark:border-white/5 rounded-2xl p-5 flex flex-col shadow-sm scroll-mt-6">

          {/* Seçili personel yoksa */}

          {/* Default State: Inside List, Active State: Person Details */}
          {/* Always Show Inside List */}
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                  {t('insideTitle')} <span className="text-slate-500 dark:text-slate-400">({insideList.length})</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('insideSubtitle')}
                </div>
              </div>
              <button
                onClick={() => fetchInside({ silent: false })}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors text-xs font-semibold"
              >
                {t('refresh')}
              </button>
            </div>

            {insideLoading ? (
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#0A0A0A] text-sm text-slate-500 dark:text-slate-400 italic text-center">
                {t('loading')}
              </div>
            ) : insideList.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-sm text-slate-400 dark:text-slate-500 text-center flex flex-col items-center gap-2">
                <DoorOpen className="w-8 h-8 opacity-20" />
                {t('noOneInside')}
              </div>
            ) : (
              <div
                ref={insideScrollRef}
                className="space-y-3 flex-1 overflow-y-auto pr-1"
              >
                {insideList.map((x) => {
                  const start = x.last_ts || Date.now();
                  const durMs = Date.now() - start;
                  const durText = formatDuration(durMs, t);
                  const locationText = x.gate_label && t(x.gate) ? t(x.gate) : (x.gate_label || x.gate || t('mainGate'));

                  return (
                    <div
                      key={x.personnel_id}
                      className="bg-slate-50 dark:bg-[#0A0A0A] rounded-xl border border-slate-100 dark:border-white/5 transition-all px-4 py-3 group hover:border-slate-200"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {x.full_name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {t('personnelInside')}
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <span className="truncate max-w-[100px]">{locationText}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1.5 tabular-nums">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="font-medium">{t('duration') || 'Süre'}:</span>
                          </div>
                          <div className="font-black text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums text-sm text-right tracking-tight">
                            {durText}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSelectPerson({ id: x.personnel_id, ...x })}
                          className="flex-1 h-10 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          <div className="w-6 h-6 rounded-full bg-white dark:bg-indigo-900/50 flex items-center justify-center shadow-sm group-hover/btn:scale-110 transition-transform">
                            <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          {t('view')}
                        </button>

                        <button
                          onClick={() => handleQuickExit(x)}
                          disabled={entryLoading}
                          className="flex-1 h-10 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          <div className="w-6 h-6 rounded-full bg-white dark:bg-rose-900/50 flex items-center justify-center shadow-sm group-hover/btn:scale-110 transition-transform">
                            <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          </div>
                          {t('makeExit') || 'Çıkış Yap'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <span className="hidden">{nowTick}</span>
              </div>
            )}
          </div>

          {/* DETAILS MODAL */}
          {personDetail && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white dark:bg-[#080808] w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/5 animate-in zoom-in-95 duration-200
                max-h-[85vh] flex flex-col relative">

                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-[#0A0A0A] relative z-10">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-500" />
                    {t('personnelInfo')}
                  </h3>
                  <button
                    onClick={() => setPersonDetail(null)}
                    className="relative z-50 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group cursor-pointer active:scale-95"
                  >
                    <XCircle className="w-8 h-8 text-slate-300 dark:text-white/20 group-hover:text-slate-500 dark:group-hover:text-white/40 transition-colors" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">

                  {/* Person Header */}
                  <div className="flex items-center gap-4 mb-6">
                    {safePersonnel.photo_url ? (
                      <img
                        src={safePersonnel.photo_url}
                        alt={safePersonnel.full_name}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 dark:border-white/10 shadow-sm"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center border-2 border-slate-100 dark:border-white/5 shadow-sm">
                        <User className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                        {safePersonnel.full_name || '-'}
                      </h2>
                      <p className="text-base text-slate-600 dark:text-slate-400 truncate font-medium">
                        {safePersonnel.company || '-'}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5 font-mono">
                        {safePersonnel.tc_number || ''}
                      </p>
                    </div>
                  </div>

                  {/* Entry/Exit Buttons */}
                  <div className="flex gap-3 mb-6">
                    <button
                      onClick={() => submitEntry('IN')}
                      disabled={entryLoading || !canEnter()}
                      className={`flex-1 h-14 px-4 rounded-xl text-base font-bold transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 ${canEnter()
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                        : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-600 cursor-not-allowed border border-transparent dark:border-white/5'
                        }`}
                    >
                      <DoorOpen className="w-5 h-5" />
                      {t('allowEntry')}
                    </button>

                    <button
                      onClick={() => submitEntry('OUT')}
                      disabled={entryLoading || !canExit()}
                      className={`flex-1 h-14 px-4 rounded-xl text-base font-bold transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 ${canExit()
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                        : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-600 cursor-not-allowed border border-transparent dark:border-white/5'
                        }`}
                    >
                      <DoorClosed className="w-5 h-5" />
                      {t('allowExit')}
                    </button>
                  </div>

                  {/* Recent activity summary */}
                  <div className="grid grid-cols-2 gap-2.5 mb-6">
                    {[
                      {
                        icon: LogIn,
                        label: t('lastEntryDate'),
                        value: formatDateTime(activitySummary.last_entry_at),
                        color: 'text-emerald-600 dark:text-emerald-400',
                      },
                      {
                        icon: LogOut,
                        label: t('lastExitDate'),
                        value: formatDateTime(activitySummary.last_exit_at),
                        color: 'text-rose-600 dark:text-rose-400',
                      },
                      {
                        icon: Clock,
                        label: t('todayInsideDuration'),
                        value: formatDuration((activitySummary.today_inside_seconds || 0) * 1000, t),
                        color: 'text-blue-600 dark:text-blue-400',
                      },
                      {
                        icon: MapPin,
                        label: t('lastUsedGate'),
                        value: gateName(activitySummary.last_gate),
                        color: 'text-amber-600 dark:text-amber-400',
                      },
                    ].map(({ icon: Icon, label, value, color }) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                        </div>
                        <p className="text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Time Inside Info (Only if Inside) */}
                  {isInside && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 mb-1">
                          {t('insideTime') || 'İçeride Geçen Süre'}
                        </p>
                        <p className="text-xl font-black text-blue-900 dark:text-blue-100 tabular-nums tracking-tight">
                          {insideList.find(x => String(x.personnel_id) === String(safePersonnel.id))
                            ? formatDuration(Date.now() - (insideList.find(x => String(x.personnel_id) === String(safePersonnel.id))?.last_ts || Date.now()), t)
                            : '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">
                          {t('entryTime') || 'Giriş Saati'}
                        </p>
                        <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums bg-white dark:bg-[#0A0A0A] px-3 py-1 rounded-lg border border-slate-100 dark:border-white/5 shadow-sm">
                          {insideList.find(x => String(x.personnel_id) === String(safePersonnel.id))?.last_ts
                            ? new Date(insideList.find(x => String(x.personnel_id) === String(safePersonnel.id)).last_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Status Display */}
                  <div className={`flex flex-col items-center justify-center py-5 mb-6 rounded-xl border-2 ${
                    personDetail.overall_status === 'red'
                      ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/60'
                      : personDetail.overall_status === 'yellow'
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/60'
                        : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60'
                  }`}>
                    <StatusBadge status={personDetail.overall_status} size="lg" />
                    <p
                      className={`mt-3 text-base font-bold ${personDetail.overall_status === 'red'
                        ? 'text-red-600 dark:text-red-400'
                        : personDetail.overall_status === 'yellow'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                    >
                      {getStatusMessage()}
                    </p>
                    {restrictionReasons.length > 0 && (
                      <div className="mt-3 w-full space-y-2 px-4">
                        {restrictionReasons.map((reason, index) => (
                          <div
                            key={`${reason.code}-${index}`}
                            className="flex items-start gap-2 rounded-lg border border-red-200 bg-white/80 px-3 py-2 text-left text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{restrictionReasonText(reason)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(safePersonnel.assignment_start || safePersonnel.assignment_end) && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">
                        {t('assignmentDuration')}: {safePersonnel.assignment_start && new Date(safePersonnel.assignment_start).toLocaleDateString('tr-TR')} - {safePersonnel.assignment_end && new Date(safePersonnel.assignment_end).toLocaleDateString('tr-TR')}
                      </div>
                    )}
                  </div>

                  {/* Documents */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 uppercase tracking-tight flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      {t('documents')}
                    </h3>
                    <div className="space-y-2">
                      {safeDocs.length === 0 ? (
                        <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0A0A] text-center shadow-inner">
                          <p className="text-slate-500 text-sm italic">{t('noDocuments')}</p>
                        </div>
                      ) : (
                        safeDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-between group hover:border-slate-300 dark:hover:border-white/10 transition-colors shadow-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {i18n.language === 'tr' ? doc?.document_type?.name_tr : doc?.document_type?.name_en}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                {doc?.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('tr-TR') : '-'}
                                {typeof doc?.days_until_expiry === 'number' && doc.days_until_expiry >= 0 && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${doc.days_until_expiry < 30 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-200 text-slate-600 dark:bg-white/5 dark:text-slate-400'}`}>
                                    {doc.days_until_expiry} {t('daysLeft')}
                                  </span>
                                )}
                                {typeof doc?.days_until_expiry === 'number' && doc.days_until_expiry < 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                    {t('expired')}
                                  </span>
                                )}
                              </p>
                            </div>
                            <StatusBadge status={doc?.status} size="sm" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        </div >
      </div >
    </div >
  );
};

export default SecurityCheck;
