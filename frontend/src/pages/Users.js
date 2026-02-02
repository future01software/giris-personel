import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import { Plus, Trash2, Edit, X, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Users = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'security'
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error(t('other') || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setFormData({ email: '', password: '', full_name: '', role: 'security' });
    setEditingUser(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingUser) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;

        await axios.put(`${API}/users/${editingUser.id}`, payload);
        toast.success(t('userUpdated') || 'Kullanıcı güncellendi');
      } else {
        await axios.post(`${API}/users`, formData);
        toast.success(t('userCreated') || 'Kullanıcı oluşturuldu');
      }
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('other') || 'Hata');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      full_name: user.full_name || '',
      role: user.role || 'security'
    });
    setShowForm(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm(t('areYouSure') || 'Emin misiniz?')) return;

    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success(t('userDeleted') || 'Kullanıcı silindi');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('other') || 'Hata');
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin:
        'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-200 dark:border dark:border-purple-500/30',
      security:
        'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200 dark:border dark:border-blue-500/30',
      supervisor:
        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200 dark:border dark:border-amber-500/30'
    };
    return styles[role] || 'bg-slate-100 text-slate-800 dark:bg-slate-500/15 dark:text-slate-200 dark:border dark:border-slate-500/30';
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

  return (
    //    <Layout>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
          {t('users')}
        </h1>

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 premium-gradient text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 text-sm font-bold uppercase tracking-wide border-none"
          data-testid="add-user-button"
        >
          <Plus className="w-4 h-4" />
          Yeni Kullanıcı
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass-panel rounded-2xl p-5" data-testid="user-form">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {editingUser ? 'Kullanıcı Düzenle' : 'Kullanıcı Ekle'}
            </h2>
            <button
              onClick={resetForm}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ad Soyad *
              </label>
              <input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                data-testid="user-fullname-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                E-posta *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                data-testid="user-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Şifre {editingUser ? '(Boş bırakın)' : '*'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                data-testid="user-password-input"
              />
              {editingUser && (
                <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                  Boş bırakırsanız mevcut şifre korunur
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rol *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                data-testid="user-role-select"
              >
                <option value="admin">{t('admin')}</option>
                <option value="security">{t('security')}</option>
                <option value="supervisor">{t('supervisor')}</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-md hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm font-medium"
                data-testid="save-user-button"
              >
                <Check className="w-4 h-4" />
                {editingUser ? 'Güncelle' : 'Kaydet'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  Ad Soyad
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  E-posta
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  Rol
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  Oluşturulma
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  İşlemler
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Henüz kullanıcı yok
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    data-testid={`user-row-${user.id}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {user.full_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase ${getRoleBadge(user.role)}`}>
                        {user.role === 'admin' ? t('admin') : user.role === 'security' ? t('security') : t('supervisor')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                          data-testid={`edit-user-${user.id}`}
                        >
                          <Edit className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          data-testid={`delete-user-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    //    </Layout>
  );
};

export default Users;
