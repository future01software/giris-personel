import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import { Plus, Trash2, Eye, Upload, Download, Search, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { toTurkishUpperCase } from '../utils/textHelpers';
import { Skeleton } from '../components/ui/Skeleton';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(person.id)}
          className="w-4 h-4 rounded accent-slate-900"
        />
      </td>
      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
        {person.full_name}
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
        {person.tc_number}
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
        {person.company}
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
        {person.phone || '-'}
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
        {person.license_plate || '-'}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onNavigate(person.id)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
          >
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={() => onDelete(person.id)}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
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

      let csv = headers.join(',') + '\n';
      csv += sampleRow1.join(',') + '\n';
      csv += sampleRow2.join(',') + '\n';

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
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-normal">
          {i18n.language === 'tr' ? toTurkishUpperCase(t('personnel')) : t('personnel')}
        </h1>
      </div>

      {/* Premium Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 1. Manual Add Card */}
        <button
          onClick={() => navigate('/personnel/add')}
          className="group relative overflow-hidden rounded-2xl premium-gradient p-1 text-left transition-all hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-1"
        >
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl h-full flex flex-col justify-between relative z-10">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-white text-white group-hover:text-blue-600 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{t('manualAdd')}</h3>
              <p className="text-blue-100 text-xs mt-1 opacity-80">{t('singleEntryDesc')}</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none group-hover:bg-white/20 transition-colors" />
        </button>

        {/* 2. Excel Import Card */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between hover:border-blue-500/30 transition-colors group relative">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <button
              onClick={downloadTemplate}
              className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md"
            >
              <Download className="w-3 h-3" />
              {t('downloadTemplate')}
            </button>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{t('bulkImportExcel')}</h3>

            <div className="flex gap-2 mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex-1 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                {importing ? t('uploading') : t('selectAndUploadFile')}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Bulk Actions & Tools */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2 justify-center">
          {(visiblePersonnel.length > 0 || selectedCount > 0) ? (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setConfirmMode('selected');
                    setConfirmOpen(true);
                    setConfirmText('');
                  }}
                  disabled={selectedCount === 0}
                  className="flex-1 py-2 px-3 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('deleteSelectedCount', { count: selectedCount })}
                </button>

                <button
                  onClick={clearSelection}
                  disabled={selectedCount === 0}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  {t('clearSelection')}
                </button>
              </div>

              <button
                onClick={() => {
                  setConfirmMode('visible');
                  setConfirmOpen(true);
                  setConfirmText('');
                }}
                className="w-full py-2 px-3 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {t('deletePageAll', { count: visiblePersonnel.length })}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
              <p>{t('bulkActionHint')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusAndUrl(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">{t('allPersonnel')}</option>
            <option value="can">{t('canEnterFilter')}</option>
            <option value="cannot">{t('cannotEnterFilter')}</option>
          </select>

          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              value={query}
              onFocus={() => (searchWasFocusedRef.current = true)}
              onBlur={() => (searchWasFocusedRef.current = false)}
              onChange={(e) => {
                searchWasFocusedRef.current = document.activeElement === searchInputRef.current;
                setQuery(e.target.value);
              }}
              placeholder={t('searchNameTcCompany')}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">{t('allCompanies')}</option>
            {allCompanies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Only Selected Checkbox */}
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={onlySelected}
              onChange={(e) => setOnlySelected(e.target.checked)}
              className="w-4 h-4 rounded accent-slate-900"
            />
            {t('onlySelected')}
          </label>

          {/* Counter */}
          <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center">
            {t('totalLabel')}: <strong className="mx-1">{total}</strong> / {t('visibleLabel')}: <strong className="mx-1">{visiblePersonnel.length}</strong>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="w-4 h-4 rounded accent-slate-900"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  {i18n.language === 'tr' ? toTurkishUpperCase(t('fullName')) : t('fullName')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  {i18n.language === 'tr' ? toTurkishUpperCase(t('tcNumber')) : t('tcNumber')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  {i18n.language === 'tr' ? toTurkishUpperCase(t('company')) : t('company')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  {i18n.language === 'tr' ? toTurkishUpperCase(t('phone')) : t('phone')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  {i18n.language === 'tr' ? toTurkishUpperCase(t('licensePlate')) : t('licensePlate')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  {i18n.language === 'tr' ? toTurkishUpperCase(t('actions')) : t('actions')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
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
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {t('totalPersonnelCount', { count: total })}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('previous')}
              </button>

              <span className="text-sm text-slate-600 dark:text-slate-300 px-2">
                {t('pageOf', { current: page, total: totalPages })}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md p-6 border border-slate-200 dark:border-slate-700 shadow-xl mx-4">
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
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText('');
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
      )}
    </div>
    //    </Layout>
  );
};

export default Personnel;
