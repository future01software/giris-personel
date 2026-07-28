import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import { Plus, Trash2, Eye, Upload, Download, Search, X, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton';
import axios from 'axios';
import { isLocalPreviewHost, LOCAL_DEMO_PERSONNEL } from '../utils/localPreviewData';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const getStatusFromUrl = (search) => {
  const sp = new URLSearchParams(search);
  const s = (sp.get('status') || 'all').toLowerCase();
  return s === 'can' || s === 'cannot' || s === 'all' ? s : 'all';
};

// ✅ Row Component for Memoization
const PersonnelRow = React.memo(({ person, isSelected, onToggle, onNavigate, onDelete, t, i18n }) => {
  return (
    <tr className="hover:bg-slate-50/30 dark:hover:bg-white/5 transition-colors group">
      <td className="px-6 py-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(person.id)}
          className="w-5 h-5 rounded-lg accent-blue-600 border-slate-200 dark:border-white/10 shadow-soft"
        />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-white/5 text-slate-900 dark:text-white flex items-center justify-center font-bold text-xs shadow-soft border border-slate-100 dark:border-white/5">
            {person.full_name?.charAt(0) || 'P'}
          </div>
          <span className="font-bold text-slate-900 dark:text-white tracking-tight text-sm">{person.full_name}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs font-semibold tracking-tight">
        {person.tc_number}
      </td>
      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs font-semibold tracking-tight">
        {person.company}
      </td>
      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs font-semibold tracking-tight">
        {person.phone || '-'}
      </td>
      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs font-semibold tracking-tight">
        {person.license_plate || '-'}
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => onNavigate(person.id)}
            className="p-2.5 bg-white dark:bg-white/10 rounded-xl shadow-soft border border-slate-100 dark:border-white/10 transition-all hover:scale-110 active:scale-90"
          >
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300 stroke-[2.1]" />
          </button>
          <button
            onClick={() => onDelete(person.id)}
            className="p-2.5 bg-rose-50 dark:bg-rose-950/20 rounded-xl shadow-soft transition-all hover:scale-110 active:scale-90 border border-transparent dark:border-rose-500/10"
          >
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[2.1]" />
          </button>
        </div>
      </td>
    </tr>
  );
});

