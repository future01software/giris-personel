import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    Languages,
    Moon,
    ShieldCheck,
    Sun,
    UsersRound
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const Landing = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useTheme();

    const toggleLanguage = () => {
        const newLang = i18n.language?.startsWith('tr') ? 'en' : 'tr';
        i18n.changeLanguage(newLang);
        localStorage.setItem('CLEAR2WORK_LANG', newLang);
    };

    const features = [
        { icon: ShieldCheck, title: t('highSecurity'), desc: t('highSecurityDesc') },
        { icon: Clock3, title: t('realTimeTrack'), desc: t('realTimeTrackDesc') },
        { icon: BarChart3, title: t('smartReporting'), desc: t('smartReportingDesc') }
    ];

    return (
        <div className="min-h-screen overflow-hidden bg-[#f4f8fc] text-[#10233b] dark:bg-[#07111d] dark:text-white transition-colors">
            <header className="relative z-30 border-b border-[#dbe6f0] bg-white/95 dark:border-white/10 dark:bg-[#091827]/95 backdrop-blur">
                <div className="mx-auto flex h-[72px] max-w-[1380px] items-center justify-between px-5 sm:px-8">
                    <button onClick={() => navigate('/')} className="flex items-center gap-3 text-left">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbddeb] bg-[#edf6fc]">
                            <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
                        </span>
                        <span>
                            <span className="block text-base font-extrabold tracking-tight text-[#10233b] dark:text-white">
                                Clear2Work
                            </span>
                            <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#60758c] dark:text-slate-400">
                                {t('entryControlSystem')}
                            </span>
                        </span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleLanguage}
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#d9e4ee] bg-white px-3 text-xs font-bold text-[#35516d] hover:bg-[#f2f7fb] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <Languages className="h-3.5 w-3.5" />
                            {i18n.language?.startsWith('tr') ? 'TR' : 'EN'}
                        </button>
                        <button
                            onClick={toggleTheme}
                            aria-label={theme === 'dark' ? t('lightTheme') : t('darkTheme')}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d9e4ee] bg-white text-[#35516d] hover:bg-[#f2f7fb] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="ml-1 h-9 rounded-lg bg-[#0b4b79] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#083c63]"
                        >
                            {t('login')}
                        </button>
                    </div>
                </div>
            </header>

            <main>
                <section className="relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(54,143,204,0.12),transparent_34%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(54,143,204,0.18),transparent_36%)]" />
                    <div className="relative mx-auto grid max-w-[1380px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="max-w-2xl"
                        >
                            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c9deed] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b5f93] shadow-sm dark:border-sky-400/20 dark:bg-white/5 dark:text-sky-300">
                                <ShieldCheck className="h-4 w-4" />
                                {t('industrialSystem')}
                            </div>
                            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.035em] text-[#10233b] sm:text-5xl lg:text-[58px] dark:text-white">
                                {t('heroTitle1')}
                                <span className="mt-2 block text-[#0b5f93] dark:text-sky-300">{t('heroTitle2')}</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-base leading-7 text-[#60758c] sm:text-lg dark:text-slate-300">
                                {t('heroSubtitle')}
                            </p>
                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="group flex h-12 items-center gap-3 rounded-xl bg-[#0b4b79] px-7 text-sm font-bold text-white shadow-[0_10px_24px_rgba(11,75,121,0.2)] hover:bg-[#083c63]"
                                >
                                    {t('login')}
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </button>
                                <div className="flex items-center gap-2 px-2 text-sm font-medium text-[#50677f] dark:text-slate-300">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    {t('authorizedAccess')}
                                </div>
                            </div>

                            <div className="mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                                {[
                                    [ShieldCheck, t('safeInfra')],
                                    [UsersRound, t('authorizedAccess')],
                                    [Clock3, t('nonStopTrack')]
                                ].map(([Icon, label]) => (
                                    <div key={label} className="flex items-center gap-2 rounded-xl border border-[#dbe6f0] bg-white/80 px-3 py-3 text-xs font-bold text-[#35516d] dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                                        <Icon className="h-4 w-4 text-[#0b5f93] dark:text-sky-300" />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 18 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.55 }}
                            className="relative mx-auto w-full max-w-[620px]"
                        >
                            <div className="absolute -inset-5 rounded-[36px] bg-[#dcecf7]/70 blur-2xl dark:bg-sky-900/20" />
                            <div className="relative overflow-hidden rounded-[28px] border border-white bg-white p-3 shadow-[0_24px_70px_rgba(38,73,104,0.18)] dark:border-white/10 dark:bg-[#0b1c2c]">
                                <motion.img
                                    src="/assets/landing/port.png"
                                    alt=""
                                    className="h-[390px] w-full rounded-[20px] object-cover sm:h-[470px]"
                                    animate={{ scale: [1, 1.035, 1], x: [0, -4, 0] }}
                                    transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
                                />
                                <div className="absolute inset-3 rounded-[20px] bg-gradient-to-t from-[#071b2b]/75 via-transparent to-transparent" />
                                <motion.div
                                    className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/30 bg-white/90 p-5 shadow-xl backdrop-blur dark:bg-[#0a1b2b]/90"
                                    animate={{ y: [0, -5, 0] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-[#6a7f93] dark:text-slate-400">{t('liveSystem')}</p>
                                            <p className="mt-1 text-lg font-extrabold text-[#10233b] dark:text-white">{t('entryControlCenter')}</p>
                                        </div>
                                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                                            <ShieldCheck className="h-6 w-6" />
                                        </span>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="border-t border-[#dbe6f0] bg-white/80 py-14 dark:border-white/10 dark:bg-[#091827]/70">
                    <div className="mx-auto grid max-w-[1180px] gap-5 px-5 sm:px-8 md:grid-cols-3">
                        {features.map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="rounded-2xl border border-[#dbe6f0] bg-white p-6 shadow-[0_8px_30px_rgba(27,62,94,0.06)] dark:border-white/10 dark:bg-white/5">
                                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf4fb] text-[#0b5f93] dark:bg-sky-400/10 dark:text-sky-300">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <h2 className="text-lg font-extrabold text-[#10233b] dark:text-white">{title}</h2>
                                <p className="mt-2 text-sm leading-6 text-[#6a7f93] dark:text-slate-400">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Landing;
