import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { Search, User, DoorOpen, DoorClosed } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import Headline from '../components/Headline';
import { Skeleton } from '../components/ui/Skeleton';


const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GATE_KEY = 'GK_SELECTED_GATE_ADMIN'; // Different key for Admin to avoid conflict

const GATES = [
  { value: 'ADMIN_BUILDING', label: 'İdari Bina' },
  { value: 'PORT_FACILITY', label: 'Liman Tesisi' },
  { value: 'OFFDOCK1_SAYINLAR', label: 'Offdock1 Sahası (Sayınlar)' },
  { value: 'OFFDOCK2_KOMURLER', label: 'Offdock2 Sahası (Kömürler)' },
];

const EntryCheck = () => {
  const { t, i18n } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personDetail, setPersonDetail] = useState(null);
  const [searching, setSearching] = useState(false);

  // Manual Entry States
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

      if (response.data.length === 0) {
        toast.info(t('noResults'));
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error(t('logsLoadFailed', { defaultValue: 'Search failed' }));
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPerson = async (person) => {
    setSelectedPerson(person);
    try {
      const response = await axios.get(`${API}/personnel/${person.id}`);
      setPersonDetail(response.data);

      // Check current status (isInside?)
      try {
        const logsRes = await axios.get(`${API}/entry/logs?limit=200`);
        const list = Array.isArray(logsRes.data) ? logsRes.data : (logsRes.data?.data || logsRes.data?.items || []);
        const pid = person.id;

        const my = list.filter((x) => String(x.personnel_id || x.personnel?.id || '') === String(pid))
          .sort((a, b) => new Date(getLogTs(b) || 0) - new Date(getLogTs(a) || 0));

        if (my.length > 0) {
          const last = my[0];
          const a = normalizeAction(last);
          setIsInside(a === 'in');
        } else {
          setIsInside(false);
        }
      } catch (e) {
        console.warn('Could not load last entry status', e);
        setIsInside(false);
      }
    } catch (error) {
      console.error('Failed to fetch person detail:', error);
      toast.error(t('personnelLoadFailed', { defaultValue: 'Failed to load details' }));
    }
  };

  // Helper Functions
  const normalizeAction = (log) => {
    const raw = log?.action ?? log?.type ?? log?.decision ?? log?.status ?? '';
    const v = String(raw).trim().toLowerCase();
    if (['in', 'entry', 'enter', 'entered', 'approved', 'allow', 'allowed', 'ok'].includes(v)) return 'in';
    if (['out', 'exit', 'exited', 'rejected', 'deny', 'denied', 'no'].includes(v)) return 'out';
    return '';
  };

  const getLogTs = (x) => x?.timestamp || x?.created_at || x?.entry_time || x?.exit_time || '';

  const canEnter = () => {
    if (!personDetail) return false;
    if (personDetail.assignment_expired) return false;
    if (isInside) return false;
    const s = String(personDetail.overall_status || '').toLowerCase();
    return s === 'green' || s === 'yellow';
  };

  const canExit = () => {
    if (!personDetail) return false;
    // if (personDetail.assignment_expired) return false; // Exit should be allowed even if expired? Usually yes, to leave. But keeping logic same as SecurityCheck.
    const s = String(personDetail.overall_status || '').toLowerCase();
    // if (s === 'red') return false; // Similar logic
    return isInside === true;
  };

  const submitEntry = async (action) => {
    const personId = personDetail?.personnel?.id || selectedPerson?.id;
    if (!personId) return;

    if (action === 'IN' && !canEnter()) {
      toast.error(t('noEntryPermission') || 'Giriş izni yok.');
      return;
    }
    if (action === 'OUT' && !canExit()) {
      toast.error(t('cannotExit') || 'Çıkış verilemez (İçeride değil).');
      return;
    }

    setEntryLoading(true);
    try {
      await axios.post(`${API}/entry/decision`, {
        personnel_id: personId,
        decision: action,
        reason: 'Manual Admin Override',
        gate: selectedGate,
      });

      toast.success(action === 'IN' ? 'Giriş verildi' : 'Çıkış verildi');
      setIsInside(action === 'IN');
    } catch (e) {
      console.error('Entry log failed:', e);
      toast.error('İşlem başarısız');
    } finally {
      setEntryLoading(false);
    }
  };

  const getStatusMessage = () => {
    if (!personDetail) return '';

    if (personDetail.assignment_expired) return t('assignmentExpired');
    if (personDetail.overall_status === 'red') return t('documentsExpired');
    if (personDetail.overall_status === 'yellow') return t('documentsWarning');

    return t('allDocumentsValid');
  };

  return (
    //    <Layout>
    <div className="space-y-4">
      {/* Header */}

      <Headline i18nKey="entryCheck" />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100dvh-12rem)]">
        {/* Left Panel - Search */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col">
          {/* Search Bar */}
          <div className="flex gap-2 mb-4">
            <input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              data-testid="entry-search-input"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-2.5 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="entry-search-button"
              title={t('search')}
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto">
            {searching ? (
              <div className="space-y-2">
                {Array(5).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
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
                        <p className="text-xs text-slate-500 dark:text-slate-400">{person.tc_number}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Decision */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col">
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

                  <StatusBadge status={personDetail.overall_status} size="lg" />
                </div>
              </div>

              {/* Documents */}
              <div className="flex-1 overflow-y-auto py-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 uppercase tracking-tight">
                  {t('documents')}
                </h3>

                {personDetail.documents.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-6 text-sm">
                    {t('noDocuments')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {personDetail.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700"
                        data-testid={`entry-doc-${doc.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100 text-xs truncate">
                              {i18n.language === 'tr'
                                ? doc.document_type.name_tr
                                : doc.document_type.name_en}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                              {new Date(doc.expiry_date).toLocaleDateString(
                                i18n.language === 'tr' ? 'tr-TR' : 'en-US'
                              )}
                              {typeof doc.days_until_expiry === 'number' && doc.days_until_expiry >= 0 && (
                                <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                                  ({doc.days_until_expiry} {t('daysLeft')})
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

              {/* Manual Entry Controls */}
              <div className="py-4 border-t border-slate-200 dark:border-slate-700">
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                    Saha Seçimi (Simülasyon)
                  </label>
                  <select
                    value={selectedGate}
                    onChange={(e) => setSelectedGate(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {GATES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => submitEntry('IN')}
                    disabled={entryLoading || !canEnter()}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 ${canEnter()
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/30'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                      }`}
                  >
                    <DoorOpen className="w-4 h-4" />
                    Giriş Yap
                  </button>

                  <button
                    onClick={() => submitEntry('OUT')}
                    disabled={entryLoading || !canExit()}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 ${canExit()
                      ? 'bg-red-600 hover:bg-red-500 text-white hover:shadow-red-500/30'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                      }`}
                  >
                    <DoorClosed className="w-4 h-4" />
                    Çıkış Yap
                  </button>
                </div>
              </div>

              {/* Status Display */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div
                  className={`text-center p-4 rounded-lg border-2 ${personDetail.overall_status === 'red'
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-900'
                    : personDetail.overall_status === 'yellow'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900'
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
            </div>
          )}
        </div>
      </div>
    </div>
    //    </Layout>
  );
};

export default EntryCheck;
