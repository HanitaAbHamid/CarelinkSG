import { useState } from 'react';
import {
  Activity,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  Download,
  HeartPulse,
  Layers,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Users,
  Watch,
  X,
} from 'lucide-react';
import type { AppStateResponse, UserRole } from '../types';
import { apiRequest } from '../lib/api';
import { CarePackPanels } from './CarePackPanels';

interface Props {
  state: AppStateResponse;
  role: UserRole;
  actor: string;
  onRefresh: () => void;
  onOpenClinic: (tab: 'brief' | 'update') => void;
  onOpenVitals: () => void;
  onOpenPharmacy: () => void;
  onToast: (msg: string) => void;
}

export function FamilyHubView({
  state,
  role,
  actor,
  onRefresh,
  onOpenClinic,
  onOpenVitals,
  onOpenPharmacy,
  onToast,
}: Props) {
  const [tab, setTab] = useState<'overview' | 'health' | 'care' | 'settings'>('overview');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('15:00');
  const [savingThresholds, setSavingThresholds] = useState(false);

  // Editable clinician-set thresholds
  const [bpSysHigh, setBpSysHigh] = useState(String(state.thresholds.bpSysHigh));
  const [bpDiaHigh, setBpDiaHigh] = useState(String(state.thresholds.bpDiaHigh));
  const [glucoseHigh, setGlucoseHigh] = useState(String(state.thresholds.glucoseHigh));
  const [glucoseLow, setGlucoseLow] = useState(String(state.thresholds.glucoseLow));
  const [graceMins, setGraceMins] = useState(String(state.household.helper_grace_minutes));

  const isAdmin = role === 'family_admin';
  const pendingApprovals = state.approvals.filter((a) => a.status === 'pending');
  const completedTasks = state.tasks.filter((t) => t.status === 'done').length;
  const totalSlotsToday = state.medications.reduce((acc, m) => acc + m.timeSlots.length, 0);
  const takenToday = state.todayMedLogs.filter((l) => l.status === 'taken').length;
  const lowRefillMeds = state.medications.filter((m) => m.daysRemaining <= m.refill_alert_days);

  async function decideApproval(id: string, decision: 'approve' | 'reject') {
    const res = await apiRequest(`/approvals/${id}/decide`, {
      method: 'POST',
      role,
      actor,
      body: { decision },
    });
    if (res.error) {
      onToast(res.error);
      return;
    }
    onToast(
      decision === 'approve'
        ? 'Approved! Translated instructions are now live on Siti’s checklist.'
        : 'Pending update rejected and archived.',
    );
    onRefresh();
  }

  async function toggleRestDay(active: boolean, dutyMember: string) {
    const res = await apiRequest('/household/handoff', {
      method: 'POST',
      role,
      actor,
      body: { restDayActive: active, onDutyMember: dutyMember },
    });
    if (!res.error) {
      onToast(
        active
          ? `MOM Rest-Day Handoff active — ${dutyMember} owns today's care routine.`
          : 'Weekday schedule resumed — handed back to Siti Rahayu.',
      );
      onRefresh();
    }
  }

  async function simulateWearableSync(possibleFall = false) {
    await apiRequest('/vitals/wearable-sync', {
      method: 'POST',
      role,
      actor,
      body: {
        platform: 'apple_health',
        hrBpm: possibleFall ? 124 : 74,
        possibleFall,
      },
    });
    onToast(
      possibleFall
        ? 'Native Apple Watch fall trigger relayed — Tier 1 Red alert fired!'
        : 'Synced passive resting HR (74 bpm) via Apple Health.',
    );
    onRefresh();
  }

  async function ackAlert(id: string) {
    await apiRequest(`/alerts/${id}/ack`, { method: 'POST', role, actor });
    onRefresh();
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return;
    await apiRequest('/tasks', {
      method: 'POST',
      role,
      actor,
      body: { titleEn: newTaskTitle.trim(), scheduledTime: newTaskTime, category: 'exercise' },
    });
    setNewTaskTitle('');
    onToast('Added routine item to today’s schedule.');
    onRefresh();
  }

  async function saveThresholds() {
    setSavingThresholds(true);
    const res = await apiRequest('/household/thresholds', {
      method: 'PATCH',
      role,
      actor,
      body: {
        bpSysHigh: Number(bpSysHigh),
        bpDiaHigh: Number(bpDiaHigh),
        glucoseHigh: Number(glucoseHigh),
        glucoseLow: Number(glucoseLow),
        helperGraceMinutes: Number(graceMins),
      },
    });
    setSavingThresholds(false);
    if (res.error) onToast(res.error);
    else {
      onToast('Doctor-set safety thresholds updated.');
      onRefresh();
    }
  }

  async function togglePack(packKey: string, enabled: boolean) {
    const res = await apiRequest(`/care-packs/${packKey}/toggle`, {
      method: 'POST',
      role,
      actor,
      body: { enabled },
    });
    if (res.error) onToast(res.error);
    else {
      onToast(enabled ? 'Care Pack enabled for Ah Ma.' : 'Care Pack hidden from UI.');
      onRefresh();
    }
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Locked 4-Tab Family Navigation (Anti-Bloat Core) */}
      <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xs">
        {(
          [
            { id: 'overview', label: 'Calm Hub', icon: Bell, badge: pendingApprovals.length },
            { id: 'health', label: 'Health', icon: HeartPulse, badge: 0 },
            { id: 'care', label: 'Routine', icon: Users, badge: 0 },
            { id: 'settings', label: 'Packs & PDPA', icon: SlidersHorizontal, badge: 0 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl py-2.5 px-2 text-xs font-bold transition ${
                tab === item.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-stone-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-slate-950">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: CALM OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Twice-Daily Calm Digest Card */}
          <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-teal-950 p-5 text-white shadow-md space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" /> Calm Digest Mode ({state.household.digest_times} SG)
                </span>
                <h2 className="text-xl font-extrabold mt-1.5">{state.household.senior_name}</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  On Duty: <span className="font-bold text-white">{state.household.on_duty_member}</span>
                  {state.household.rest_day_active === 1 ? ' (MOM Rest-Day Handoff)' : ' (Helper Shift)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenClinic('brief')}
                className="rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-500 flex items-center gap-1.5"
              >
                <Stethoscope className="h-4 w-4" /> 1-Page Doctor Brief
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[11px] text-slate-300">Meds Taken</p>
                <p className="text-2xl font-black">
                  {takenToday}/{totalSlotsToday}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[11px] text-slate-300">Daily Tasks</p>
                <p className="text-2xl font-black">
                  {completedTasks}/{state.tasks.length}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[11px] text-slate-300">7-Day Avg BP</p>
                <p className="text-lg font-black leading-tight mt-0.5">
                  {state.trends.recentBpAvg
                    ? `${state.trends.recentBpAvg.systolic}/${state.trends.recentBpAvg.diastolic}`
                    : '—'}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-300">
              Anti-alert-fatigue active: routine delays nudge helper first for {state.household.helper_grace_minutes} mins before escalating.
            </p>
          </section>

          {/* Pending Family Approval Inbox */}
          {pendingApprovals.length > 0 && (
            <section className="rounded-3xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-amber-950">
                  🛡️ Family Approval Inbox ({pendingApprovals.length} pending)
                </h3>
                <span className="text-[11px] font-bold text-amber-800">Human-in-the-loop safety gate</span>
              </div>
              {pendingApprovals.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white border border-amber-200 p-4 space-y-2.5">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">{item.summary_en}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Submitted by {item.submitted_by} • Helper translation ready in Bahasa Indonesia, Malay, Mandarin &amp; Tamil
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void decideApproval(item.id, 'approve')}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700 flex items-center justify-center gap-1"
                    >
                      <Check className="h-4 w-4" /> 1-Tap Approve &amp; Activate
                    </button>
                    <button
                      type="button"
                      onClick={() => void decideApproval(item.id, 'reject')}
                      className="rounded-xl border border-stone-300 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-stone-100 flex items-center gap-1"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Tiered Alert Center */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
                Tiered Alerts &amp; Calm Feed
              </h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void simulateWearableSync(false)}
                  className="rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-teal-500 flex items-center gap-1"
                >
                  <Watch className="h-3.5 w-3.5 text-teal-700" /> Sync Watch HR
                </button>
                <button
                  type="button"
                  onClick={() => void simulateWearableSync(true)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-100"
                >
                  Test Watch Fall
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {state.alerts.slice(0, 8).map((a) => (
                <div
                  key={a.id}
                  className={`rounded-2xl border p-3.5 flex items-start justify-between gap-3 ${
                    a.tier === 'red'
                      ? 'border-rose-300 bg-rose-50'
                      : a.tier === 'amber'
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-stone-200 bg-white'
                  } ${a.acknowledged ? 'opacity-65' : ''}`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          a.tier === 'red'
                            ? 'bg-rose-600 text-white'
                            : a.tier === 'amber'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {a.tier === 'red' ? 'Tier 1 Red' : a.tier === 'amber' ? 'Tier 2 Amber' : 'Tier 3 Calm'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(a.created_at).toLocaleTimeString('en-SG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-slate-900">{a.title}</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{a.message}</p>
                  </div>

                  {!a.acknowledged && (
                    <button
                      type="button"
                      onClick={() => void ackAlert(a.id)}
                      className="shrink-0 rounded-xl bg-white border border-stone-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-stone-100"
                    >
                      Ack
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: HEALTH & CLINIC */}
      {tab === 'health' && (
        <div className="space-y-5">
          {/* Non-Diagnostic 14-Day Trends */}
          <section className="rounded-3xl border border-teal-200 bg-white p-5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-teal-700 flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> 14-Day Non-Diagnostic Trend Observations
                </p>
                <p className="text-[11px] text-slate-500">Prepared for licensed clinic reviews — never diagnoses conditions</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onOpenVitals}
                  className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-stone-200"
                >
                  + Snap Vital
                </button>
                <button
                  type="button"
                  onClick={() => onOpenClinic('update')}
                  className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800"
                >
                  + After-Doctor Update
                </button>
              </div>
            </div>

            <ul className="space-y-1.5 rounded-2xl bg-teal-50/70 p-3.5 text-xs font-semibold text-teal-950">
              {state.trends.nonDiagnosticObservations.map((obs, idx) => (
                <li key={idx}>• {obs}</li>
              ))}
            </ul>

            <div className="divide-y divide-stone-100 text-xs">
              {state.vitals.slice(0, 8).map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-bold text-slate-900">
                      {v.type === 'bp'
                        ? `BP ${v.systolic}/${v.diastolic} mmHg${v.pulse ? ` (Pulse ${v.pulse})` : ''}`
                        : v.type === 'glucose'
                          ? `Glucose ${v.glucose_mmol?.toFixed(1)} mmol/L`
                          : v.type === 'wearable_fall'
                            ? 'Watch Fall Trigger'
                            : `Heart Rate ${v.hr_bpm} bpm`}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {v.confirmed_by} • {v.source} •{' '}
                      {new Date(v.recorded_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      v.threshold_tier === 'red'
                        ? 'bg-rose-100 text-rose-800'
                        : v.threshold_tier === 'amber'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {v.threshold_tier}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Medication Refill & Appointment Watch */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-teal-700" />
                Medication Supply &amp; Clinic Appointments
              </h3>
              <button
                type="button"
                onClick={onOpenPharmacy}
                className="rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
              >
                + Scan Pharmacy Bag
              </button>
            </div>

            <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3 text-xs">
              <p className="font-bold text-sky-900">Next Clinic Appointment</p>
              <p className="text-sky-950 font-semibold mt-0.5">{state.household.next_appointment}</p>
            </div>

            {lowRefillMeds.length > 0 && (
              <div className="rounded-2xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950">
                <p className="font-extrabold">Refill Alert (&le; 7 days remaining):</p>
                {lowRefillMeds.map((m) => (
                  <p key={m.id}>
                    • {m.name} ({m.pills_remaining} pills left ≈ {m.daysRemaining} days) — request refill via HealthHub SG.
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {state.medications.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">
                      {m.name} • {m.dosage}
                    </p>
                    <p className="text-slate-500">
                      {m.clinic_source} • {m.risk_tier === 'high' ? 'High-Risk Tray Proof' : 'Standard 1-Tap'}
                    </p>
                  </div>
                  <span className={`font-extrabold ${m.daysRemaining <= 7 ? 'text-amber-700' : 'text-teal-800'}`}>
                    {m.pills_remaining} left ({m.daysRemaining}d)
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Past Clinic Visits */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900">Clinic Visit History</h3>
            {state.clinicVisits.map((v) => (
              <div key={v.id} className="rounded-2xl bg-stone-50 border border-stone-200 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-extrabold text-slate-900">{v.clinic_name}</p>
                  <span className="text-slate-500">{v.visit_date}</span>
                </div>
                <p className="text-slate-700">{v.summary_en}</p>
                {v.helperActions.length > 0 && (
                  <p className="text-teal-800 font-semibold">
                    Helper Action (ID): {v.helperActions[0].id}
                  </p>
                )}
              </div>
            ))}
          </section>
        </div>
      )}

      {/* TAB 3: ROUTINE & MOM REST-DAY HANDOFF */}
      {tab === 'care' && (
        <div className="space-y-5">
          {/* MOM Rest-Day Handoff Switcher */}
          <section className="rounded-3xl border-2 border-indigo-200 bg-indigo-50/70 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-indigo-950">
                  MOM Rest-Day &amp; Sibling Handoff Mode
                </h3>
                <p className="text-xs text-indigo-900 mt-0.5">
                  Silences helper work notifications on {state.household.rest_day_of_week} and assigns checklist duty cleanly to Benny or Mei Ling.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                  state.household.rest_day_active === 1
                    ? 'bg-indigo-700 text-white'
                    : 'bg-white text-slate-700 border border-indigo-200'
                }`}
              >
                {state.household.rest_day_active === 1 ? 'Rest-Day ON' : 'Weekday Shift'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => void toggleRestDay(false, 'Siti Rahayu')}
                className={`rounded-xl py-2.5 px-3 text-xs font-extrabold border-2 ${
                  state.household.rest_day_active === 0
                    ? 'border-teal-600 bg-teal-700 text-white'
                    : 'border-white bg-white text-slate-700'
                }`}
              >
                Siti On Duty (Weekday)
              </button>
              <button
                type="button"
                onClick={() => void toggleRestDay(true, 'Benny Lim')}
                className={`rounded-xl py-2.5 px-3 text-xs font-extrabold border-2 ${
                  state.household.rest_day_active === 1 && state.household.on_duty_member === 'Benny Lim'
                    ? 'border-indigo-700 bg-indigo-700 text-white'
                    : 'border-white bg-white text-slate-700'
                }`}
              >
                Sunday Duty: Benny
              </button>
              <button
                type="button"
                onClick={() => void toggleRestDay(true, 'Mei Ling Lim')}
                className={`rounded-xl py-2.5 px-3 text-xs font-extrabold border-2 ${
                  state.household.rest_day_active === 1 && state.household.on_duty_member === 'Mei Ling Lim'
                    ? 'border-indigo-700 bg-indigo-700 text-white'
                    : 'border-white bg-white text-slate-700'
                }`}
              >
                Sunday Duty: Mei Ling
              </button>
            </div>
          </section>

          {/* Live Daily Care Routine + Add Task */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900">Today&apos;s Live Care Status</h3>
            <div className="space-y-2">
              {state.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      <span className="text-teal-700 mr-1.5">{task.scheduled_time}</span>
                      {task.title_en}
                    </p>
                    {task.completed_by && (
                      <p className="text-[11px] text-slate-500">Logged by {task.completed_by}</p>
                    )}
                    {task.exception_note && (
                      <p className="text-[11px] text-amber-800 font-semibold">Note: {task.exception_note}</p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                      task.status === 'done'
                        ? 'bg-emerald-100 text-emerald-800'
                        : task.status === 'exception'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-stone-100 text-slate-600'
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <input
                type="time"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                className="rounded-xl border border-stone-300 px-2.5 py-2 text-xs font-semibold"
              />
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add task (e.g. Warm ginger water / knee rub)"
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => void addTask()}
                className="rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </section>

          {/* Active Opt-In Care Packs */}
          <CarePackPanels
            packs={state.carePacks}
            entries={state.carePackEntries}
            role={role}
            actor={actor}
            onUpdated={onRefresh}
          />
        </div>
      )}

      {/* TAB 4: OPT-IN CARE PACKS, THRESHOLDS & PDPA */}
      {tab === 'settings' && (
        <div className="space-y-5">
          {/* Opt-In Care Packs (Anti-Bloat Modularity) */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-teal-700" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Opt-In Care Packs (Zero-Bloat Modular Architecture)
                </h3>
                <p className="text-xs text-slate-500">
                  Disabled modules never appear in Helper or Family screens. Activate only what Ah Ma needs.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {state.carePacks.map((p) => {
                const enabled = p.enabled === 1;
                return (
                  <div
                    key={p.pack_key}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 p-3.5"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-600">{p.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => void togglePack(p.pack_key, !enabled)}
                      className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition ${
                        enabled
                          ? 'bg-teal-700 text-white'
                          : 'bg-stone-200 text-slate-700 hover:bg-stone-300'
                      } disabled:opacity-50`}
                    >
                      {enabled ? 'Enabled' : 'Off'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Doctor-Set Safety Thresholds */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900">
              Clinician-Configured Alert Thresholds (Deterministic, Non-SaMD)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <label className="space-y-1">
                <span className="font-bold text-slate-600">BP Systolic Alert (&ge;)</span>
                <input
                  type="number"
                  value={bpSysHigh}
                  onChange={(e) => setBpSysHigh(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 font-bold"
                />
              </label>
              <label className="space-y-1">
                <span className="font-bold text-slate-600">BP Diastolic Alert (&ge;)</span>
                <input
                  type="number"
                  value={bpDiaHigh}
                  onChange={(e) => setBpDiaHigh(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 font-bold"
                />
              </label>
              <label className="space-y-1">
                <span className="font-bold text-slate-600">Glucose High (mmol/L)</span>
                <input
                  type="number"
                  step="0.5"
                  value={glucoseHigh}
                  onChange={(e) => setGlucoseHigh(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 font-bold"
                />
              </label>
              <label className="space-y-1">
                <span className="font-bold text-slate-600">Glucose Low (mmol/L)</span>
                <input
                  type="number"
                  step="0.5"
                  value={glucoseLow}
                  onChange={(e) => setGlucoseLow(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 font-bold"
                />
              </label>
              <label className="space-y-1">
                <span className="font-bold text-slate-600">Helper Grace Loop (mins)</span>
                <input
                  type="number"
                  value={graceMins}
                  onChange={(e) => setGraceMins(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 font-bold"
                />
              </label>
            </div>
            {isAdmin ? (
              <button
                type="button"
                disabled={savingThresholds}
                onClick={() => void saveThresholds()}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                {savingThresholds ? 'Saving...' : 'Save Doctor-Set Thresholds'}
              </button>
            ) : (
              <p className="text-xs text-slate-500">Switch to Family Admin (Benny) to modify safety thresholds.</p>
            )}
          </section>

          {/* PDPA Zero-Lock-In Data Portability & Audit Log */}
          <section className="rounded-3xl border border-stone-200 bg-white p-5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Singapore PDPA Data Portability (Zero Lock-In)
                </h3>
                <p className="text-xs text-slate-500">
                  Hosted in <span className="font-bold text-teal-800">{state.household.region}</span> • Export your family&apos;s records anytime, even if you cancel.
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href="/api/export?format=csv"
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800"
                >
                  <Download className="h-3.5 w-3.5" /> Vitals CSV
                </a>
                <a
                  href="/api/export?format=json"
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-stone-100"
                >
                  <Download className="h-3.5 w-3.5" /> Full JSON
                </a>
              </div>
            </div>

            {state.auditEvents.length > 0 && (
              <div className="border-t border-stone-100 pt-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase text-slate-500">
                  Recent Domain Event Bus Audit Log (Admin Only)
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono text-slate-600">
                  {state.auditEvents.slice(0, 8).map((ev) => (
                    <div key={ev.id} className="rounded-lg bg-stone-50 px-2.5 py-1.5">
                      <span className="font-bold text-teal-800">{ev.event_type}</span> • {ev.actor} ({ev.actor_role}) •{' '}
                      {new Date(ev.created_at).toLocaleTimeString('en-SG')}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
