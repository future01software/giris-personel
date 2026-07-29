import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import Headline from '../components/Headline';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, Edit, Save, X, Plus, Trash2, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import LocalizedDateInput from '../components/LocalizedDateInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { addOneYear, subtractOneYear } from '../utils/dates';
import {
  createLocalDemoDetail,
  isLocalPreviewHost,
  LOCAL_DEMO_DOCUMENT_TYPES,
  LOCAL_DEMO_PERSONNEL,
} from '../utils/localPreviewData';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');
const isLocalDemoPerson = (personnelId) => isLocalPreviewHost() && personnelId === LOCAL_DEMO_PERSONNEL.id;
const getLocalDocumentTiming = (expiryDate, warningDays = 30) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${toDateInput(expiryDate)}T00:00:00`);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  return {
    days_until_expiry: days,
    status: days < 0 ? 'expired' : days <= warningDays ? 'warning' : 'valid',
  };
};

const PersonnelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [data, setData] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [editDocumentForm, setEditDocumentForm] = useState({ expiry_date: '', notes: '' });

  const [editForm, setEditForm] = useState({
    full_name: '',
    tc_number: '',
    company: '',
    phone: '',
    license_plate: '',
    photo_url: '',
    assignment_start: '',
    assignment_end: '',
    entry_blocked: false,
    entry_block_reason: '',
  });

  const [docForm, setDocForm] = useState({
    document_type_id: '',
    expiry_date: '',
    notes: '',
  });

  const fetchWithRetry = useCallback(async (url, retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await axios.get(url, { timeout: 10000 });
        return res;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    if (isLocalDemoPerson(id)) {
      const detailData = createLocalDemoDetail();
      setData(detailData);
      setDocumentTypes(LOCAL_DEMO_DOCUMENT_TYPES);
      setEditForm({
        full_name: detailData.personnel.full_name,
        tc_number: detailData.personnel.tc_number,
        company: detailData.personnel.company,
        phone: detailData.personnel.phone,
        license_plate: detailData.personnel.license_plate,
        photo_url: '',
        assignment_start: detailData.personnel.assignment_start,
        assignment_end: detailData.personnel.assignment_end,
        entry_blocked: false,
        entry_block_reason: '',
      });
      setLoading(false);
      return;
    }

    // 1) Personel detay - bu kritik, retry ile dene
    let detailData = null;
    try {
      const detailRes = await fetchWithRetry(`${API}/personnel/${id}`);
      detailData = detailRes.data;
      setData(detailData);

      const p = detailData.personnel;
      setEditForm({
        full_name: p.full_name || '',
        tc_number: p.tc_number || '',
        company: p.company || '',
        phone: p.phone || '',
        license_plate: p.license_plate || '',
        photo_url: p.photo_url || '',
        assignment_start: p.assignment_start || '',
        assignment_end: p.assignment_end || '',
        entry_blocked: Boolean(p.entry_blocked),
        entry_block_reason: p.entry_block_reason || '',
      });
    } catch (error) {
      console.error('Failed to fetch personnel detail:', error);
      toast.error(t('failedToLoadData'));
      setData(null);
      setLoading(false);
      return;
    }

    // 2) Doküman tipleri - başarısız olursa personel yine gösterilir
    try {
      const typesRes = await fetchWithRetry(`${API}/documents/types`);
      setDocumentTypes(typesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch document types:', error);
      setDocumentTypes([]);
    }

    setLoading(false);
  }, [id, t, fetchWithRetry]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveEdit = async () => {
    try {
      await axios.put(`${API}/personnel/${id}`, editForm);
      toast.success(t('personnelUpdated'));
      setIsEditing(false);
      fetchData();
    } catch (error) {
      console.error('Update failed:', error);
      toast.error(t('updateFailed'));
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    try {
      if (isLocalDemoPerson(id)) {
        const documentType = documentTypes.find((type) => type.id === docForm.document_type_id);
        const expiryDate = addOneYear(docForm.expiry_date);
        const timing = getLocalDocumentTiming(expiryDate, documentType?.warning_days);
        setData((current) => ({
          ...current,
          documents: [
            ...current.documents,
            {
              id: `local-doc-${Date.now()}`,
              personnel_id: id,
              document_type_id: documentType.id,
              document_type: documentType,
              expiry_date: expiryDate,
              notes: docForm.notes,
              ...timing,
            },
          ],
        }));
        toast.success(t('documentAdded'));
        setIsAddDocOpen(false);
        setDocForm({ document_type_id: '', expiry_date: '', notes: '' });
        return;
      }
      await axios.post(`${API}/documents`, {
        ...docForm,
        expiry_date: addOneYear(docForm.expiry_date),
        personnel_id: id,
      });
      toast.success(t('documentAdded'));
      setIsAddDocOpen(false);
      setDocForm({ document_type_id: '', expiry_date: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Add document failed:', error);
      toast.error(t('documentAddFailed'));
    }
  };

  const getDocumentRecordKey = (doc) => `${doc.id}:${doc.personnel_id}:${doc.document_type_id}`;

  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      if (isLocalDemoPerson(id)) {
        const recordKey = getDocumentRecordKey(doc);
        setData((current) => ({
          ...current,
          documents: current.documents.filter((item) => getDocumentRecordKey(item) !== recordKey),
        }));
        toast.success(t('documentDeleted'));
        return;
      }
      await axios.delete(`${API}/documents/${doc.id}`, {
        params: {
          personnel_id: doc.personnel_id,
          document_type_id: doc.document_type_id,
        },
      });
      toast.success(t('documentDeleted'));
      fetchData();
    } catch (error) {
      console.error('Delete document failed:', error);
      toast.error(t('documentDeleteFailed'));
    }
  };

  const startEditingDocument = (doc) => {
    setEditingDocumentId(getDocumentRecordKey(doc));
    setEditDocumentForm({
      expiry_date: subtractOneYear(toDateInput(doc.expiry_date)),
      notes:
        doc.notes === 'Imported from Excel'
          ? (i18n.language === 'tr' ? "Excel'den aktarıldı" : doc.notes)
          : (doc.notes || ''),
    });
  };

  const handleUpdateDocument = async (doc) => {
    try {
      if (isLocalDemoPerson(id)) {
        const expiryDate = addOneYear(editDocumentForm.expiry_date);
        const timing = getLocalDocumentTiming(expiryDate, doc.document_type?.warning_days);
        const recordKey = getDocumentRecordKey(doc);
        setData((current) => ({
          ...current,
          documents: current.documents.map((item) => (
            getDocumentRecordKey(item) === recordKey
              ? { ...item, expiry_date: expiryDate, notes: editDocumentForm.notes, ...timing }
              : item
          )),
        }));
        toast.success(t('documentUpdated', 'Evrak güncellendi'));
        setEditingDocumentId(null);
        setEditDocumentForm({ expiry_date: '', notes: '' });
        return;
      }
      await axios.put(`${API}/documents/${doc.id}`, {
        personnel_id: doc.personnel_id,
        document_type_id: doc.document_type_id,
        expiry_date: addOneYear(editDocumentForm.expiry_date),
        notes: editDocumentForm.notes,
      });
      toast.success(t('documentUpdated', 'Evrak güncellendi'));
      setEditingDocumentId(null);
      setEditDocumentForm({ expiry_date: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Update document failed:', error);
      toast.error(t('documentUpdateFailed', 'Evrak güncellenemedi'));
    }
  };

  // UI helpers
  const inputDark =
    'bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl';

  const cardClass = 'glass-panel rounded-2xl p-6';
  const titleText = 'text-slate-900 dark:text-slate-100';
  const subText = 'text-slate-600 dark:text-slate-300';
  // ✅ Fix: Define mutedText
  const mutedText = 'text-slate-500 dark:text-slate-400';

  const getDocRowClass = (status) => {
    const s = String(status || '').toLowerCase();

    if (s === 'red' || s === 'expired' || s === 'invalid') {
      return 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-500/30';
    }
    if (s === 'yellow' || s === 'warning' || s === 'expiring') {
      return 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30';
    }
    if (s === 'green' || s === 'valid' || s === 'ok') {
      return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30';
    }

    return 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/10';
  };

  if (loading) {
    return (
      //      <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600 dark:text-slate-300">{t('loading')}</div>
      </div>
      //      </Layout>
    );
  }

  if (!data) {
    return (
      //      <Layout>
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">{t('personnelNotFound')}</p>
      </div>
      //      </Layout>
    );
  }

  const p = data.personnel;

  return (
    //    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/personnel')} data-testid="back-button">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* İsim başlığını uppercase yapmıyoruz (isimlerde TR karakter bozulmasın) */}
          <h1 className={`page-title ${titleText}`}>
            {p.full_name}
          </h1>

          <StatusBadge status={data.overall_status} size="lg" />
        </div>

        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            className="gap-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl"
            data-testid="edit-button"
          >
            <Edit className="w-4 h-4" />
            {t('edit')}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
              onClick={() => {
                setIsEditing(false);
                setEditForm({
                  full_name: p.full_name || '',
                  tc_number: p.tc_number || '',
                  company: p.company || '',
                  phone: p.phone || '',
                  license_plate: p.license_plate || '',
                  photo_url: p.photo_url || '',
                  assignment_start: p.assignment_start || '',
                  assignment_end: p.assignment_end || '',
                  entry_blocked: Boolean(p.entry_blocked),
                  entry_block_reason: p.entry_block_reason || '',
                });
              }}
            >
              <X className="w-4 h-4" />
              {t('cancel')}
            </Button>

            <Button
              onClick={handleSaveEdit}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="save-button"
            >
              <Save className="w-4 h-4" />
              {t('save')}
            </Button>
          </div>
        )}
      </div>

      {/* Personnel Info */}
      <div className={`${cardClass} p-6`}>
        <div className="flex gap-6">
          <div className="flex-shrink-0">
            {p.photo_url ? (
              <img
                src={p.photo_url}
                alt={p.full_name}
                className="w-32 h-32 rounded-2xl object-cover border-2 border-slate-200 dark:border-white/10 shadow-md"
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center border-2 border-slate-200 dark:border-white/5 shadow-inner">
                <User className="w-16 h-16 text-slate-400" />
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('fullName')} *
                </Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className={inputDark}
                  data-testid="edit-fullname"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('tcNumber')}
                </Label>
                <Input
                  value={editForm.tc_number}
                  onChange={(e) => setEditForm({ ...editForm, tc_number: e.target.value })}
                  className={inputDark}
                  data-testid="edit-tc"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('company')} *
                </Label>
                <Input
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  className={inputDark}
                  data-testid="edit-company"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('phone')}
                </Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className={inputDark}
                  data-testid="edit-phone"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('licensePlate')}
                </Label>
                <Input
                  value={editForm.license_plate}
                  onChange={(e) => setEditForm({ ...editForm, license_plate: e.target.value })}
                  className={inputDark}
                  data-testid="edit-plate"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('photoUrl')}
                </Label>
                <Input
                  value={editForm.photo_url}
                  onChange={(e) => setEditForm({ ...editForm, photo_url: e.target.value })}
                  className={inputDark}
                  data-testid="edit-photo"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('assignmentStart')}
                </Label>
                <LocalizedDateInput
                  value={toDateInput(editForm.assignment_start)}
                  onChange={(e) => setEditForm({ ...editForm, assignment_start: e.target.value })}
                  className={inputDark}
                  data-testid="edit-start"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('assignmentEnd')}
                </Label>
                <LocalizedDateInput
                  value={toDateInput(editForm.assignment_end)}
                  onChange={(e) => setEditForm({ ...editForm, assignment_end: e.target.value })}
                  className={inputDark}
                  data-testid="edit-end"
                />
              </div>

              <div className="col-span-2 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={editForm.entry_blocked}
                    onChange={(e) => setEditForm({ ...editForm, entry_blocked: e.target.checked })}
                    className="h-4 w-4 accent-red-600"
                  />
                  <span className="text-sm font-bold text-red-700 dark:text-red-300">{t('blockPersonnelEntry')}</span>
                </label>
                {editForm.entry_blocked && (
                  <Input
                    value={editForm.entry_block_reason}
                    onChange={(e) => setEditForm({ ...editForm, entry_block_reason: e.target.value })}
                    placeholder={t('blockReasonPlaceholder')}
                    className={`${inputDark} mt-3`}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <p className={`text-xs uppercase tracking-wider font-medium ${mutedText}`}>{t('tcNumber')}</p>
                <p className={`text-lg font-medium mt-1 ${titleText}`}>{p.tc_number}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wider font-medium ${mutedText}`}>{t('company')}</p>
                <p className={`text-lg font-medium mt-1 ${titleText}`}>{p.company}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wider font-medium ${mutedText}`}>{t('phone')}</p>
                <p className={`text-lg font-medium mt-1 ${titleText}`}>{p.phone || '-'}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wider font-medium ${mutedText}`}>{t('licensePlate')}</p>
                <p className={`text-lg font-medium mt-1 ${titleText}`}>{p.license_plate || '-'}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wider font-medium ${mutedText}`}>{t('assignmentStart')}</p>
                <p className={`text-lg font-medium mt-1 ${titleText}`}>
                  {p.assignment_start ? new Date(p.assignment_start).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') : '-'}
                </p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wider font-medium ${mutedText}`}>{t('assignmentEnd')}</p>
                <p className={`text-lg font-medium mt-1 ${titleText}`}>
                  {p.assignment_end ? new Date(p.assignment_end).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') : '-'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className={cardClass}>
        <div className="p-6 border-b border-slate-200 dark:border-[#1A1C1E] flex justify-between items-center">
          <Headline i18nKey="documents" className="text-2xl" />

          <Button
            onClick={() => setIsAddDocOpen(!isAddDocOpen)}
            className="gap-2 premium-gradient text-white border-none rounded-xl hover:shadow-lg transition-all"
            data-testid="add-document-toggle"
          >
            <Plus className="w-4 h-4" />
            {t('addDocument')}
          </Button>
        </div>

        {isAddDocOpen && (
          <div className="p-6 border-b border-slate-200 dark:border-[#1A1C1E] bg-slate-50 dark:bg-[#0F0F0F]">
            <h3 className={`font-semibold mb-4 ${titleText}`}>{t('newDocumentAdd')}</h3>

            <form onSubmit={handleAddDocument} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('documentType')} *
                  </Label>

                  <Select
                    value={docForm.document_type_id}
                    onValueChange={(value) => setDocForm({ ...docForm, document_type_id: value })}
                  >
                    <SelectTrigger
                      className="bg-white dark:bg-[#0F0F0F] border-slate-200 dark:border-[#2A2D30] text-slate-900 dark:text-slate-100"
                      data-testid="doc-type-select"
                    >
                      <SelectValue placeholder={t('select')} />
                    </SelectTrigger>

                    <SelectContent className="bg-white dark:bg-[#1A1C1E] border-slate-200 dark:border-[#2A2D30]">
                      {documentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {i18n.language === 'tr' ? type.name_tr : type.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {i18n.language === 'tr' ? 'Evrak Tarihi' : 'Document Date'} *
                  </Label>
                  <LocalizedDateInput
                    value={docForm.expiry_date}
                    onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })}
                    required
                    className={inputDark}
                    data-testid="doc-expiry-input"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {i18n.language === 'tr'
                      ? 'Geçerlilik bitişi, seçtiğiniz evrak tarihinden otomatik olarak 1 yıl sonrası kaydedilir.'
                      : 'The expiry date is automatically saved as 1 year after the selected document date.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="dark:border-[#2A2D30] dark:text-slate-200 dark:hover:bg-[#1A1C1E]"
                  onClick={() => setIsAddDocOpen(false)}
                >
                  {t('cancel')}
                </Button>

                <Button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100"
                  data-testid="doc-submit-button"
                >
                  {t('add')}
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          {data.documents.length === 0 ? (
            <p className={`${mutedText} text-center py-8`}>{t('noDocuments')}</p>
          ) : (
            <div className="space-y-3">
              {data.documents.map((doc) => {
                const days = doc.days_until_expiry;
                const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-US';

                return (
                  <div
                    key={getDocumentRecordKey(doc)}
                    className={`flex items-center justify-between p-4 rounded-lg border ${getDocRowClass(doc.status)}`}
                    data-testid={`document-${getDocumentRecordKey(doc)}`}
                  >
                    <div className="flex-1">
                      <p className={`font-semibold ${titleText}`}>
                        {i18n.language === 'tr' ? doc.document_type.name_tr : doc.document_type.name_en}
                      </p>

                      <p className={`text-sm mt-1 ${subText}`}>
                        {t('expiresOn')}: {new Date(doc.expiry_date).toLocaleDateString(locale)}
                        {typeof days === 'number' && days >= 0 && (
                          <span className="ml-2">
                            ({days} {t('daysLeft')})
                          </span>
                        )}
                        {typeof days === 'number' && days < 0 && (
                          <span className="ml-2 text-red-600 dark:text-red-300 font-medium">
                            ({t('expired')})
                          </span>
                        )}
                      </p>
                      {editingDocumentId === getDocumentRecordKey(doc) && (
                        <div className="mt-4 max-w-md space-y-3">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {i18n.language === 'tr' ? 'Evrak Tarihi' : 'Document Date'}
                          </Label>
                          <LocalizedDateInput
                            value={editDocumentForm.expiry_date}
                            onChange={(e) => setEditDocumentForm({ ...editDocumentForm, expiry_date: e.target.value })}
                            className={inputDark}
                          />
                          <Input
                            value={editDocumentForm.notes}
                            onChange={(e) => setEditDocumentForm({ ...editDocumentForm, notes: e.target.value })}
                            placeholder={t('notes')}
                            className={inputDark}
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {i18n.language === 'tr'
                              ? 'Seçilen tarihin 1 yıl sonrası geçerlilik bitişi olarak kaydedilir.'
                              : 'One year after the selected date is saved as the expiry date.'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      {editingDocumentId === getDocumentRecordKey(doc) ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleUpdateDocument(doc)}
                            title={t('save')}
                          >
                            <Save className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingDocumentId(null)}
                            title={t('cancel')}
                          >
                            <X className="w-4 h-4 text-slate-500" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditingDocument(doc)}
                          title={t('edit')}
                        >
                          <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteDocument(doc)}
                        data-testid={`delete-doc-${getDocumentRecordKey(doc)}`}
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    //    </Layout>
  );
};

export default PersonnelDetail;
