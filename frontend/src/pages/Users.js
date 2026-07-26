import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
// import Layout from '../components/Layout';
import { Plus, Trash2, Edit, X, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;

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
        'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200 dark:border dark:border-purple-800/30',
      security:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 dark:border dark:border-blue-800/30',
      supervisor:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border dark:border-amber-800/30'
    };
    return styles[role] || 'bg-slate-100 text-slate-800 dark:bg-white/5 dark:text-slate-200 dark:border dark:border-white/10';
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
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">
          {t('users')}
        </h1>

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="w-full justify-center px-4 py-2 premium-gradient text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider border-none sm:w-auto"
          data-testid="add-user-button"
        >
          <Plus className="w-4 h-4" />
          {t('newUser')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass-panel rounded-2xl p-5" data-testid="user-form">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editingUser ? t('editUser') : t('addUser')}
            </h2>
            <button
              onClick={resetForm}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('fullName')} *
              </label>
              <input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/10 shadow-inner"
                data-testid="user-fullname-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('email')} *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/10 shadow-inner"
                data-testid="user-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('password')} {editingUser ? `(${t('passwordHint')})` : '*'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
                className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/10 shadow-inner"
                data-testid="user-password-input"
              />
              {editingUser && (
                <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                  {t('passwordHint')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('role')} *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/10 shadow-inner"
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
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm font-medium"
                data-testid="save-user-button"
              >
                <Check className="w-4 h-4" />
                {editingUser ? t('update') : t('save')}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-slate-200 dark:border-[#2A2D30] rounded-md hover:bg-slate-50 dark:hover:bg-[#1A1C1E] transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#080808] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                <th className="px-5 py-4 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('fullName')}
                </th>
                <th className="px-5 py-4 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('email')}
                </th>
                <th className="px-5 py-4 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('role')}
                </th>
                <th className="px-5 py-4 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('createdAt')}
                </th>
                <th className="px-5 py-4 text-right text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    {t('noUsersYet')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    data-testid={`user-row-${user.id}`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {user.full_name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 text-xs font-medium">
                      {user.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getRoleBadge(user.role)}`}>
                        {user.role === 'admin' ? t('admin') : user.role === 'security' ? t('security') : t('supervisor')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 text-xs font-medium">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors"
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
