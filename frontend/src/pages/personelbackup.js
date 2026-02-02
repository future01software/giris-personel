
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import { Plus, Trash2, Eye, Upload, Download, Search, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const CTRL =
  "h-[42px] min-h-[42px] text-[14px] leading-[20px] px-3 flex items-center";

const CTRL_BTN =
  "h-[42px] min-h-[42px] text-[14px] leading-[20px] px-3 inline-flex items-center justify-center";


const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Debounce hook
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

const Personnel = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [personnel, setPersonnel] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true); // only first load
  const [isFetching, setIsFetching] = useState(false); // for search/pagination
  const [importing, setImporting] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fileInputRef = useRef(null);

  // ✅ Dashboard’dan gelen filtre: all | can | cannot
  const [statusFilter, setStatusFilter] = useState(() => getStatusFromUrl(location.search));

  // URL değişirse (Dashboard tıklandı vs.) statusFilter güncelle
  useEffect(() => {
    const next = getStatusFromUrl(location.search);
    setStatusFilter(next);
    setPage(1);
  }, [location.search]);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState(null); // "selected" | "visible"
  const [confirmText, setConfirmText] = useState('');

  // Search + Filters
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const [allCompanies, setAllCompanies] = useState([]); // ✅ all DB companies
  const [companyFilter, setCompanyFilter] = useState(''); // '' = all
  const [onlySelected, setOnlySelected] = useState(false);

  // Focus keep
  const searchInputRef = useRef(null);
  const searchWasFocusedRef = useRef(false);

  // ✅ load companies once
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

      // ✅ Backend destekliyorsa server-side filtre de uygula (desteklemiyorsa problem değil)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter); // can | cannot

      const response = await axios.get(`${API}/personnel?${params.toString()}`);
      setPersonnel(response.data.data || []);
      setTotalPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch personnel:', error);
      toast.error('Failed to load personnel');
    } finally {
      setInitialLoading(false);
      setIsFetching(false);
    }
  }, [page, debouncedQuery, initialLoading, statusFilter]);

  // Fetch on page/search/status
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search changes -> reset page only
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  // Restore focus after refresh
  useEffect(() => {
    if (searchWasFocusedRef.current) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [personnel]);

  // Selection helpers
  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  
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
    // statusFilter’ı da temizlemek istersen all yapıp URL’i düzeltelim:
    setStatusFilter('all');
    navigate('/personnel?status=all', { replace: true });
  };

  const setStatusAndUrl = (s) => {
    const next = s === 'can' || s === 'cannot' || s === 'all' ? s : 'all';
    setStatusFilter(next);
    setPage(1);
    navigate(`/personnel?status=${next}`, { replace: true });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('areYouSure') || 'Are you sure?')) return;
    try {
      await axios.delete(`${API}/personnel/${id}`);
      toast.success('Personnel deleted');

      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      fetchData();
    } catch (error) {
      toast.error('Failed to delete personnel');
    }
  };

  const handleBulkDelete = async (ids) => {
    if (!ids || ids.length === 0) return;
    try {
      const res = await axios.post(`${API}/personnel/bulk-delete`, { ids });
      toast.success(`✅ ${res.data.deleted_count ?? ids.length} kayıt silindi`);
      clearSelection();
      setConfirmOpen(false);
      setConfirmText('');
      fetchData();
    } catch (error) {
      toast.error('Toplu silme başarısız');
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

      toast.success(`✅ ${response.data.imported} personel eklendi, ${response.data.skipped} atlandı`);
      if (response.data.errors?.length > 0) {
        console.error('Import errors:', response.data.errors);
        toast.warning(`⚠️ ${response.data.errors.length} hata oluştu. Console'a bakın.`);
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Excel import failed');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/documents/types`);
      const docTypes = response.data;

      const headers = ['Ad Soyad', 'Şirket', 'Görev Başlangıç', 'Görev Bitiş'];
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
      toast.success('Şablon indirildi');
    } catch (error) {
      toast.error('Şablon indirilemedi');
    }
  };

  if (initialLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-slate-600 dark:text-slate-300">{t('loading')}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
{/* Header */}
<div className="flex flex-wrap justify-between items-center gap-3">
  {/* Sol: Başlık + aktif filtre etiketi */}
  <div className="flex items-center gap-3">
    <h1
      className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight"
      style={{ fontFamily: 'Oswald, sans-serif' }}
    >
      {t('personnel')}
    </h1>

    {/* ✅ aktif filtre etiketi (büyütüldü + ortalandı) */}
    <span className="text-sm px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white/5">
      {statusFilter === 'all' ? 'Hepsi' : statusFilter === 'can' ? 'Girebilecek' : 'Giremeyecek'}
    </span>
  </div>

  {/* Sağ: Aksiyon butonları (hepsi aynı yükseklik/hiza) */}
  <div className="flex flex-wrap items-center justify-end gap-2">
    <Button
      variant="destructive"
      disabled={selectedCount === 0}
      onClick={() => {
        setConfirmMode('selected');
        setConfirmOpen(true);
        setConfirmText('');
      }}
      className={`${CTRL_BTN} gap-2`}
      data-testid="bulk-delete-selected"
    >
      <Trash2 className="w-4 h-4" />
      Seçilenleri Sil ({selectedCount})
    </Button>

    <Button
      variant="destructive"
      disabled={visiblePersonnel.length === 0}
      onClick={() => {
        setConfirmMode('visible');
        setConfirmOpen(true);
        setConfirmText('');
      }}
      className={`${CTRL_BTN} gap-2`}
      data-testid="bulk-delete-visible"
    >
      <Trash2 className="w-4 h-4" />
      Sayfadakileri Sil ({visiblePersonnel.length})
    </Button>

    <Button
      variant="outline"
      disabled={selectedCount === 0}
      onClick={clearSelection}
      className={`${CTRL_BTN} dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
      data-testid="clear-selection"
    >
      Seçimi Temizle
    </Button>

    <Button
      variant="outline"
      onClick={downloadTemplate}
      className={`${CTRL_BTN} gap-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
      data-testid="download-template-button"
    >
      <Download className="w-4 h-4" />
      {t('downloadTemplate')}
    </Button>

    <input
      ref={fileInputRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      onChange={handleFileUpload}
      style={{ display: 'none' }}
    />

    <Button
      variant="outline"
      onClick={() => fileInputRef.current?.click()}
      disabled={importing}
      className={`${CTRL_BTN} gap-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
      data-testid="import-excel-button"
    >
      <Upload className="w-4 h-4" />
      {importing ? t('loading') : t('bulkImportExcel')}
    </Button>

    <Button
      onClick={() => navigate('/personnel/add')}
      className={`${CTRL_BTN} gap-2 bg-slate-900 hover:bg-slate-800 text-white uppercase tracking-wide dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100`}
      data-testid="add-personnel-button"
    >
      <Plus className="w-4 h-4" />
      {t('manualAdd')}
    </Button>
  </div>
</div>


{/* Search + Filters */}
<div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
  <div className="flex flex-wrap items-start gap-3">
    {/* ✅ DURUM filtresi */}
    <div className="min-w-[200px]">
      <select
        value={statusFilter}
        onChange={(e) => setStatusAndUrl(e.target.value)}
        className={`w-full ${CTRL} rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100`}
      >
        <option value="all">Hepsi</option>
        <option value="can">Girebilecek</option>
        <option value="cannot">Giremeyecek</option>
      </select>
      <div className="text-[11px] mt-1 text-slate-500 dark:text-slate-400">
        Dashboard tıklamasıyla otomatik gelir
      </div>
    </div>

    {/* ✅ Arama */}
    <div className="flex-1 min-w-[260px] relative">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <Input
        ref={searchInputRef}
        value={query}
        onFocus={() => (searchWasFocusedRef.current = true)}
        onBlur={() => (searchWasFocusedRef.current = false)}
        onChange={(e) => {
          searchWasFocusedRef.current = document.activeElement === searchInputRef.current;
          setQuery(e.target.value);
        }}
        placeholder="Ara: Ad, TC, Şirket..."
        className={`${CTRL} pl-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100`}
      />
      {isFetching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          {t('loading')}
        </div>
      )}
    </div>

    {/* ✅ Şirket filtresi */}
    <div className="min-w-[240px]">
      <select
        value={companyFilter}
        onChange={(e) => setCompanyFilter(e.target.value)}
        className={`w-full ${CTRL} rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100`}
      >
        <option value="">Tüm Şirketler</option>
        {allCompanies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="text-[11px] mt-1 text-slate-500 dark:text-slate-400">
        {allCompanies.length} şirket yüklendi
      </div>
    </div>

    {/* ✅ Checkbox aynı hizaya */}
    <label className="h-[42px] flex items-center gap-2 text-[14px] leading-[20px] text-slate-700 dark:text-slate-200 select-none">
      <input
        type="checkbox"
        checked={onlySelected}
        onChange={(e) => setOnlySelected(e.target.checked)}
        className="accent-orange-500 w-4 h-4 rounded-sm ring-1 ring-slate-300 dark:ring-slate-700"
      />
      Sadece seçilenler
    </label>

    {/* ✅ Sayaç aynı hizaya */}
    <div className="h-[42px] flex items-center text-[14px] leading-[20px] text-slate-600 dark:text-slate-300">
      Toplam: <b className="mx-1">{total}</b> / Görünen: <b className="mx-1">{visiblePersonnel.length}</b>
    </div>

    {/* ✅ Temizle butonu aynı hizaya */}
    <Button
      variant="outline"
      onClick={clearFilters}
      className={`${CTRL} gap-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
      title="Filtreleri temizle"
    >
      <X className="w-4 h-4" />
      Temizle
    </Button>
  </div>
</div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="accent-orange-500 w-4 h-4 rounded-sm ring-1 ring-slate-300 dark:ring-slate-700"
                    />
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {t('fullName')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {t('tcNumber')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {t('company')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {t('phone')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {t('licensePlate')}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {t('actions')}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visiblePersonnel.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      {isFetching ? t('loading') : t('noResults')}
                    </td>
                  </tr>
                ) : (
                  visiblePersonnel.map((person) => (
                    <tr
                      key={person.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      data-testid={`personnel-row-${person.id}`}
                    >
                      <td className="px-6 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(person.id)}
                          onChange={() => toggleOne(person.id)}
                          className="accent-orange-500 w-4 h-4 rounded-sm ring-1 ring-slate-300 dark:ring-slate-700"
                        />
                      </td>

                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {person.full_name}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{person.tc_number}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{person.company}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{person.phone || '-'}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{person.license_plate || '-'}</td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => navigate(`/personnel/${person.id}`)}
                            data-testid={`view-personnel-${person.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => handleDelete(person.id)}
                            data-testid={`delete-personnel-${person.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-rose-300" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {t('totalRecords')} {total} {t('personnel').toLowerCase()}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="prev-page-btn"
                >
                  {t('previous')}
                </Button>

                <span className="text-sm text-slate-600 dark:text-slate-300 px-3">
                  {t('page')} {page} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  className="dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  data-testid="next-page-btn"
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Modal */}
        {confirmOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-xl w-[520px] p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {confirmMode === 'selected' ? 'Seçilenleri Sil' : 'Sayfadaki Kayıtları Sil'}
              </h2>

              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                Bu işlem geri alınamaz. Devam etmek için <b>SIL</b> yaz.
              </p>

              <div className="mt-4">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="SİL"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <Button
                  variant="outline"
                  className="dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmText('');
                  }}
                >
                  Vazgeç
                </Button>

                <Button
                  variant="destructive"
                  disabled={confirmText.trim().toUpperCase() !== 'SIL'}
                  onClick={() => {
                    const ids =
                      confirmMode === 'selected'
                        ? Array.from(selectedIds)
                        : visiblePersonnel.map((p) => p.id);
                    handleBulkDelete(ids);
                  }}
                >
                  Sil
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Personnel;
