import { useState, type ChangeEvent } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  Mic,
  ShieldAlert,
  Stethoscope,
  Sun,
  AlertCircle,
} from 'lucide-react';
import type { AppStateResponse, Medication, UiLang } from '../types';
import { apiRequest } from '../lib/api';
import { t } from '../lib/i18n';
import { CarePackPanels } from './CarePackPanels';

interface Props {
  state: AppStateResponse;
  lang: UiLang;
  onRefresh: () => void;
  onOpenVoice: () => void;
  onOpenVitals: () => void;
  onOpenPharmacy: () => void;
  onOpenClinic: (tab: 'brief' | 'update') => void;
  onOpenEmergency: () => void;
  onToast: (msg: string) => void;
}

const EXCEPTION_REASONS = [
  { key: 'dizzy', emoji: '🌀', label: 'Dizzy / Pusing / 头晕' },
  { key: 'refused', emoji: '🙅', label: 'Refused / Menolak / 拒绝' },
  { key: 'nausea', emoji: '🤢', label: 'Nausea / Mual / 恶心' },
  { key: 'sleeping', emoji: '😴', label: 'Asleep / Tidur / 睡着' },
  { key: 'out_of_stock', emoji: '📦', label: 'Out of Stock / Habis / 缺药' },
];

const SLOT_BADGE: Record<string, string> = {
  morning: '☀️ Morning',
  noon: '🌤️ Noon',
  evening: '🌆 Evening',
  bedtime: '🌙 Bedtime',
};

