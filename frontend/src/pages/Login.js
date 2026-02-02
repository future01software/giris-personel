import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Globe, Sun, Moon, Eye, EyeOff, XCircle, CheckCircle, UserCircle, Lock } from 'lucide-react';
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
// Production API URL should be set in REACT_APP_BACKEND_URL environment variable
const API = `${process.env.REACT_APP_BACKEND_URL || 'http://' + window.location.hostname + ':8000'}/api`;

const Login = () => {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { toggleTheme } = useTheme();
  const navigate = useNavigate(); // (kalsın ama artık tam yönlendirme yapıyoruz)

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY);
    if (savedLang && savedLang !== i18n.language) i18n.changeLanguage(savedLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'tr' ? 'en' : 'tr';
    i18n.changeLanguage(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  };

  const toastSuccess = (title, description) => {
    toast(title, {
      description,
      icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
      className:
        'border-l-4 border-emerald-500 bg-emerald-50 text-emerald-900 shadow-lg ' +
        'dark:bg-emerald-950/30 dark:text-emerald-100',
    });
  };

  const toastError = (title, description) => {
    toast(title, {
      description,
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      className:
        'border-l-4 border-red-500 bg-red-50 text-red-900 shadow-lg ' +
        'dark:bg-red-950/30 dark:text-red-100',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!username.trim() || !password.trim()) {
      const msg = i18n.language === 'tr' ? 'Lütfen tüm alanları doldurun' : 'Please fill all fields';
      setError(msg);
      toastError(i18n.language === 'tr' ? 'Eksik bilgi' : 'Missing info', msg);
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(username, password);

      // ✅ Chrome'a şifre kaydetmeyi tetikle (HTTPS + Chrome/Edge)
      try {
        if (window.PasswordCredential && navigator.credentials) {
          const cred = new window.PasswordCredential({
            id: username,
            name: username,
            password: password,
          });
          await navigator.credentials.store(cred);
        }
      } catch (_) {
        // desteklemeyen tarayıcılarda sessiz geç
      }

      toastSuccess(
        i18n.language === 'tr' ? 'Giriş başarılı' : 'Login successful',
        i18n.language === 'tr' ? 'Yönlendiriliyorsunuz...' : 'Redirecting...'
      );

      // ✅ SPA navigate yerine tam yönlendirme: Chrome "login tamamlandı" sinyalini daha iyi yakalar
      window.location.assign('/dashboard');
      // navigate('/dashboard'); // artık kullanmıyoruz
    } catch (err) {
      const backendError = String(err?.response?.data?.detail || '').toLowerCase();
      const isCred =
        backendError.includes('invalid') || backendError.includes('credentials') || backendError.includes('incorrect');

      const errorMsg = isCred
        ? i18n.language === 'tr'
          ? 'Kullanıcı adı veya şifre hatalı!'
          : 'Invalid username or password!'
        : i18n.language === 'tr'
          ? 'Giriş yapılamadı. Lütfen tekrar deneyin.'
          : 'Login failed. Please try again.';

      setError(errorMsg);
      toastError(i18n.language === 'tr' ? 'Giriş reddedildi' : 'Login denied', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const emailInput = e.target.email.value;
    if (!emailInput) return;

    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: emailInput });
      toastSuccess(
        i18n.language === 'tr' ? 'E-posta gönderildi' : 'Email sent',
        i18n.language === 'tr'
          ? 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.'
          : 'Password reset link has been sent to your email.'
      );
      setForgotPasswordOpen(false);
    } catch (err) {
      toastError(
        i18n.language === 'tr' ? 'Hata' : 'Error',
        i18n.language === 'tr' ? 'İşlem başarısız oldu.' : 'Action failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Focus artık INSET (içe doğru) — kesilme olmaz
  const baseInputClass =
    'h-10 bg-transparent transition-all duration-200 ' +
    'border-0 border-b-2 border-slate-200 dark:border-slate-700 rounded-none px-1 ' +
    'focus-visible:outline-none focus-visible:ring-0 focus-visible:border-blue-500 ' +
    'placeholder:text-slate-300 dark:placeholder:text-slate-600';

  const errorInputClass =
    'border-red-500 focus-visible:border-red-500';

  return (
    <div className="min-h-[100svh] flex bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Left Side */}
      <div
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative overflow-hidden"
        style={{
          backgroundImage:
            "url('https://customer-assets.emergentagent.com/job_1d2af80c-7d4d-4339-a104-977e8ceb2b64/artifacts/hctbjjis_unnamed.jpg')",
        }}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-cyan-900/40 to-slate-950/80 animate-gradient" />
        <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/50 backdrop-blur-sm" />

        {/* Moving grid overlay */}
        <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(6,182,212,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,182,212,0.3)_1px,transparent_1px)] bg-[size:64px_64px] animate-grid-move" />
        </div>

        <div className="relative h-full w-full flex items-center justify-center p-12 z-10">
          <div className="flex flex-col items-center text-center text-white">
            <div className="mb-8 relative group">
              <div className="absolute inset-0 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500">
                <img src="/logo.png" alt="" className="w-48 h-48 object-contain" />
              </div>

              {/* slow spinning ring */}
              <div className="absolute inset-0 animate-spin-slow opacity-50">
                <div className="w-full h-full border-4 border-cyan-500/30 rounded-full border-t-cyan-500/90" />
              </div>

              <img
                src="/logo.png"
                alt="Clear2Work"
                className="relative w-48 h-48 object-contain drop-shadow-[0_0_40px_rgba(59,130,246,0.5)] dark:drop-shadow-[0_0_50px_rgba(59,130,246,0.6)] transform group-hover:scale-110 transition-all duration-500 animate-pulse-subtle"
                loading="eager"
                draggable={false}
              />
            </div>

            <h1
              className="text-6xl font-bold tracking-tight drop-shadow-2xl animate-fade-in-up"
              style={{ fontFamily: 'Oswald, sans-serif' }}
            >
              {t('appName')}
            </h1>

            <p className="mt-4 text-xl text-slate-200 leading-relaxed max-w-md animate-fade-in-up-delayed">
              {t('appSubtitle')}
            </p>

            <div className="mt-8 w-24 h-1 rounded-full animate-cyan-flow" />
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="w-full lg:w-1/2 flex items-start lg:items-center justify-center px-4 sm:px-8 py-8 lg:py-0 bg-white dark:bg-slate-950 relative overflow-y-auto lg:overflow-hidden">
        <div className="w-full max-w-md relative z-10 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 bg-white/75 dark:bg-slate-950/45 backdrop-blur-xl shadow-xl shadow-slate-900/5 dark:shadow-black/30 p-5 sm:p-8 overflow-hidden flex flex-col">
          {/* Theme & Language Toggle */}
          <div className="flex justify-end mb-6 gap-2 relative z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:scale-110 hover:shadow-lg transition-all duration-300"
              type="button"
            >
              <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="gap-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:scale-105 hover:shadow-lg transition-all duration-300"
              type="button"
            >
              <Globe className="w-4 h-4" />
              {i18n.language === 'tr' ? 'EN' : 'TR'}
            </Button>
          </div>

          {/* Welcome */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t('welcomeBack')}</h2>
            <p className="text-slate-600 dark:text-slate-300">{t('enterCredentials')}</p>
          </div>

          {/* Error box */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300 opacity-80">
                  {i18n.language === 'tr'
                    ? 'Şifrenizi mi unuttunuz? Destek ekibiyle iletişime geçin.'
                    : 'Forgot your password? Contact support team.'}
                </p>
              </div>
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 transition-all" type="button">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} autoComplete="on" className="space-y-8 mt-4">
            {/* Username */}
            <div className="relative group">
              <Label className="text-slate-400 dark:text-slate-500 text-sm font-medium ml-10 transition-colors group-focus-within:text-blue-500">
                {t('username')}
              </Label>
              <div className="flex items-center gap-3 mt-1">
                <UserCircle className="w-8 h-8 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  required
                  className={`${baseInputClass} flex-1 ${error ? errorInputClass : ''}`}
                  placeholder={i18n.language === 'tr' ? 'Kullanıcı Adı' : 'Username'}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="relative group">
              <Label className="text-slate-400 dark:text-slate-500 text-sm font-medium ml-10 transition-colors group-focus-within:text-blue-500">
                {t('password')}
              </Label>
              <div className="flex items-center gap-3 mt-1">
                <Lock className="w-8 h-8 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    required
                    className={`${baseInputClass} w-full pr-10 ${error ? errorInputClass : ''}`}
                    placeholder={i18n.language === 'tr' ? 'Şifre' : 'Password'}
                    autoComplete="current-password"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end -mt-4">
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(true)}
                className="text-blue-500 hover:text-blue-600 text-sm font-semibold transition-colors"
              >
                {t('forgotPassword')}
              </button>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 premium-gradient hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-bold tracking-wide rounded-xl shadow-lg shadow-blue-500/25 mt-4"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('loginLoading')}</span>
                </div>
              ) : (
                t('login')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>© 2026 Clear2Work. {i18n.language === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</p>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              {t('forgotPasswordTitle')}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {t('forgotPasswordDesc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('email')}
                </Label>
                <Input
                  id="forgot-email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  className="h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotPasswordOpen(false)}
                className="rounded-xl"
              >
                {t('cancel')}
              </Button>
              <Button type="submit" className="premium-gradient rounded-xl px-8" disabled={loading}>
                {loading ? t('sending') : t('sendResetLink')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
