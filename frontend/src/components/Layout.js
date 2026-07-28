// src/components/Layout.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useAlerts } from '../contexts/AlertContext';
import { useTheme } from '../contexts/ThemeContext';

import {
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Search,
  Bell,
  // Set 1 (Modern & Kurumsal)
  BarChart3,
  IdCard,
  DoorOpen,
  UsersRound,
  Sliders,
  History,
  ChevronLeft,
  Settings,
  User
} from 'lucide-react';

import { toTurkishUpperCase } from '../utils/textHelpers';
import { Button } from './ui/button';
import { Input } from './ui/input';

const LANG_KEY = 'clear2work_lang';
const THEME_KEY = 'clear2work_theme';

// ✅ Role normalize
const normalizeRoleKey = (role) => {
  const r = String(role || '').toLowerCase().trim();
  if (r.includes('admin') || r.includes('yönet') || r.includes('yonet')) return 'admin';
  if (r.includes('security') || r.includes('güven') || r.includes('guven')) return 'security';
  if (r.includes('supervisor') || r.includes('denet') || r.includes('super')) return 'supervisor';
  return r;
};

const Layout = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { alerts } = useAlerts();
  const location = useLocation();
  const navigate = useNavigate();

  const { theme, toggleTheme, isDark: dark } = useTheme();
  // Sidebar state - Default to TRUE (open)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // We can keep saving to localStorage if we want to persist user preference across reloads, 
  // but the user specifically asked for "Open when site opens". 
  // If we want it to ALWAYS start open, we just ignore the saved state for initialization.
  // But we might still want to save it if they manually toggle it (though manual toggle is less relevant with hover).
  // I will keep the effect to save it, but init with true. 
  // Actually, with hover logic, 'state' becomes ephemeral based on mouse position mostly.
  // So maybe we don't need to persist it as "closed" if it auto-closes on leave.
  // Let's just use simple state.
  useEffect(() => {
    localStorage.setItem('SIDEBAR_STATE', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  const isTR = i18n.language?.startsWith('tr');

  // ✅ Dil: açılışta localStorage'dan uygula
  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY);
    if (savedLang && savedLang !== i18n.language) i18n.changeLanguage(savedLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Dil toggle + kalıcı kaydet
  const toggleLanguage = () => {
    const newLang = i18n.language?.startsWith('tr') ? 'en' : 'tr';
    i18n.changeLanguage(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  };

  // ✅ Sync HTML lang attribute for correct CSS uppercase behavior
  useEffect(() => {
    document.documentElement.lang = i18n.language?.startsWith('tr') ? 'tr' : 'en';
  }, [i18n.language]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = useMemo(
    () => [
      { name: t('dashboard'), path: '/dashboard', icon: BarChart3, roles: ['admin', 'supervisor'] },
      { name: t('personnel'), path: '/personnel', icon: IdCard, roles: ['admin'] },
      { name: t('entryCheck'), path: '/entry-check', icon: DoorOpen, roles: ['admin'] },
      { name: t('entryCheck'), path: '/security-check', icon: DoorOpen, roles: ['security'] },
      { name: t('entryExitRecords'), path: '/entry-logs', icon: History, roles: ['security'] },
      { name: t('users'), path: '/users', icon: UsersRound, roles: ['admin'] },
      { name: t('settings'), path: '/settings', icon: Sliders, roles: ['admin'] },
    ],
    [t]
  );

  const filteredNav = useMemo(() => {
    const roleKey = normalizeRoleKey(user?.role);
    if (!roleKey) return [];
    return navigation.filter((item) => item.roles.includes(roleKey));
  }, [navigation, user?.role]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const roleKey = normalizeRoleKey(user?.role);
  const roleLabel = roleKey ? t(roleKey) : '';

  return (
    <div className="shell-container font-['Segoe_UI',_Arial,_sans-serif] bg-[#f6f8fb] dark:bg-slate-950 h-screen overflow-hidden flex flex-col md:flex-row relative transition-colors duration-300">
      {/* Premium Background Flair (Landing Page Style) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-600/5 rounded-full blur-[120px] animate-pulse-subtle" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-600/5 rounded-full blur-[120px] animate-pulse-subtle" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-cyan-500/5 dark:bg-cyan-600/10 rounded-full blur-[120px]" />

        {/* Subtle grid pattern for landing page resemblance */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] dark:opacity-[0.03] brightness-100 contrast-150 pointer-events-none" />
      </div>

      {/* ========================
          SIDEBAR (Desktop)
      ======================== */}
      <aside
        className="hidden md:flex flex-col z-50 w-[280px] h-full flex-shrink-0 transition-all duration-300 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800"
      >
        {/* Sidebar Header (Logo) */}
        <div className="h-[72px] flex items-center px-6 border-b border-slate-200 dark:border-slate-800 relative">
          <Link to="/dashboard" className="flex items-center gap-3.5 group">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#0b3b68]/15 bg-[#eef5fb] text-[#0b3b68] dark:bg-slate-900 dark:text-sky-300">
              <ShieldCheck className="h-6 w-6" strokeWidth={2.1} />
            </span>
            <span className="whitespace-nowrap">
              <span className="block text-[16px] font-bold text-[#27384a] dark:text-white">Clear2Work</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
                Giriş Kontrol Sistemi
              </span>
            </span>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 py-7 space-y-8 overflow-y-auto no-scrollbar">
          {/* Main Menu Section */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.07em] font-bold text-[#7c8997] px-6 mb-3">
              {t('mainMenu')}
            </p>
            <nav>
              {filteredNav.map((item) => {
                const Icon = item.icon;
                const [itemPath, itemHash = ''] = item.path.split('#');
                const isActive = itemHash
                  ? location.pathname === itemPath && location.hash === `#${itemHash}`
                  : location.pathname === itemPath && !location.hash;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex min-h-[48px] items-center border-l-[3px] py-3 px-6 gap-4 transition-colors group relative ${isActive
                      ? 'border-[#0a4f83] bg-[#edf3f8] text-[#0a4f83] dark:bg-sky-950/40 dark:text-sky-300'
                      : 'border-transparent text-[#34495e] hover:bg-[#f3f7fa] hover:text-[#0a4f83] dark:text-slate-400 dark:hover:bg-slate-900'
                      }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={isActive ? 2 : 1.7} />
                    <span className="font-semibold text-[14px] leading-5 whitespace-nowrap">{item.name}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>

        {/* User Account Section */}
        <div className="p-5 mt-auto border-t border-slate-200 dark:border-slate-800">
          <p className="hidden">
            {t('account')}
          </p>
          <div className="flex items-center gap-4 group">
            <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
              <div className="w-full h-full bg-[#dceaf7] dark:bg-slate-800 flex items-center justify-center text-[#0b4f87] dark:text-sky-300 font-bold text-sm">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-slate-900 dark:text-white truncate">{user?.full_name}</p>
                <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================
          NESTED CONTENT PANEL
      ======================== */}
      <main className="flex-1 flex flex-col bg-[#f6f8fb] dark:bg-slate-950 overflow-hidden relative transition-colors duration-300">
        {/* Subtle background flair inside panel */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/20 dark:bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

        {/* Header inside Panel */}
        <header className="hidden md:flex items-center justify-end h-[72px] px-7 flex-shrink-0 relative z-20 bg-[#0a3b67] border-b border-[#062d50] text-white">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                title={t('appearance')}
              >
                {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleLanguage}
                className="p-2.5 rounded-md hover:bg-white/10 transition-colors text-white/90 flex items-center justify-center min-w-[40px]"
                title={t('language')}
              >
                <span className="text-[10px] font-bold">
                  {i18n.language?.startsWith('tr') ? 'TR' : 'EN'}
                </span>
              </button>
            </div>

            <div className="h-6 w-px bg-white/20 mx-2" />

            {/* Notification Bell - Hide for Security Role */}
            {roleKey !== 'security' && (
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                >
                  <Bell className="w-5 h-5" />
                  {alerts.length > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>
                  )}
                </button>

                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                    <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('urgentAlerts')}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 uppercase">
                          {alerts.length} {t('alerts') || 'Alerts'}
                        </span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto p-3 space-y-1">
                        {alerts.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-xs italic">{t('noUrgentAlerts')}</div>
                        ) : (
                          alerts.map((alert, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setNotificationsOpen(false);
                                navigate(`/personnel/${alert.personnel_id}`);
                              }}
                              className="w-full text-left p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-start gap-3 group border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                            >
                              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/10 flex items-center justify-center flex-shrink-0 text-red-500">
                                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                                  {alert.full_name}
                                </p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{alert.expiring_documents[0]?.document_type}</p>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <div className="w-1 h-1 rounded-full bg-red-500" />
                                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">{t('daysUntilExpiry', { days: alert.expiring_documents[0]?.days_until_expiry })}</p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Nested Content Scroll Area */}
        <div className="flex-1 overflow-y-auto px-3 pb-24 md:px-7 md:pb-8 custom-scrollbar relative z-10">
          <div className="max-w-[1600px] mx-auto py-6">
            {children}
          </div>
        </div>
      </main>

      {/* ========================
          MOBILE SECTION
      ======================== */}
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full z-[60] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 px-4 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eef5fb] text-[#0a3b67]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="font-bold text-lg text-[#17324d] dark:text-white">
            Clear<span className="text-[#0a4f83] dark:text-sky-300">2</span>Work
          </span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {
        mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[70] pt-16 pb-10 bg-white dark:bg-slate-950 animate-in fade-in slide-in-from-top-10 overflow-y-auto">
            <nav className="p-4 space-y-2">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl text-lg font-medium ${location.pathname === item.path
                      ? 'bg-slate-100 dark:bg-slate-800 text-black dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    <Icon className="w-6 h-6" />
                    {item.name}
                  </Link>
                )
              })}
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={toggleTheme} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium">
                  {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  {t('appearance')}
                </button>
                <button onClick={toggleLanguage} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium">
                  <div className="font-bold text-xs ring-1 ring-current px-1 rounded">{i18n.language?.startsWith('tr') ? 'TR' : 'EN'}</div>
                  {t('language')}
                </button>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-4 w-full text-red-600 font-medium">
                <LogOut className="w-6 h-6" />
                {t('logout')}
              </button>
            </nav>
          </div>
        )
      }
    </div >
  );
};

export default Layout;