const Personnel = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [personnel, setPersonnel] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [importing, setImporting] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fileInputRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState(() => getStatusFromUrl(location.search));

  useEffect(() => {
    const next = getStatusFromUrl(location.search);
    setStatusFilter(next);
    setPage(1);
  }, [location.search]);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const [allCompanies, setAllCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);

  const searchInputRef = useRef(null);
  const searchWasFocusedRef = useRef(false);

  useEffect(() => {
    if (isLocalPreviewHost()) {
      setAllCompanies([LOCAL_DEMO_PERSONNEL.company]);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${API}/personnel/companies`);
        setAllCompanies(res.data.companies || []);
      } catch (e) {
        console.error('Failed to load companies', e);
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (initialLoading) setInitialLoading(true);
    else setIsFetching(true);

    try {
      if (isLocalPreviewHost()) {
        setPersonnel([LOCAL_DEMO_PERSONNEL]);
        setTotalPages(1);
        setTotal(1);
        return;
      }
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (debouncedQuery && debouncedQuery.trim()) params.set('search', debouncedQuery.trim());
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      // ✅ EKLE
      if (companyFilter) params.set('company', companyFilter);

      const response = await axios.get(`${API}/personnel?${params.toString()}`);
      setPersonnel(response.data.data || []);
      setTotalPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch personnel:', error);
      toast.error(t('personnelLoadFailed'));
    } finally {
      setInitialLoading(false);
      setIsFetching(false);
    }
  }, [page, debouncedQuery, initialLoading, statusFilter, companyFilter, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    if (searchWasFocusedRef.current) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [personnel]);

  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const visiblePersonnel = useMemo(() => {
    let list = [...(personnel || [])];

    const getCanEnter = (p) => {
      const v =
        p?.can_enter ??
        p?.canEnter ??
        p?.can_entry ??
        p?.entry_allowed ??
        p?.is_allowed ??
        p?.allowed;

      if (v === true) return true;
      if (v === false) return false;
      if (v === 1 || v === '1' || v === 'true' || v === 'True') return true;
      if (v === 0 || v === '0' || v === 'false' || v === 'False') return false;

      return undefined;
    };

    if (statusFilter === 'can') list = list.filter((p) => getCanEnter(p) === true);
    if (statusFilter === 'cannot') list = list.filter((p) => getCanEnter(p) === false);

    if (companyFilter) list = list.filter((p) => (p.company || '') === companyFilter);
    if (onlySelected) list = list.filter((p) => selectedIds.has(p.id));

    return list;
  }, [personnel, companyFilter, onlySelected, selectedIds, statusFilter]);

  const allVisibleSelected =
    visiblePersonnel.length > 0 && visiblePersonnel.every((p) => selectedIds.has(p.id));

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = visiblePersonnel.every((p) => next.has(p.id));

      if (allSelected) visiblePersonnel.forEach((p) => next.delete(p.id));
      else visiblePersonnel.forEach((p) => next.add(p.id));

      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectedCount = selectedIds.size;

  const clearFilters = () => {
    setCompanyFilter('');
    setOnlySelected(false);
    setQuery('');
    setStatusFilter('all');
    navigate('/personnel?status=all', { replace: true });
  };

  const setStatusAndUrl = (s) => {
    const next = s === 'can' || s === 'cannot' || s === 'all' ? s : 'all';
    setStatusFilter(next);
    setPage(1);
    navigate(`/personnel?status=${next}`, { replace: true });
  };

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm(t('areYouSure'))) return;
    try {
      await axios.delete(`${API}/personnel/${id}`);
      toast.success(t('personnelDeleted'));

      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      fetchData();
    } catch (error) {
      toast.error(t('personnelDeleteFailed'));
    }
  }, [t, fetchData]);

  const handleNavigate = useCallback((id) => {
    navigate(`/personnel/${id}`);
  }, [navigate]);

  const handleBulkDelete = async (ids) => {
    if (!ids || ids.length === 0) return;
    try {
      const res = await axios.post(`${API}/personnel/bulk-delete`, { ids });
      toast.success(t('bulkDeleteSuccess', { count: res.data.deleted_count ?? ids.length }));
      clearSelection();
      setConfirmOpen(false);
      setConfirmText('');
      fetchData();
    } catch (error) {
      toast.error(t('bulkDeleteFailed'));
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/personnel/bulk-import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(t('importSuccess', {
        imported: response.data.imported,
        skipped: response.data.skipped
      }));

      if (response.data.errors?.length > 0) {
        console.error('Import errors:', response.data.errors);
        toast.warning(t('importWarning', { count: response.data.errors.length }));
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('importFailed'));
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/documents/types`);
      const docTypes = response.data;

      const headers = [t('fullName'), t('company'), t('assignmentStart'), t('assignmentEnd')];
      docTypes.forEach((type) => {
        headers.push(i18n.language === 'tr' ? type.name_tr : type.name_en);
      });

      const sampleRow1 = ['Ahmet Yılmaz', 'ABC İnşaat', '2025-01-01', '2025-12-31'];
      const sampleRow2 = ['Mehmet Demir', 'XYZ İnşaat', '', ''];

      docTypes.forEach(() => {
        sampleRow1.push('2026-06-01');
        sampleRow2.push('');
      });

      // Excel'in Türkçe/Avrupa versiyonlarında CSV ayırıcısı noktalı virgül (;) olmalıdır.
      let csv = headers.join(';') + '\n';
      csv += sampleRow1.join(';') + '\n';
      csv += sampleRow2.join(';') + '\n';

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'personel_import_sablonu.csv';
      link.click();
      toast.success(t('templateDownloaded'));
    } catch (error) {
      toast.error(t('templateDownloadFailed'));
    }
  };

  if (initialLoading) {
    return (
      //      <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-24 rounded-2xl" />
        <div className="space-y-2">
          {Array(10).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
      //      </Layout>
    );
  }

  return (
    //    <Layout>
    <div className="space-y-4">
      {/* Header - Dashboard Style */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">
          {t('personnel')}
        </h1>
      </div>

      {/* Premium Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 1. Manual Add Card */}
        <button
          onClick={() => navigate('/personnel/add')}
          className="group relative overflow-hidden rounded-[2.5rem] p-6 text-left transition-all duration-300 shadow-soft hover:shadow-premium active:scale-[0.98] bg-[#F5F3FF] dark:bg-[#080808] border border-transparent dark:border-white/5"
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/5 group-hover:scale-110 transition-transform duration-300">
              <Plus className="w-7 h-7 stroke-[2.5] text-[#7C3AED]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight text-[#4C1D95] dark:text-purple-400">
                  {t('manualAdd')}
                </span>
                <span className="text-sm font-medium opacity-60 text-[#4C1D95] dark:text-purple-400">
                  {t('singleEntryDesc')}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform text-[#4C1D95] dark:text-purple-400" />
          </div>
        </button>

        {/* 2. Excel Import Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] p-6 transition-all duration-300 shadow-soft hover:shadow-premium group bg-[#F0FDF4] dark:bg-[#080808] border border-transparent dark:border-white/5">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/5 group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-7 h-7 stroke-[2.5] text-[#10B981]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold tracking-tight text-[#065F46] dark:text-emerald-400">
                    {t('bulkImportExcel')}
                  </span>
                  <button
                    onClick={downloadTemplate}
                    className="text-[10px] font-bold tracking-wider uppercase opacity-60 hover:opacity-100 transition-colors text-[#065F46] dark:text-emerald-400"
                  >
                    {t('downloadTemplate')}
                  </button>
                </div>
                <span className="text-sm font-medium opacity-60 text-[#065F46] dark:text-emerald-400">
                  Excel (.xlsx, .csv)
                </span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 bg-white shadow-md text-[#10B981] disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3. Bulk Actions & Tools */}
        <div className="relative overflow-hidden rounded-[2.5rem] p-6 transition-all duration-300 shadow-soft bg-[#FEF2F2] dark:bg-[#080808] border border-transparent dark:border-white/5">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/5">
              <Trash2 className="w-7 h-7 stroke-[2.5] text-[#EF4444]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight text-[#991B1B] dark:text-red-400">
                  {selectedCount > 0 ? `${selectedCount} ${t('selected')}` : t('bulkActions')}
                </span>
                <span className="text-sm font-medium opacity-60 text-[#991B1B] dark:text-red-400">
                  {t('bulkActionHint')}
                </span>
              </div>
            </div>
            {selectedCount > 0 && (
              <button
                onClick={() => {
                  setConfirmMode('selected');
                  setConfirmOpen(true);
                  setConfirmText('');
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 bg-white shadow-md text-[#EF4444]"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white dark:bg-[#080808] border border-slate-100/50 dark:border-white/5 rounded-[2rem] p-6 shadow-soft mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 items-center">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusAndUrl(e.target.value)}
            className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 appearance-none uppercase tracking-wider"
          >
            <option value="all">{t('allPersonnel')}</option>
            <option value="can">{t('canEnterFilter')}</option>
            <option value="cannot">{t('cannotEnterFilter')}</option>
          </select>

          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 stroke-[2.1]" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchNameTcCompany')}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 shadow-inner"
            />
          </div>

          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 appearance-none uppercase tracking-wider"
          >
            <option value="">{t('allCompanies')}</option>
            {allCompanies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Only Selected Checkbox */}
          <label className="flex items-center gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none uppercase tracking-wider">
            <input
              type="checkbox"
              checked={onlySelected}
              onChange={(e) => setOnlySelected(e.target.checked)}
              className="w-5 h-5 rounded-lg accent-blue-600 shadow-soft"
            />
            {t('onlySelected')}
          </label>

          {/* Counter */}
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-end uppercase tracking-wider">
            {total} {t('personnel')}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#080808] border border-slate-100/50 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50 dark:border-white/5">
                <th className="px-6 py-5 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="w-5 h-5 rounded-lg accent-blue-600 shadow-soft"
                  />
                </th>
                <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('fullName')}
                </th>
                <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('tcNumber')}
                </th>
                <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('company')}
                </th>
                <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('phone')}
                </th>
                <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('licensePlate')}
                </th>
                <th className="px-6 py-5 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>



            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {visiblePersonnel.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    {isFetching ? t('loading') : t('noResultsFound')}
                  </td>
                </tr>
              ) : (
                visiblePersonnel.map((person) => (
                  <PersonnelRow
                    key={person.id}
                    person={person}
                    isSelected={selectedIds.has(person.id)}
                    onToggle={toggleOne}
                    onNavigate={handleNavigate}
                    onDelete={handleDelete}
                    t={t}
                    i18n={i18n}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-[#1A1C1E] flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {t('totalPersonnelCount', { count: total })}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-white/10 rounded hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('previous')}
              </button>

              <span className="text-sm text-slate-600 dark:text-slate-300 px-2">
                {t('pageOf', { current: page, total: totalPages })}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-white/10 rounded hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {
        confirmOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#080808] rounded-lg w-full max-w-md p-6 border border-slate-200 dark:border-white/10 shadow-xl mx-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                {confirmMode === 'selected' ? t('deleteSelectedTitle') : t('deletePageItemsTitle')}
              </h2>

              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                {t('deleteConfirmMessage')} <strong>{t('deleteKeyword')}</strong> {t('typeToConfirm')}
              </p>

              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t('deleteKeyword')}
                className="w-full px-3 py-2 bg-white dark:bg-[#0F0F0F] border border-slate-200 dark:border-[#2A2D30] rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 mb-4"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmText('');
                  }}
                  className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-md text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  {t('cancelAction')}
                </button>

                <button
                  disabled={confirmText.trim().toUpperCase() !== t('deleteKeyword').toUpperCase()}
                  onClick={() => {
                    const ids =
                      confirmMode === 'selected'
                        ? Array.from(selectedIds)
                        : visiblePersonnel.map((p) => p.id);
                    handleBulkDelete(ids);
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('deleteButton')}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
    //    </Layout>
  );
};

export default Personnel;
