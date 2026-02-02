import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import Headline from '../components/Headline';
import { useTheme } from '../contexts/ThemeContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, Trash2, Sun, Moon, Globe, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);

  const [typeForm, setTypeForm] = useState({
    name_tr: '',
    name_en: '',
    is_mandatory: true,
    warning_days: 30,
  });

  const [smsForm, setSmsForm] = useState({
    phone: '',
    message: '',
  });

  const [sending, setSending] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    db: 'checking',
    latency: null
  });

  useEffect(() => {
    fetchDocumentTypes();
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    const start = performance.now();
    try {
      const res = await axios.get(`${API.replace('/api', '')}/health`);
      const end = performance.now();
      setSystemStatus({
        db: res.data.database_status === 'online' ? 'online' : 'offline',
        latency: Math.round(end - start)
      });
    } catch (error) {
      setSystemStatus({ db: 'offline', latency: null });
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const response = await axios.get(`${API}/documents/types`);
      setDocumentTypes(response.data);
    } catch (error) {
      console.error('Failed to fetch document types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/documents/types`, typeForm);
      toast.success(t('documentTypeAdded'));
      setIsAddTypeOpen(false);
      setTypeForm({ name_tr: '', name_en: '', is_mandatory: true, warning_days: 30 });
      fetchDocumentTypes();
    } catch (error) {
      console.error('Add type failed:', error);
      toast.error(t('documentTypeCreateFailed'));
    }
  };

  const handleDeleteType = async (typeId) => {
    if (!window.confirm(t('documentTypeDeleteConfirm'))) return;

    try {
      await axios.delete(`${API}/documents/types/${typeId}`);
      toast.success(t('documentTypeDeleted'));
      fetchDocumentTypes();
    } catch (error) {
      console.error('Delete type failed:', error);
      toast.error(t('documentTypeDeleteFailed'));
    }
  };

  const handleTestSMS = async (e) => {
    e.preventDefault();
    setSending(true);

    try {
      await axios.post(`${API}/sms/send`, smsForm);
      toast.success(t('smsSent'));
      setSmsForm({ phone: '', message: '' });
    } catch (error) {
      console.error('SMS send failed:', error);
      toast.error(error?.response?.data?.detail || t('smsSendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    //    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <Headline i18nKey="settings" />

      {/* App Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Theme Card */}
        <button
          onClick={toggleTheme}
          className="glass-panel p-4 rounded-2xl flex items-center justify-between hover:border-blue-500/50 transition-colors group text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{t('appearance')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </p>
            </div>
          </div>
        </button>

        {/* Language Card */}
        <button
          onClick={() => {
            const newLang = i18n.language?.startsWith('tr') ? 'en' : 'tr';
            i18n.changeLanguage(newLang);
            localStorage.setItem('CLEAR2WORK_LANG', newLang);
          }}
          className="glass-panel p-4 rounded-2xl flex items-center justify-between hover:border-purple-500/50 transition-colors group text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{t('language')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {i18n.language?.startsWith('tr') ? 'Türkçe' : 'English'}
              </p>
            </div>
          </div>
          <div className="text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {i18n.language?.startsWith('tr') ? 'TR' : 'EN'}
          </div>
        </button>
      </div>

      {/* Document Types Section */}
      <div className="glass-panel rounded-2xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {t('documentTypesTitle')}
            </h2>
            <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">
              {t('documentTypesSubtitle')}
            </p>
          </div>

          <Dialog open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
            <DialogTrigger asChild>
              <button
                className="px-4 py-2 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm font-medium"
                data-testid="add-doctype-button"
              >
                <Plus className="w-4 h-4" />
                {t('addDocumentType')}
              </button>
            </DialogTrigger>

            <DialogContent className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">
                  {t('addDocumentTypeTitle')}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleAddType} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {t('nameTrLabel')} *
                  </label>
                  <input
                    value={typeForm.name_tr}
                    onChange={(e) => setTypeForm({ ...typeForm, name_tr: e.target.value })}
                    placeholder="İSG Eğitimi"
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    data-testid="doctype-name-tr-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {t('nameEnLabel')} *
                  </label>
                  <input
                    value={typeForm.name_en}
                    onChange={(e) => setTypeForm({ ...typeForm, name_en: e.target.value })}
                    placeholder="OHS Training"
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    data-testid="doctype-name-en-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {t('warningDaysLabel')} *
                  </label>
                  <input
                    type="number"
                    value={typeForm.warning_days}
                    onChange={(e) =>
                      setTypeForm({ ...typeForm, warning_days: parseInt(e.target.value || '0', 10) })
                    }
                    min="1"
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    data-testid="doctype-warning-input"
                  />
                  <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                    {t('warningDaysHint')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mandatory"
                    checked={typeForm.is_mandatory}
                    onChange={(e) => setTypeForm({ ...typeForm, is_mandatory: e.target.checked })}
                    className="w-4 h-4 accent-slate-900 rounded"
                    data-testid="doctype-mandatory-checkbox"
                  />
                  <label htmlFor="mandatory" className="cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                    {t('mandatoryDocument')}
                  </label>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddTypeOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-md hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors text-sm font-medium"
                    data-testid="doctype-submit-button"
                  >
                    {t('save')}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-slate-600 dark:text-slate-300">
              {t('loading')}
            </div>
          ) : documentTypes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              {t('noDocumentTypesYet')}
            </div>
          ) : (
            <div className="space-y-2">
              {documentTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  data-testid={`doctype-${type.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        {i18n.language === 'tr' ? type.name_tr : type.name_en}
                      </p>

                      {type.is_mandatory && (
                        <span className="px-2 py-0.5 text-xs rounded uppercase font-medium bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200 dark:border dark:border-red-500/30">
                          {t('mandatory')}
                        </span>
                      )}
                    </div>

                    <p className="text-sm mt-0.5 text-slate-600 dark:text-slate-300">
                      {t('warningDaysLabel')}: {type.warning_days} {t('days')}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteType(type.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    data-testid={`delete-doctype-${type.id}`}
                    title={t('delete')}
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SMS Test Section */}
      <div className="glass-panel rounded-2xl p-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
          {t('smsTestTitle')}
        </h2>

        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {t('phoneLabel')}
            </label>
            <input
              value={smsForm.phone}
              onChange={(e) => setSmsForm({ ...smsForm, phone: e.target.value })}
              placeholder="+905551234567"
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid="sms-phone-input"
            />
            <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
              {t('countryCodeHint')}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              {t('messageLabel')}
            </label>
            <input
              value={smsForm.message}
              onChange={(e) => setSmsForm({ ...smsForm, message: e.target.value })}
              placeholder={i18n.language === 'tr' ? 'Test mesajı' : 'Test message'}
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid="sms-message-input"
            />
          </div>

          <button
            onClick={handleTestSMS}
            disabled={sending}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="sms-send-button"
          >
            {sending ? t('sending') : t('sendTestSms')}
          </button>
        </div>

        <div className="mt-4 p-3 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{t('smsNoteTitle')}:</strong> {t('smsBackendNote')}
          </p>
        </div>
      </div>

      {/* System Status Section */}
      <div className="bg-slate-900 dark:bg-black rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/20 rounded-full blur-xl -ml-10 -mb-10"></div>

        <h3 className="font-bold text-lg mb-1 relative z-10">{t('systemStatus')}</h3>
        <p className="text-slate-400 text-xs mb-6 relative z-10">{t('allSystemsOperational')}</p>

        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('database')}</span>
            <span className={`text-xs font-bold ${systemStatus.db === 'online' ? 'text-emerald-400' : 'text-red-400'
              }`}>
              {systemStatus.db === 'checking' ? '...' : (systemStatus.db === 'online' ? t('online') : 'Offline')}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className={`w-full h-full rounded-full ${systemStatus.db === 'online' ? 'bg-emerald-500' : 'bg-red-500'
              }`}></div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-medium">{t('apiLatency')}</span>
            <span className="text-xs font-bold text-slate-300">
              {systemStatus.latency !== null ? `${systemStatus.latency}ms` : '-'}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min((systemStatus.latency || 0) / 2, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
    //    </Layout>
  );
};

export default Settings;
