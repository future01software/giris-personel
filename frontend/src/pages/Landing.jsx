import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ShieldCheck,
    Users,
    Zap,
    BarChart3,
    ArrowRight,
    Clock,
    CheckCircle2,
    Moon,
    Sun,
    HelpCircle,
    Mail,
    Languages
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const Landing = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useTheme();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'tr' ? 'en' : 'tr';
        i18n.changeLanguage(newLang);
        localStorage.setItem('CLEAR2WORK_LANG', newLang);
    };

    const localImages = [
        '/assets/landing/port.png',
        '/assets/landing/construction.png',
        '/assets/landing/containers.png',
        '/assets/landing/crane.png',
        '/assets/landing/warehouse.png',
    ];

    const slidingImages = [...localImages, ...localImages, ...localImages, ...localImages];

    return (
        <div className="min-h-screen bg-white dark:bg-[#050505] text-slate-900 dark:text-white font-['Outfit',_sans-serif] selection:bg-slate-200 dark:selection:bg-white/10 overflow-hidden relative transition-colors duration-500">

            {/* Background - Central Sliding Strip with enhanced Dark Mode depth */}
            <div className="image-strip absolute inset-x-0 top-1/2 -translate-y-1/2 z-0 opacity-[0.9] dark:opacity-[0.35] pointer-events-none">

                <div className="flex gap-4 animate-slide-left whitespace-nowrap mb-4">
                    {slidingImages.map((src, i) => (
                        <div key={`row1-${i}`} className="w-[160px] h-[220px] md:w-[200px] md:h-[280px] rounded-[2.5rem] overflow-hidden flex-shrink-0 shadow-2xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                            <img src={src} alt="" className="w-full h-full object-cover dark:brightness-75 dark:contrast-125" loading="lazy" />
                        </div>
                    ))}
                    {slidingImages.map((src, i) => (
                        <div key={`row1-dup-${i}`} className="w-[160px] h-[220px] md:w-[200px] md:h-[280px] rounded-[2.5rem] overflow-hidden flex-shrink-0 shadow-2xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                            <img src={src} alt="" className="w-full h-full object-cover dark:brightness-75 dark:contrast-125" loading="lazy" />
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 animate-slide-right whitespace-nowrap">
                    {slidingImages.map((src, i) => (
                        <div key={`row2-${i}`} className="w-[160px] h-[220px] md:w-[200px] md:h-[280px] rounded-[2.5rem] overflow-hidden flex-shrink-0 shadow-2xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                            <img src={src} alt="" className="w-full h-full object-cover dark:brightness-75 dark:contrast-125" loading="lazy" />
                        </div>
                    ))}
                    {slidingImages.map((src, i) => (
                        <div key={`row2-dup-${i}`} className="w-[160px] h-[220px] md:w-[200px] md:h-[280px] rounded-[2.5rem] overflow-hidden flex-shrink-0 shadow-2xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                            <img src={src} alt="" className="w-full h-full object-cover dark:brightness-75 dark:contrast-125" loading="lazy" />
                        </div>
                    ))}
                </div>

                {/* Dynamic Overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-white via-white/50 to-white dark:from-[#050505] dark:via-transparent dark:to-[#050505]" />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-white dark:from-[#050505] dark:via-transparent dark:to-[#050505]" />
                <div className="absolute inset-0 dark:bg-black/20" />
            </div>

            {/* Navigation */}
            <nav className="relative z-50 w-full px-8 md:px-12 h-28 flex items-center justify-between">
                <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/')}>
                    <img src="/logo.png" alt="" className="w-10 h-10 object-contain filter drop-shadow-xl dark:brightness-0 dark:invert dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-105" />
                    <span className="text-2xl font-['Pacifico',_cursive] text-slate-800 dark:text-white transition-colors">
                        Clear<span className="text-slate-500 dark:text-slate-400 ml-1 transition-colors">2Work</span>
                    </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Language & Theme Toggles integrated into Nav */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2">
                        <button onClick={toggleLanguage} className="h-8 w-[52px] rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                            <Languages className="w-3 h-3 dark:text-slate-400" />
                            <span className="font-bold text-[9px] uppercase dark:text-white/80">{i18n.language}</span>
                        </button>
                        <button onClick={toggleTheme} className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-slate-400" /> : <Moon className="w-3.5 h-3.5 text-slate-800" />}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <Button variant="ghost" className="text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg w-[85px] sm:w-[110px] text-xs sm:text-sm transition-all" onClick={() => navigate('/login')}>
                            {t('login')}
                        </Button>
                        <Button className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 w-[115px] sm:w-[155px] h-9 sm:h-10 rounded-lg font-bold shadow-lg text-xs sm:text-sm hover:translate-y-[-1px] transition-all active:scale-95" onClick={() => navigate('/login')}>
                            {t('startNow')}
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-12 pb-20 px-6 max-w-5xl mx-auto text-center space-y-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-white animate-pulse" />
                        <span className="text-[9px] font-bold tracking-widest text-slate-800 dark:text-slate-100" style={{ textTransform: 'uppercase', fontVariantCaps: 'all-small-caps' }} lang="en">{t('industrialSystem')}</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black leading-[1.1] tracking-tighter text-slate-900 dark:text-white uppercase transition-colors">
                        {t('heroTitle1')} <br />
                        <span className="opacity-70 dark:opacity-50 font-bold">{t('heroTitle2')}</span>
                    </h1>

                    <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed dark:font-light">
                        {t('heroSubtitle')}
                    </p>
                </motion.div>

                <div className="flex justify-center pt-4">
                    <Button
                        size="lg"
                        className="h-16 px-12 bg-slate-950 dark:bg-white dark:text-slate-950 text-white rounded-3xl text-xl font-black shadow-2xl dark:shadow-white/10 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 group"
                        onClick={() => navigate('/login')}
                    >
                        <Zap className="w-6 h-6 fill-current" />
                        {t('startNow')}
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </Button>
                </div>

                {/* Status Badges with enhanced dark mode styling */}
                <div className="pt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/90 dark:bg-white/5 border border-slate-100 dark:border-white/10 shadow-xl dark:shadow-none hover:border-slate-300 dark:hover:border-white/20 transition-all hover:scale-105">
                        <ShieldCheck className="w-5 h-5" />
                        {t('safeInfra')}
                    </div>
                    <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-100 shadow-xl dark:shadow-none hover:scale-105 transition-all">
                        <CheckCircle2 className="w-5 h-5" />
                        {t('freeUsage')}
                    </div>
                    <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/90 dark:bg-white/5 border border-slate-100 dark:border-white/10 shadow-xl dark:shadow-none hover:border-slate-300 dark:hover:border-white/20 transition-all hover:scale-105">
                        <Clock className="w-5 h-5" />
                        {t('nonStopTrack')}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="relative z-10 pb-32 px-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { icon: <ShieldCheck />, title: t('highSecurity'), desc: t('highSecurityDesc') },
                    { icon: <Clock />, title: t('realTimeTrack'), desc: t('realTimeTrackDesc') },
                    { icon: <BarChart3 />, title: t('smartReporting'), desc: t('smartReportingDesc') }
                ].map((f, i) => (
                    <div key={i} className="p-10 rounded-[3rem] bg-white dark:bg-[#0A0A0A] border border-slate-50 dark:border-white/10 shadow-2xl dark:shadow-none backdrop-blur-xl text-center space-y-4 hover:-translate-y-2 hover:border-slate-200 dark:hover:border-white/30 transition-all group">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-950/5 dark:bg-white/5 text-slate-950 dark:text-white flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            {React.cloneElement(f.icon, { className: "w-8 h-8" })}
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white transition-colors">{f.title}</h3>
                        <p className="text-slate-500 dark:text-slate-500 font-bold text-sm leading-relaxed group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">{f.desc}</p>
                    </div>
                ))}
            </section>

            <style dangerouslySetInnerHTML={{
                __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pacifico&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes slide-left { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes slide-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
        .animate-slide-left { animation: slide-left 140s linear infinite; width: fit-content; }
        .animate-slide-right { animation: slide-right 140s linear infinite; width: fit-content; }
        .dark { color-scheme: dark; }
      `}} />
        </div>
    );
};

export default Landing;
