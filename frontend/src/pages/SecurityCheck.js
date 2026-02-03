// src/pages/SecurityCheck.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Search, User, DoorOpen, DoorClosed } from 'lucide-react';
// import Layout from '../components/Layout';
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

const SecurityCheck = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personDetail, setPersonDetail] = useState(null);
  const [searching, setSearching] = useState(false);

  const [entryLoading, setEntryLoading] = useState(false);
  const [isInside, setIsInside] = useState(false);

  const [selectedGate, setSelectedGate] = useState(
    () => localStorage.getItem(GATE_KEY) || 'PORT_FACILITY'
  );

  useEffect(() => {
    localStorage.setItem(GATE_KEY, selectedGate);
  }, [selectedGate]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await axios.get(`${API}/personnel/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
      if (response.data.length === 0) toast.info(t('noResults'));
    } catch (error) {
      console.error('Search failed:', error);
      toast.error(t('searchFailed') || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const normalizeAction = (log) => {
    const raw = log?.action ?? log?.type ?? log?.decision ?? log?.status ?? '';
    const v = String(raw).trim().toLowerCase();

    if (v === 'in' || v === 'entry' || v === 'enter' || v === 'entered') return 'in';
    if (v === 'out' || v === 'exit' || v === 'exited') return 'out';
    if (v === 'approved' || v === 'allow' || v === 'allowed' || v === 'accepted' || v === 'ok') return 'in';
    if (v === 'rejected' || v === 'deny' || v === 'denied' || v === 'not_ok' || v === 'no') return 'out';

    return '';
  };

  const getLogTs = (x) =>
    x?.timestamp ||
    x?.created_at ||
    x?.createdAt ||
    x?.entry_time ||
    x?.exit_time ||
    '';

  const handleSelectPerson = async (person) => {
    setSelectedPerson(person);
    try {
      const response = await axios.get(`${API}/personnel/${person.id}`);
      setPersonDetail(response.data);

      try {
        const logsRes = await axios.get(`${API}/entry/logs?limit=200`);
        const list = Array.isArray(logsRes.data)
          ? logsRes.data
          : (logsRes.data?.data || logsRes.data?.items || []);

        const pid = person.id;

        const my = list
          .filter((x) => {
            const id =
              x?.personnel_id ||
              x?.personnelId ||
              x?.person_id ||
              x?.personId ||
              x?.personnel?.id;
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
    if (personDetail.assignment_expired) return t('assignmentExpired') || 'Görev süresi dolmuş - GİRİŞ YASAK';
    if (personDetail.overall_status === 'red') return t('documentsExpired') || 'Evrakları eksik/süresi geçmiş - GİRİŞ YASAK';
    if (personDetail.overall_status === 'yellow') return t('documentsWarning') || 'Evraklar yakında süre dolacak - UYARI';
    return t('allDocumentsValid') || 'Tüm evraklar geçerli - GİRİŞ İZNİ VAR';
  };

  // ✅ green + yellow giriş alabilir, red alamaz; içerideyse tekrar giriş yok
  const canEnter = () => {
    if (!personDetail) return false;
    if (personDetail.assignment_expired) return false;
    if (isInside) return false;

    const s = String(personDetail.overall_status || '').toLowerCase();
    return s === 'green' || s === 'yellow';
  };

  // ✅ çıkış: içeride olmalı; evrak red ise çıkışa da izin verme (senin istediğin kurala göre)
  const canExit = () => {
    if (!personDetail) return false;
    if (personDetail.assignment_expired) return false;

    const s = String(personDetail.overall_status || '').toLowerCase();
    const ok = s === 'green' || s === 'yellow';
    if (!ok) return false;

    return isInside === true;
  };

  const submitEntry = async (action) => {
    const personId = personDetail?.personnel?.id || selectedPerson?.id;

    if (!personId) {
      toast.error(t('personNotFound') || 'Personel bulunamadı');
      return;
    }

    // ✅ Kontrolleri action’a göre ayır
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

      toast.success(action === 'IN' ? (t('entrySaved') || 'Giriş kaydedildi') : (t('exitSaved') || 'Çıkış kaydedildi'));
      setIsInside(action === 'IN');
    } catch (e) {
      console.error('Entry log failed:', e);
      toast.error(e?.response?.data?.detail || e?.response?.data?.message || (t('operationFailed') || 'İşlem başarısız'));
    } finally {
      setEntryLoading(false);
    }
  };

  return (
    //    <Layout>
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
          {t('entryCheck')?.toLocaleUpperCase('tr-TR') || t('entryCheck')}
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          {t('searchPersonnelToCheck')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
        {/* Left Panel - Search */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col">
          <div className="flex gap-2 mb-4">
            <input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid="entry-search-input"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-2.5 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-md hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
              data-testid="entry-search-button"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {searchResults.length === 0 && !searching ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                <Search className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm text-center">{t('searchToStart')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => handleSelectPerson(person)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedPerson?.id === person.id
                      ? 'border-slate-900 dark:border-slate-200 bg-slate-50 dark:bg-slate-700'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    data-testid={`search-result-${person.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {person.photo_url ? (
                        <img
                          src={person.photo_url}
                          alt={person.full_name}
                          className="w-10 h-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-600 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400 dark:text-slate-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate text-sm">
                          {person.full_name}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                          {person.company}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {person.tc_number}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Status Display */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col">
          {!personDetail ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <User className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm text-center">{t('selectPersonnelToViewStatus')}</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Personnel Info */}
              <div className="pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  {personDetail.personnel.photo_url ? (
                    <img
                      src={personDetail.personnel.photo_url}
                      alt={personDetail.personnel.full_name}
                      className="w-16 h-16 rounded-md object-cover border border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                      <User className="w-8 h-8 text-slate-400 dark:text-slate-300" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                      {personDetail.personnel.full_name}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                      {personDetail.personnel.company}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {personDetail.personnel.tc_number}
                    </p>
                  </div>
                </div>

                {/* Gate Selection */}
                <div className="mt-3 mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                    Saha
                  </label>
                  <select
                    value={selectedGate}
                    onChange={(e) => setSelectedGate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {GATES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Entry/Exit Buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => submitEntry('IN')}
                    disabled={entryLoading || !canEnter()}
                    className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${canEnter()
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed'
                      }`}
                    title={canEnter() ? 'Giriş ver' : isInside ? 'Personel içeride' : 'Giriş izni yok'}
                  >
                    <DoorOpen className="w-4 h-4" />
                    Giriş Ver
                  </button>

                  <button
                    onClick={() => submitEntry('OUT')}
                    disabled={entryLoading || !canExit()}
                    className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${canExit()
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed'
                      }`}
                    title={canExit() ? 'Çıkış ver' : !isInside ? 'Personel içeride değil' : 'Evrak/Görev uygun değil'}
                  >
                    <DoorClosed className="w-4 h-4" />
                    Çıkış Ver
                  </button>
                </div>

                {/* Assignment Dates */}
                {(personDetail.personnel.assignment_start || personDetail.personnel.assignment_end) && (
                  <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wider font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      Görev Süresi
                    </p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      {personDetail.personnel.assignment_start &&
                        new Date(personDetail.personnel.assignment_start).toLocaleDateString('tr-TR')}
                      {' - '}
                      {personDetail.personnel.assignment_end &&
                        new Date(personDetail.personnel.assignment_end).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Display */}
              <div className="flex-1 flex flex-col items-center justify-center py-6">
                <StatusBadge status={personDetail.overall_status} size="lg" />

                <div
                  className={`mt-4 text-center p-4 rounded-lg border-2 w-full ${personDetail.overall_status === 'red'
                    ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-900'
                    : personDetail.overall_status === 'yellow'
                      ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-900'
                      : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900'
                    }`}
                >
                  <p
                    className={`text-base font-bold uppercase ${personDetail.overall_status === 'red'
                      ? 'text-red-800 dark:text-red-200'
                      : personDetail.overall_status === 'yellow'
                        ? 'text-amber-800 dark:text-amber-200'
                        : 'text-emerald-800 dark:text-emerald-200'
                      }`}
                  >
                    {getStatusMessage()}
                  </p>
                </div>
              </div>

              {/* Documents */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 uppercase tracking-tight">
                  {t('documents')}
                </h3>

                {personDetail.documents.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-4 text-sm">
                    {t('noDocuments')}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {personDetail.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                        data-testid={`entry-doc-${doc.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">
                              {i18n.language === 'tr'
                                ? doc.document_type.name_tr
                                : doc.document_type.name_en}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                              {new Date(doc.expiry_date).toLocaleDateString('tr-TR')}
                              {doc.days_until_expiry >= 0 && (
                                <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                                  ({doc.days_until_expiry} gün)
                                </span>
                              )}
                              {doc.days_until_expiry < 0 && (
                                <span className="ml-1.5 text-red-600 dark:text-red-400 font-medium">
                                  (Süresi geçmiş)
                                </span>
                              )}
                            </p>
                          </div>
                          <StatusBadge status={doc.status} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* küçük not: user kullanımı kalsın (ileride göstermek istersen) */}
      {/* <div className="text-xs text-slate-400">Logged in: {user?.full_name}</div> */}
    </div>
    //    </Layout>
  );
};

export default SecurityCheck;
