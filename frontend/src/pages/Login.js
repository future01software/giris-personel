import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { Globe, Sun, Moon, Eye, EyeOff, XCircle, CheckCircle, Lock, Mail, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const LANG_KEY = 'CLEAR2WORK_LANG';
const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;

const Login = () => {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY);
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
    }
  }, [i18n]);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'tr' ? 'en' : 'tr';
    i18n.changeLanguage(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  };

  const toastSuccess = (title, description) => {
    toast(title, {
      description,
      icon: <CheckCircle className="w-5 h-5 text-slate-600" />,
      className: 'border-l-4 border-slate-500 bg-slate-50 text-slate-900 shadow-lg dark:bg-slate-950/30 dark:text-slate-100',
    });
  };

  const toastError = (title, description) => {
    toast(title, {
      description,
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      className: 'border-l-4 border-red-500 bg-red-50 text-red-900 shadow-lg dark:bg-red-950/30 dark:text-red-100',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!username.trim() || !password.trim()) {
      setError(t('fillAllFields'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      toastSuccess(t('loginSuccess'), t('redirecting'));
      window.location.assign('/dashboard');
    } catch (err) {
      setError(t('invalidCredentials'));
      toastError(t('loginDenied'), t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#050505] p-4 font-['Outfit',_sans-serif] transition-colors duration-500">

      {/* Background Image Mosaic */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Gradient base layers (bottom) */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC] via-[#F8FAFC]/60 to-[#F8FAFC] dark:from-[#050505] dark:via-[#050505]/40 dark:to-[#050505]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F8FAFC]/50 via-transparent to-[#F8FAFC]/50 dark:from-[#050505]/50 dark:via-transparent dark:to-[#050505]/50" />
        {/* Image grid (on top of gradients) */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-4 p-8 z-10 opacity-[0.15] dark:opacity-[0.25]">
          {[
            '/assets/landing/port.png',
            '/assets/landing/construction.png',
            '/assets/landing/containers.png',
            '/assets/landing/crane.png',
            '/assets/landing/warehouse.png',
            '/assets/landing/port.png',
          ].map((src, i) => (
            <div key={i} className="rounded-2xl overflow-hidden shadow-lg">
              <img src={src} alt="" className="w-full h-full object-cover grayscale dark:brightness-75" loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-[420px] bg-white dark:bg-[#0A0A0A] rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.06)] border border-slate-100 dark:border-white/5 p-8 md:p-10"
      >
        <div className="absolute top-6 right-6 flex gap-1.5">
          <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-100 dark:border-white/5">
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-slate-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button onClick={toggleLanguage} className="h-8 px-2.5 flex items-center justify-center rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-[10px] transition-all border border-slate-100 dark:border-white/5 uppercase">
            {i18n.language}
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-3 mb-4">
            <img src="/logo.png" alt="Clear2Work" className="w-14 h-14 object-contain dark:brightness-0 dark:invert transition-transform duration-500 hover:scale-105" />
            <span className="text-3xl font-['Pacifico',_cursive] text-slate-800 dark:text-white">
              Clear<span className="text-slate-500 dark:text-slate-400 ml-1">2Work</span>
            </span>
          </div>

          <div className="inline-block px-3 py-0.5 rounded-full bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-[9px] font-bold tracking-widest border border-slate-100 dark:border-white/10 mb-3" lang="en" style={{ textTransform: 'uppercase' }}>
            {t('industrialSystem')}
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('login')}</h2>
        </div>

        <div className="space-y-2.5 mb-6">
          <Button variant="outline" onClick={() => toast(t('comingSoonTitle'), { description: t('comingSoonDesc'), icon: <Clock className="w-5 h-5 text-slate-400" /> })} className="w-full h-11 rounded-xl border-slate-200 dark:border-white/10 flex items-center justify-center gap-3 font-bold text-slate-400 dark:text-slate-500 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-not-allowed opacity-60">
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4 grayscale opacity-40" alt="" />
            {t('googleLogin')}
          </Button>
          <Button variant="outline" onClick={() => toast(t('comingSoonTitle'), { description: t('comingSoonDesc'), icon: <Clock className="w-5 h-5 text-slate-400" /> })} className="w-full h-11 rounded-xl border-slate-200 dark:border-white/10 flex items-center justify-center gap-3 font-bold text-slate-400 dark:text-slate-500 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-not-allowed opacity-60">
            <svg viewBox="0 0 384 512" className="w-4 h-4 fill-slate-400 dark:fill-slate-500 opacity-40"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-31.4-52.1-105.5-52.1-105.5zM224 88c21.2-25.2 31.3-60.3 27-92-26 1-57 16.5-74.9 38.3A80 80 0 0 0 152 124c28 2 54-15 72-36z" /></svg>
            {t('appleLogin')}
          </Button>
        </div>

        <div className="relative mb-6 flex items-center">
          <div className="flex-1 border-t border-slate-100 dark:border-white/5" />
          <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">{t('or')}</span>
          <div className="flex-1 border-t border-slate-100 dark:border-white/5" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1 uppercase">
              <Mail className="w-3 h-3" /> {t('username')}
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('usernamePlaceholder')}
              className="h-11 rounded-xl bg-white dark:bg-black/40 border-slate-200 dark:border-white/10 focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition-all text-sm px-4"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1 uppercase">
              <Lock className="w-3 h-3" /> {t('password')}
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                className="h-11 rounded-xl bg-white dark:bg-black/40 border-slate-200 dark:border-white/10 focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition-all text-sm px-4 pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-12 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-950 text-white text-lg font-black shadow-lg dark:shadow-white/5 hover:scale-[1.02] active:scale-95 transition-all mt-2">
            {loading ? t('loginLoading') : t('login')}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button onClick={() => setForgotPasswordOpen(true)} className="text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-950 dark:hover:text-white transition-colors">
            {t('forgotPasswordBtn')}
          </button>
          <p className="text-xs font-medium text-slate-400">
            {t('noAccount')} <button onClick={() => toast(t('comingSoonTitle'), { description: t('comingSoonDesc'), icon: <Clock className="w-5 h-5 text-slate-400" /> })} className="text-slate-400 dark:text-slate-500 font-black hover:underline ml-1 cursor-not-allowed">{t('register')}</button>
          </p>
        </div>

        <div className="mt-8 text-center text-[10px] font-medium text-slate-300 dark:text-slate-600">
          © 2026 Clear2Work. {t('allRightsReserved')}
        </div>
      </motion.div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#0A0A0A] border-slate-100 dark:border-white/10 rounded-[2rem]">
          <DialogHeader className="pt-4">
            <DialogTitle className="text-xl font-black text-center dark:text-white">{t('resetPassword')}</DialogTitle>
            <DialogDescription className="text-center text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('resetPasswordDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <Input placeholder="ornek@email.com" className="h-11 rounded-xl bg-white dark:bg-black/40 dark:text-white" />
            <Button className="w-full h-11 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-950 font-bold text-white shadow-xl">{t('send')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pacifico&family=Outfit:wght@400;500;600;700;800;900&display=swap');
      `}} />
    </div>
  );
};

export default Login;
