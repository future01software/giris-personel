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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';

const BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
const API = `${BASE}/api`;

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');

const PersonnelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [data, setData] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    full_name: '',
    tc_number: '',
    company: '',
    phone: '',
    license_plate: '',
    photo_url: '',
    assignment_start: '',
    assignment_end: '',
  });

  const [docForm, setDocForm] = useState({
    document_type_id: '',
    expiry_date: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, typesRes] = await Promise.all([
        axios.get(`${API}/personnel/${id}`),
        axios.get(`${API}/documents/types`),
      ]);

      setData(detailRes.data);
      setDocumentTypes(typesRes.data);

      const p = detailRes.data.personnel;
      setEditForm({
        full_name: p.full_name || '',
        tc_number: p.tc_number || '',
        company: p.company || '',
        phone: p.phone || '',
        license_plate: p.license_plate || '',
        photo_url: p.photo_url || '',
        assignment_start: p.assignment_start || '',
        assignment_end: p.assignment_end || '',
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(t('failedToLoadData'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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
      await axios.post(`${API}/documents`, {
        ...docForm,
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

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await axios.delete(`${API}/documents/${docId}`);
      toast.success(t('documentDeleted'));
      fetchData();
    } catch (error) {
      console.error('Delete document failed:', error);
      toast.error(t('documentDeleteFailed'));
    }
  };

  // UI helpers
  const inputDark =
    'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl';

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

    return 'bg-slate-50 border-slate-200 dark:bg-slate-950/40 dark:border-slate-800';
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
          <h1 className={`text-3xl font-bold tracking-tight ${titleText}`} style={{ fontFamily: 'Oswald, sans-serif' }}>
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
              className="dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
                className="w-32 h-32 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-md"
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-200 dark:border-slate-700 shadow-inner">
                <User className="w-16 h-16 text-slate-400" />
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
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
                <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
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
                <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
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
                <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
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
                <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
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
                <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
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
                <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
                  {t('assignmentStart')}
                </Label>
                <Input
                  type="date"
                  value={toDateInput(editForm.assignment_start)}
                  onChange={(e) => setEditForm({ ...editForm, assignment_start: e.target.value })}
                  className={inputDark}
                  data-testid="edit-start"
                />
              </div>

              <div>
                <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
                  {t('assignmentEnd')}
                </Label>
                <Input
                  type="date"
                  value={toDateInput(editForm.assignment_end)}
                  onChange={(e) => setEditForm({ ...editForm, assignment_end: e.target.value })}
                  className={inputDark}
                  data-testid="edit-end"
                />
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
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
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
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
            <h3 className={`font-bold mb-4 ${titleText}`}>{t('newDocumentAdd')}</h3>

            <form onSubmit={handleAddDocument} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
                    {t('documentType')} *
                  </Label>

                  <Select
                    value={docForm.document_type_id}
                    onValueChange={(value) => setDocForm({ ...docForm, document_type_id: value })}
                  >
                    <SelectTrigger
                      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      data-testid="doc-type-select"
                    >
                      <SelectValue placeholder={t('select')} />
                    </SelectTrigger>

                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                      {documentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {i18n.language === 'tr' ? type.name_tr : type.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">
                    {t('expiryDate')} *
                  </Label>
                  <Input
                    type="date"
                    value={docForm.expiry_date}
                    onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })}
                    required
                    className={inputDark}
                    data-testid="doc-expiry-input"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
                    key={doc.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${getDocRowClass(doc.status)}`}
                    data-testid={`document-${doc.id}`}
                  >
                    <div className="flex-1">
                      <p className={`font-medium ${titleText}`}>
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
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteDocument(doc.id)}
                        data-testid={`delete-doc-${doc.id}`}
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
