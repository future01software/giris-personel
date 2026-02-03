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
  ChevronLeft,
  ChevronRight,
  Settings
} from 'lucide-react';

import { toTurkishUpperCase } from '../utils/textHelpers';
import { Button } from './ui/button';
import { Input } from './ui/input';

const LANG_KEY = 'CLEAR2WORK_LANG';

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

  const { isDark, setTheme, toggleTheme } = useTheme();
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

  const dark = isDark;
  const isTR = i18n.language?.startsWith('tr');

  const upper = (text) => {
    const s = String(text || '');
    return isTR ? toTurkishUpperCase(s) : s.toUpperCase();
  };

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

  const handleLogout = () => {
    logout();
    localStorage.removeItem('clear2work_theme');
    document.documentElement.classList.remove('dark');
    setTheme('light');
    navigate('/login');
  };

  const navigation = useMemo(
    () => [
      { name: t('dashboard'), path: '/dashboard', icon: BarChart3, roles: ['admin', 'supervisor'] },
      { name: t('personnel'), path: '/personnel', icon: IdCard, roles: ['admin'] },
      { name: t('entryCheck'), path: '/entry-check', icon: DoorOpen, roles: ['admin'] },
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans text-slate-900 dark:text-slate-100 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent dark:from-blue-900/10 pointer-events-none" />


      {/* ========================
          SIDEBAR (Desktop)
      ======================== */}
      <aside
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
        className={`hidden md:flex flex-col fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'
          }`}
      >
        {/* Sidebar Header (Logo) */}
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-slate-800 relative">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 transform transition-transform hover:scale-105">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400">
                Clear2Work
              </span>
            )}
          </Link>

          {/* Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-sm hover:shadow-md transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                // onClick={() => setSidebarOpen(false)} // Removed to prevent immediate closing on click; let onMouseLeave handle it.
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative overflow-hidden ${isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`}
                title={!sidebarOpen ? item.name : ''}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'stroke-[1.5]'}`} />
                {sidebarOpen && (
                  <span className="font-medium text-sm whitespace-nowrap">{item.name}</span>
                )}

                {/* Active Indicator for collapsed mode */}
                {!sidebarOpen && isActive && (
                  <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-orange-500" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60`}
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {sidebarOpen && <span className="font-medium text-sm">{t('appearance')}</span>}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60`}
          >
            <div className="w-5 h-5 flex items-center justify-center font-bold text-xs ring-1 ring-slate-300 dark:ring-slate-600 rounded">
              {i18n.language?.startsWith('tr') ? 'TR' : 'EN'}
            </div>
            {sidebarOpen && <span className="font-medium text-sm">{t('language')}</span>}
          </button>

          {/* User Profile */}
          <div className={`mt-4 flex items-center ${sidebarOpen ? 'gap-3 px-2' : 'justify-center'} py-2`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5">
              <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-bold">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">{user?.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{upper(roleLabel)}</p>
              </div>
            )}
            {sidebarOpen && (
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-600 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ========================
          MOBILE HEADER
      ======================== */}
      <div className="md:hidden fixed top-0 w-full z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 px-4 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white dark:text-black" />
          </div>
          <span className="font-bold text-lg">C2W</span>
        </Link>

        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* ========================
          MOBILE MENU OVERLAY
      ======================== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 pt-16 pb-10 bg-white dark:bg-slate-950 animate-in fade-in slide-in-from-top-10 overflow-y-auto">
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
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium"
              >
                {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                {t('appearance')}
              </button>

              <button
                onClick={toggleLanguage}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium"
              >
                <div className="font-bold text-xs ring-1 ring-current px-1 rounded">
                  {i18n.language?.startsWith('tr') ? 'TR' : 'EN'}
                </div>
                {t('language')}
              </button>
            </div>

            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-4 w-full text-red-600 font-medium">
              <LogOut className="w-6 h-6" />
              {t('logout')}
            </button>
          </nav>
        </div>
      )}


      {/* ========================
          MAIN CONTENT AREA
      ======================== */}
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>

        {/* TOP HEADER (Desktop) */}
        <header className="hidden md:flex items-center justify-between h-20 px-8 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-30">

          {/* Search Bar */}
          {/* Search Bar Removed as per request */}
          <div className="flex-1" />

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
              >
                <Bell className="w-5 h-5" />
                {alerts.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                )}
              </button>

              {/* Notification Popover */}
              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('urgentAlerts')}</h3>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        {alerts.length}
                      </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                      {alerts.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-xs">
                          {t('noUrgentAlerts')}
                        </div>
                      ) : (
                        alerts.map((alert, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setNotificationsOpen(false);
                              navigate(`/personnel/${alert.personnel_id}`);
                            }}
                            className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-3 group"
                          >
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 text-red-600 dark:text-red-400">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                                {alert.full_name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {alert.expiring_documents[0]?.document_type}
                              </p>
                              <p className="text-[10px] font-bold text-red-500 mt-1">
                                {alert.expiring_documents[0]?.days_until_expiry} days left
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
            <div className="flex items-center gap-3">
              {/* Profile Removed from Header (Moved to Sidebar Bottom) */}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 md:p-8 pt-20 md:pt-8 bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
          {children}
        </div>

      </main>
    </div>
  );
};

export default Layout;