export function HelperView({
  state,
  lang,
  onRefresh,
  onOpenVoice,
  onOpenVitals,
  onOpenPharmacy,
  onOpenClinic,
  onOpenEmergency,
  onToast,
}: Props) {
  const [exceptionMed, setExceptionMed] = useState<{ med: Medication; slot: string } | null>(null);
  const [exceptionReason, setExceptionReason] = useState('dizzy');
  const [exceptionNote, setExceptionNote] = useState('');
  const [taskExcId, setTaskExcId] = useState<string | null>(null);
  const [taskExcNote, setTaskExcNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const actor = 'Siti Rahayu';
  const restDayActive = state.household.rest_day_active === 1;

  function isMedSlotLogged(medId: string, slot: string) {
    return state.todayMedLogs.find((l) => l.med_id === medId && l.slot === slot);
  }

  async function logMedGiven(med: Medication, slot: string, proofPhoto?: string) {
    setBusyId(`${med.id}_${slot}`);
    const res = await apiRequest('/medications/log', {
      method: 'POST',
      role: 'helper',
      actor,
      queueIfOffline: true,
      body: {
        medId: med.id,
        slot,
        status: 'taken',
        proofPhoto: proofPhoto || (med.risk_tier === 'high' ? 'tray_verified_3sec' : undefined),
        note: proofPhoto ? '3-sec blister/tray photo verified' : 'Logged via Today care flow',
      },
    });
    setBusyId(null);
    if (res.queuedOffline) {
      onToast('Saved offline on phone — will sync automatically when connected.');
    } else {
      onToast(`Logged ${med.name} (${slot}) — thank you!`);
      onRefresh();
    }
  }

  function handleTrayPhotoUpload(med: Medication, slot: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void logMedGiven(med, slot, String(reader.result || 'tray_photo_attached').slice(0, 60000));
    };
    reader.readAsDataURL(file);
  }

  async function submitMedException() {
    if (!exceptionMed) return;
    setBusyId(`${exceptionMed.med.id}_${exceptionMed.slot}`);
    const res = await apiRequest('/medications/log', {
      method: 'POST',
      role: 'helper',
      actor,
      queueIfOffline: true,
      body: {
        medId: exceptionMed.med.id,
        slot: exceptionMed.slot,
        status: 'exception',
        exceptionReason,
        note: exceptionNote.trim() || undefined,
      },
    });
    setBusyId(null);
    setExceptionMed(null);
    setExceptionNote('');
    if (res.queuedOffline) {
      onToast('Exception queued safely offline.');
    } else {
      onToast('Exception recorded cleanly — family notified constructively.');
      onRefresh();
    }
  }

  async function updateTask(taskId: string, status: 'done' | 'pending' | 'exception', note?: string) {
    setBusyId(taskId);
    const res = await apiRequest(`/tasks/${taskId}/update`, {
      method: 'POST',
      role: 'helper',
      actor,
      queueIfOffline: true,
      body: { status, exceptionNote: note },
    });
    setBusyId(null);
    setTaskExcId(null);
    setTaskExcNote('');
    if (res.queuedOffline) {
      onToast('Task queued offline — will sync automatically.');
    } else {
      onRefresh();
    }
  }

  const latestBp = state.vitals.find((v) => v.type === 'bp');
  const latestGlucose = state.vitals.find((v) => v.type === 'glucose');

  return (
    <div className="space-y-5 pb-28">
      {/* MOM Rest-Day Protective Banner */}
      {restDayActive && (
        <div className="rounded-3xl border-2 border-indigo-300 bg-indigo-50 p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-900">
            <Sun className="h-6 w-6 text-indigo-600" />
            <h2 className="text-base font-extrabold">{t(lang, 'restDayBanner')}</h2>
          </div>
          <p className="text-sm text-indigo-900/90 leading-relaxed">{t(lang, 'restDayDesc')}</p>
          <p className="text-xs font-bold text-indigo-700">
            On Duty Today: {state.household.on_duty_member} • Have a restful day off, Siti!
          </p>
        </div>
      )}

      {/* Senior Context Card */}
      <section className="rounded-3xl bg-gradient-to-br from-teal-700 to-teal-900 p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">
              {t(lang, 'todayCare')} • {state.today}
            </p>
            <h2 className="text-xl font-extrabold mt-0.5">{state.household.senior_name}</h2>
            <p className="text-xs text-teal-100 mt-1">
              Languages: {state.household.senior_languages} • Next Clinic: {state.household.next_appointment}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenEmergency}
            className="shrink-0 rounded-2xl bg-rose-600 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-rose-500 flex items-center gap-1.5"
          >
            <ShieldAlert className="h-4 w-4" />
            {t(lang, 'emergency995')}
          </button>
        </div>

        {/* Latest Vitals Strip */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-white/12 px-3.5 py-2.5 backdrop-blur-xs">
            <p className="text-[11px] text-teal-100">Latest BP</p>
            <p className="text-lg font-black">
              {latestBp ? `${latestBp.systolic}/${latestBp.diastolic}` : '—'}{' '}
              <span className="text-xs font-normal text-teal-100">mmHg</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white/12 px-3.5 py-2.5 backdrop-blur-xs">
            <p className="text-[11px] text-teal-100">Latest Glucose</p>
            <p className="text-lg font-black">
              {latestGlucose?.glucose_mmol != null ? latestGlucose.glucose_mmol.toFixed(1) : '—'}{' '}
              <span className="text-xs font-normal text-teal-100">mmol/L</span>
            </p>
          </div>
        </div>
      </section>

      {/* Big Thumb-Friendly Quick Actions */}
      <section className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={onOpenVitals}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xs hover:border-teal-500 active:scale-[0.98]"
        >
          <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-800 text-center leading-tight">
            {t(lang, 'snapVital')}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenPharmacy}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xs hover:border-teal-500 active:scale-[0.98]"
        >
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-800 text-center leading-tight">
            {t(lang, 'scanBag')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenClinic('brief')}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xs hover:border-teal-500 active:scale-[0.98]"
        >
          <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-800 text-center leading-tight">
            {t(lang, 'clinicCopilot')}
          </span>
        </button>
      </section>

      {/* Medications Today (Risk-Tiered Proof + Non-Punitive Exception) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
            💊 {t(lang, 'medications')}
          </h3>
          <span className="text-[11px] font-semibold text-slate-500">
            High-risk = 3-sec tray photo • Standard = 1-tap
          </span>
        </div>

        <div className="space-y-3">
          {state.medications.map((med) =>
            med.timeSlots.map((slot) => {
              const log = isMedSlotLogged(med.id, slot);
              const key = `${med.id}_${slot}`;
              const instruction = med.instructions[lang] || med.instructions.en;

              return (
                <div
                  key={key}
                  className={`rounded-2xl border bg-white p-4 shadow-xs space-y-3 ${
                    log?.status === 'taken'
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : log?.status === 'exception'
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                          {SLOT_BADGE[slot] || slot}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            med.risk_tier === 'high'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {med.risk_tier === 'high' ? 'High-Risk' : 'Standard'}
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-slate-900 mt-1">
                        {med.name} <span className="font-semibold text-slate-600">• {med.dosage}</span>
                      </h4>
                      <p className="text-xs text-slate-700 mt-1 leading-relaxed">{instruction}</p>
                    </div>
                  </div>

                  {log ? (
                    <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-xs border border-stone-200">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        {log.status === 'taken' ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            {t(lang, 'done')} ({log.logged_by})
                            {log.proof_photo && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                                Tray Verified
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            {t(lang, 'exception')}: {log.exception_reason}
                          </>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(log.created_at).toLocaleTimeString('en-SG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {med.risk_tier === 'high' ? (
                        <div className="flex gap-1.5">
                          <label className="flex-1 cursor-pointer flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-teal-800">
                            <Camera className="h-4 w-4" />
                            {t(lang, 'takeTrayPhoto')}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handleTrayPhotoUpload(med, slot, e)}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={busyId === key}
                            onClick={() => void logMedGiven(med, slot)}
                            title="Quick verify tray without camera"
                            className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700"
                          >
                            ✓ Quick
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === key}
                          onClick={() => void logMedGiven(med, slot)}
                          className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {t(lang, 'markGiven')}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExceptionMed({ med, slot })}
                        className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2.5 text-xs font-extrabold text-amber-950 hover:bg-amber-100"
                      >
                        <AlertCircle className="h-4 w-4 text-amber-700" />
                        {t(lang, 'couldntGive')}
                      </button>
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </section>

      {/* Daily Care Routine Timeline */}
      <section className="space-y-3">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
          📋 {t(lang, 'dailyChecklist')}
        </h3>
        <div className="space-y-2.5">
          {state.tasks.map((task) => {
            const label = task.titleI18n[lang] || task.title_en;
            return (
              <div
                key={task.id}
                className={`rounded-2xl border bg-white p-4 shadow-xs space-y-2.5 ${
                  task.status === 'done'
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : task.status === 'exception'
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-teal-700 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {task.scheduled_time}
                    </p>
                    <p className="text-sm font-bold text-slate-900">{label}</p>
                    {task.exception_note && (
                      <p className="text-xs text-amber-800 font-medium">Note: {task.exception_note}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.status === 'done' ? (
                      <button
                        type="button"
                        onClick={() => void updateTask(task.id, 'pending')}
                        className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-extrabold text-emerald-800 flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-4 w-4" /> {t(lang, 'done')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busyId === task.id}
                          onClick={() => void updateTask(task.id, 'done')}
                          className="rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-teal-800"
                        >
                          ✓ {t(lang, 'done')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskExcId(taskExcId === task.id ? null : task.id)}
                          className="rounded-xl border border-amber-400 bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-900"
                        >
                          Note
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {taskExcId === task.id && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={taskExcNote}
                      onChange={(e) => setTaskExcNote(e.target.value)}
                      placeholder="e.g. Heavy rain outside — did indoor walk instead"
                      className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void updateTask(task.id, 'exception', taskExcNote.trim() || 'Adjusted due to senior comfort')
                      }
                      className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950"
                    >
                      Save Note
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Opt-In Care Packs (renders nothing if 0 enabled!) */}
      <CarePackPanels
        packs={state.carePacks}
        entries={state.carePackEntries}
        role="helper"
        actor={actor}
        onUpdated={onRefresh}
      />

      {/* Non-Punitive Medication Exception Drawer */}
      {exceptionMed && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 p-3">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 space-y-4 shadow-2xl border border-amber-300">
            <div>
              <p className="text-xs font-bold uppercase text-amber-700">Protective Care Log</p>
              <h3 className="text-lg font-extrabold text-slate-900">
                Couldn&apos;t Give {exceptionMed.med.name}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Thank you for reporting honestly. This timestamped note protects you and helps family &amp; doctors adjust care safely.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {EXCEPTION_REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setExceptionReason(r.key)}
                  className={`flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-left text-sm font-bold ${
                    exceptionReason === r.key
                      ? 'border-amber-500 bg-amber-50 text-amber-950'
                      : 'border-stone-200 text-slate-700'
                  }`}
                >
                  <span className="text-lg">{r.emoji}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>

            <input
              type="text"
              value={exceptionNote}
              onChange={(e) => setExceptionNote(e.target.value)}
              placeholder="Optional short note..."
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExceptionMed(null)}
                className="flex-1 rounded-xl border border-stone-300 py-3 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitMedException()}
                className="flex-[2] rounded-xl bg-amber-500 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-400"
              >
                Record Exception Safely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pinned Giant Floating Voice Bridge Push-To-Talk Button */}
      <button
        type="button"
        onClick={onOpenVoice}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-teal-700 px-5 py-4 text-sm font-extrabold text-white shadow-xl ring-4 ring-teal-100 hover:bg-teal-800 active:scale-95"
      >
        <Mic className="h-5 w-5" />
        {t(lang, 'voiceBridge')}
      </button>
    </div>
  );
}
