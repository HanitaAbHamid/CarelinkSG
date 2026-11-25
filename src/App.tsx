import { useCallback, useEffect, useState } from 'react';
import {
  CloudOff,
  Globe,
  HeartHandshake,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wifi,
} from 'lucide-react';
import type { AppStateResponse, UiLang, UserRole } from './types';
import { apiRequest, flushOfflineQueue, getCachedState, getOfflineQueue } from './lib/api';
import { UI_LANGUAGES, t } from './lib/i18n';
import { HelperView } from './components/HelperView';
import { FamilyHubView } from './components/FamilyHubView';
import { SeniorView } from './components/SeniorView';
import { EmergencyModal } from './components/EmergencyModal';
import { VoiceBridgeSheet } from './components/VoiceBridgeSheet';
import { VitalsSnapModal } from './components/VitalsSnapModal';
import { PharmacyOcrModal } from './components/PharmacyOcrModal';
import { ClinicCoPilotModal } from './components/ClinicCoPilotModal';

const ROLE_OPTIONS: Array<{ role: UserRole; actor: string; label: string; defaultLang: UiLang }> = [
  { role: 'helper', actor: 'Siti Rahayu', label: 'Helper (Siti)', defaultLang: 'id' },
  { role: 'family_admin', actor: 'Benny Lim', label: 'Family Admin (Benny)', defaultLang: 'en' },
  { role: 'family_member', actor: 'Mei Ling Lim', label: 'Sibling (Mei Ling)', defaultLang: 'en' },
  { role: 'senior', actor: 'Mdm Tan Siew Lan', label: 'Senior (Ah Ma)', defaultLang: 'zh' },
];

export function App() {
  const [role, setRole] = useState<UserRole>('helper');
  const [actor, setActor] = useState<string>('Siti Rahayu');
  const [lang, setLang] = useState<UiLang>('id');
  const [state, setState] = useState<AppStateResponse | null>(() => getCachedState());
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState<number>(() => getOfflineQueue().length);
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [pharmacyOpen, setPharmacyOpen] = useState(false);
  const [clinicOpen, setClinicOpen] = useState(false);
  const [clinicTab, setClinicTab] = useState<'brief' | 'update'>('brief');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const loadState = useCallback(async () => {
    setLoading(true);
    const res = await apiRequest<AppStateResponse>('/state', { role, actor });
    if (res.data) {
      setState(res.data);
    }
    setQueuedCount(getOfflineQueue().length);
    setLoading(false);
  }, [role, actor]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    async function handleOnline() {
      setOnline(true);
      const flushed = await flushOfflineQueue();
      setQueuedCount(getOfflineQueue().length);
      if (flushed > 0) {
        showToast(`Back online — synced ${flushed} queued care log(s).`);
        void loadState();
      }
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadState, showToast]);

  function switchRole(nextRole: UserRole) {
    const preset = ROLE_OPTIONS.find((r) => r.role === nextRole);
    setRole(nextRole);
    if (preset) {
      setActor(preset.actor);
      setLang(preset.defaultLang);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-md no-print">
        <div className="mx-auto max-w-3xl px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white shadow-xs">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-slate-950 leading-none">
                  CareLink <span className="text-teal-700">SG</span>
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-semibold text-slate-500">
                  {online ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Wifi className="h-3 w-3" /> {t(lang, 'synced')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <CloudOff className="h-3 w-3" /> {t(lang, 'offlineQueued')}
                    </span>
                  )}
                  {queuedCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      {queuedCount} queued
                    </span>
                  )}
                  {state && (
                    <span className="hidden sm:inline-flex items-center gap-0.5 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-slate-600">
                      <Sparkles className="h-2.5 w-2.5 text-teal-700" />
                      {state.aiMode === 'gemini' ? 'Gemini Live' : 'Offline-Ready AI'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Globe className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-500" />
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as UiLang)}
                  aria-label="Interface language"
                  className="rounded-xl border border-stone-300 bg-white pl-7 pr-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  {UI_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setEmergencyOpen(true)}
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-rose-700 flex items-center gap-1"
              >
                <ShieldAlert className="h-3.5 w-3.5" /> 995
              </button>
            </div>
          </div>

          {/* Role Perspective Switcher (RBAC Live Demo Bar) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.role}
                type="button"
                onClick={() => switchRole(opt.role)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                  role === opt.role
                    ? 'bg-slate-900 text-white'
                    : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadState()}
              className="ml-auto shrink-0 rounded-full p-1.5 text-slate-500 hover:bg-stone-100"
              aria-label="Refresh care state"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-28 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl border border-teal-500/40 max-w-md text-center">
          {toast}
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-5">
        {!state ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center space-y-2">
            <RefreshCw className="h-7 w-7 animate-spin text-teal-700 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Loading CareLink SG...</p>
          </div>
        ) : role === 'helper' ? (
          <HelperView
            state={state}
            lang={lang}
            onRefresh={() => void loadState()}
            onOpenVoice={() => setVoiceOpen(true)}
            onOpenVitals={() => setVitalsOpen(true)}
            onOpenPharmacy={() => setPharmacyOpen(true)}
            onOpenClinic={(tab) => {
              setClinicTab(tab);
              setClinicOpen(true);
            }}
            onOpenEmergency={() => setEmergencyOpen(true)}
            onToast={showToast}
          />
        ) : role === 'senior' ? (
          <SeniorView
            state={state}
            onOpenVoice={() => setVoiceOpen(true)}
            onOpenEmergency={() => setEmergencyOpen(true)}
          />
        ) : (
          <FamilyHubView
            state={state}
            role={role}
            actor={actor}
            onRefresh={() => void loadState()}
            onOpenClinic={(tab) => {
              setClinicTab(tab);
              setClinicOpen(true);
            }}
            onOpenVitals={() => setVitalsOpen(true)}
            onOpenPharmacy={() => setPharmacyOpen(true)}
            onToast={showToast}
          />
        )}

        <footer className="mt-8 border-t border-stone-200 pt-4 text-center text-[11px] text-slate-500 no-print">
          {t(lang, 'nonDiagnostic')} • Singapore (`ap-southeast-1`)
        </footer>
      </main>

      {/* Modals */}
      {state && (
        <>
          <EmergencyModal
            open={emergencyOpen}
            onClose={() => setEmergencyOpen(false)}
            household={state.household}
            members={state.members}
            lang={lang}
            role={role}
            actor={actor}
            onTriggered={() => void loadState()}
          />
          <VoiceBridgeSheet
            open={voiceOpen}
            onClose={() => setVoiceOpen(false)}
            defaultFromLang={lang}
            role={role}
          />
          <VitalsSnapModal
            open={vitalsOpen}
            onClose={() => setVitalsOpen(false)}
            role={role}
            actor={actor}
            onSaved={() => void loadState()}
          />
          <PharmacyOcrModal
            open={pharmacyOpen}
            onClose={() => setPharmacyOpen(false)}
            role={role}
            actor={actor}
            onSubmitted={() => {
              showToast('Pharmacy label parsed & sent to Family Approval Inbox.');
              void loadState();
            }}
          />
          <ClinicCoPilotModal
            open={clinicOpen}
            onClose={() => setClinicOpen(false)}
            role={role}
            actor={actor}
            initialTab={clinicTab}
            onUpdated={() => void loadState()}
          />
        </>
      )}
    </div>
  );
}
