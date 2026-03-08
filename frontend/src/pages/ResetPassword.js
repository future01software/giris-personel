import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const ResetPassword = () => {
    const { t, i18n } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) {
            toast.error(i18n.language === 'tr' ? 'Geçersiz bağlantı' : 'Invalid link');
            return;
        }

        if (password !== confirmPassword) {
            toast.error(i18n.language === 'tr' ? 'Şifreler uyuşmuyor' : 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error(i18n.language === 'tr' ? 'Şifre en az 6 karakter olmalıdır' : 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/auth/reset-password`, {
                token,
                new_password: password
            });

            toast.success(
                i18n.language === 'tr' ? 'Şifre güncellendi' : 'Password updated',
                { description: i18n.language === 'tr' ? 'Yeni şifrenizle giriş yapabilirsiniz.' : 'You can now login with your new password.' }
            );

            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            const msg = err.response?.data?.detail || (i18n.language === 'tr' ? 'İşlem başarısız' : 'Action failed');
            toast.error(i18n.language === 'tr' ? 'Hata' : 'Error', { description: msg });
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#050505] p-4">
                <div className="bg-white dark:bg-[#080808] p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-white/5">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">{i18n.language === 'tr' ? 'Geçersiz Bağlantı' : 'Invalid Link'}</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">{i18n.language === 'tr' ? 'Bu bağlantı geçersiz veya süresi dolmuş.' : 'This link is invalid or has expired.'}</p>
                    <Button onClick={() => navigate('/login')} className="w-full premium-gradient">
                        {i18n.language === 'tr' ? 'Girişe Dön' : 'Back to Login'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#050505] p-4">
            <div className="bg-white dark:bg-[#080808] p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100 dark:border-white/5">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {i18n.language === 'tr' ? 'Yeni Şifre Belirle' : 'Set New Password'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {i18n.language === 'tr' ? 'Lütfen yeni şifrenizi giriniz.' : 'Please enter your new password.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {i18n.language === 'tr' ? 'Yeni Şifre' : 'New Password'}
                        </Label>
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                <Lock className="w-5 h-5" />
                            </div>
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10 h-11 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                                placeholder="••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {i18n.language === 'tr' ? 'Şifre Onay' : 'Confirm Password'}
                        </Label>
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-10 h-11 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                                placeholder="••••••"
                                required
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-11 premium-gradient rounded-xl font-bold shadow-lg shadow-blue-500/25 text-white" disabled={loading}>
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            i18n.language === 'tr' ? 'Şifremi Güncelle' : 'Update Password'
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
