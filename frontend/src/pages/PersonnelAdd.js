import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import LocalizedDateInput from '../components/LocalizedDateInput';
import { toast } from 'sonner';
import axios from 'axios';

import { generateRandomTC } from '../utils/generators';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;

const PersonnelAdd = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    full_name: '',
    tc_number: generateRandomTC(), // ✅ Otomatik dolduruldu

    company: '',
    phone: '',
    license_plate: '',
    photo_url: '',
    assignment_start: '',
    assignment_end: '',
  });

  const [documentDates, setDocumentDates] = useState({});

  useEffect(() => {
    fetchDocumentTypes();
    // eslint-disable-next-line
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      const response = await axios.get(`${API}/documents/types`);
      setDocumentTypes(response.data);

      const initialDates = {};
      response.data.forEach((type) => {
        initialDates[type.id] = '';
      });
      setDocumentDates(initialDates);
    } catch (error) {
      console.error('Failed to fetch document types:', error);
      toast.error(t('docTypesLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const personnelRes = await axios.post(`${API}/personnel`, formData);
      const personnelId = personnelRes.data.id;

      const documentPromises = [];
      for (const [typeId, date] of Object.entries(documentDates)) {
        if (date) {
          documentPromises.push(
            axios.post(`${API}/documents`, {
              personnel_id: personnelId,
              document_type_id: typeId,
              expiry_date: date,
              notes: '',
            })
          );
        }
      }

      await Promise.all(documentPromises);

      toast.success(t('personnelAddSuccess'));
      navigate('/personnel');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('personnelAddFailed'));
    }
  };

  const inputDark =
    'bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500';

  const labelDark = 'text-slate-700 dark:text-slate-300';

  if (loading) {
    return (
      //      <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600 dark:text-slate-300">{t('loading')}</div>
      </div>
      //      </Layout>
    );
  }

  return (
    //    <Layout>
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/personnel')}
          className="text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          data-testid="back-button"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <h1 className="page-title">
          Yeni Personel Ekle
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personnel Info Card */}
        <div className="bg-white dark:bg-[#080808] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t('personnelInfo')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>{t('fullName')} *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                className={inputDark}
                data-testid="personnel-fullname-input"
              />
            </div>

            <div>
              <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>{t('tcNumber')}</Label>
              <Input
                value={formData.tc_number}
                onChange={(e) => setFormData({ ...formData, tc_number: e.target.value })}
                className={inputDark}
                data-testid="personnel-tc-input"
              />
            </div>

            <div>
              <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>{t('company')} *</Label>
              <Input
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                required
                className={inputDark}
                data-testid="personnel-company-input"
              />
            </div>

            <div>
              <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>{t('phone')}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+905551234567"
                className={inputDark}
                data-testid="personnel-phone-input"
              />
            </div>

            <div>
              <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>{t('licensePlate')}</Label>
              <Input
                value={formData.license_plate}
                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                className={inputDark}
                data-testid="personnel-plate-input"
              />
            </div>

            <div>
              <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>{t('photoUrl')}</Label>
              <Input
                value={formData.photo_url}
                onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                className={inputDark}
                data-testid="personnel-photo-input"
              />
            </div>

            <div>
              <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>{t('assignmentStart')}</Label>
              <LocalizedDateInput
                value={formData.assignment_start}
                onChange={(e) => setFormData({ ...formData, assignment_start: e.target.value })}
                className={inputDark}
                data-testid="personnel-start-input"
              />
            </div>

            <div>
              <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>{t('assignmentEnd')}</Label>
              <LocalizedDateInput
                value={formData.assignment_end}
                onChange={(e) => setFormData({ ...formData, assignment_end: e.target.value })}
                className={inputDark}
                data-testid="personnel-end-input"
              />
            </div>
          </div>
        </div>

        {/* Documents Card (Info style) */}
        <div className="bg-blue-50 dark:bg-[#080808] rounded-xl border border-blue-200 dark:border-white/5 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t('documents')} ({t('optional')})
          </h3>

          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{t('enterExpiryDates')}</p>

          {documentTypes.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-slate-500 dark:text-slate-400 mb-2">{t('noDocumentTypes')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => navigate('/settings')}
              >
                {t('goToSettings')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documentTypes.map((type) => (
                <div key={type.id} className="bg-white/70 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                  <Label className={`uppercase text-xs tracking-wider ${labelDark}`}>
                    {i18n.language === 'tr' ? type.name_tr : type.name_en}
                    {type.is_mandatory && <span className="text-red-600 dark:text-rose-300 ml-1">*</span>}
                  </Label>

                  <LocalizedDateInput
                    value={documentDates[type.id] || ''}
                    onChange={(e) => setDocumentDates({ ...documentDates, [type.id]: e.target.value })}
                    className={`${inputDark} mt-2`}
                    data-testid={`doc-date-${type.id}`}
                  />

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {t('warningDays')}: {type.warning_days}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            className="dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => navigate('/personnel')}
          >
            {t('cancel')}
          </Button>

          <Button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100"
            data-testid="personnel-submit-button"
          >
            {t('save')}
          </Button>
        </div>
      </form>
    </div>
    //    </Layout>
  );
};

export default PersonnelAdd;
