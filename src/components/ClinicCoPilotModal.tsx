import { useEffect, useState } from 'react';
import { ClipboardList, FileCheck2, Printer, ShieldCheck, Stethoscope, X } from 'lucide-react';
import type { UserRole } from '../types';
import { apiRequest } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  actor: string;
  initialTab?: 'brief' | 'update';
  onUpdated: () => void;
}

interface BriefData {
  generatedAt: string;
  disclaimer: string;
  senior: {
    name: string;
    age: number;
    allergies: string;
    conditions: string;
    primaryClinic: string;
    primaryDoctor: string;
  };
  adherencePct: number;
  trends: {
    recentBpAvg: { systolic: number; diastolic: number } | null;
    priorBpAvg: { systolic: number; diastolic: number } | null;
    bpSysDelta: number | null;
    recentGlucoseAvg: number | null;
    nonDiagnosticObservations: string[];
  };
  activeMeds: Array<{
    name: string;
    dosage: string;
    risk_tier: string;
    timeSlots: string[];
    pills_remaining: number;
  }>;
  symptomExceptions: Array<{
    med_name: string;
    exception_reason: string;
    note: string | null;
    created_at: string;
  }>;
}

interface VisitExtraction {
  visitId: string;
  approvalId: string | null;
  extraction: {
    summaryEn: string;
    changes: string[];
    helperActions: Array<{ en: string; id: string; zh?: string }>;
  };
}

export function ClinicCoPilotModal({
  open,
  onClose,
  role,
  actor,
  initialTab = 'brief',
  onUpdated,
}: Props) {
  const [tab, setTab] = useState<'brief' | 'update'>(initialTab);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [clinicName, setClinicName] = useState('Toa Payoh Polyclinic (NHG)');
  const [rawNotes, setRawNotes] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitResult, setVisitResult] = useState<VisitExtraction | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    void apiRequest<BriefData>('/clinic/brief', { role }).then((res) => {
      if (res.data) setBrief(res.data);
    });
  }, [open, initialTab, role]);

  if (!open) return null;

  async function handleSaveUpdate() {
    setError(null);
    if (!consentGiven) {
      setError('PDPA Safeguard: Please tick the doctor/clinic consent box before capturing visit instructions.');
      return;
    }
    setSaving(true);
    const res = await apiRequest<VisitExtraction>('/clinic/visit-update', {
      method: 'POST',
      role,
      actor,
      body: {
        clinicName,
        rawNotes,
        doctorConsentGiven: consentGiven,
      },
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) {
      setVisitResult(res.data);
      onUpdated();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-stone-200 print-only-card">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white no-print">
          <div className="flex items-center gap-2.5">
            <Stethoscope className="h-5 w-5 text-teal-400" />
            <div>
              <h2 className="text-lg font-bold">Clinic Co-Pilot</h2>
              <p className="text-xs text-slate-300">Show 1-Page Doctor Brief • Capture Post-Visit Dose Changes</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-800 p-2 hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-stone-200 bg-stone-50 p-1.5 gap-1.5 no-print">
          <button
            type="button"
            onClick={() => setTab('brief')}
            className={`rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 ${
              tab === 'brief' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            1-Page Doctor Brief
          </button>
          <button
            type="button"
            onClick={() => setTab('update')}
            className={`rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 ${
              tab === 'update' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            <FileCheck2 className="h-4 w-4" />
            After-Doctor Update
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {tab === 'brief' && brief && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                    CareLink SG — Clinical Handover Summary
                  </p>
                  <h3 className="text-xl font-extrabold text-slate-950">
                    {brief.senior.name}, {brief.senior.age}yo
                  </h3>
                  <p className="text-xs text-slate-600">
                    {brief.senior.primaryClinic} • {brief.senior.primaryDoctor}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800"
                >
                  <Printer className="h-4 w-4" /> Print / PDF
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                  <p className="font-bold uppercase text-rose-700">Drug Allergies</p>
                  <p className="font-bold text-rose-950 text-sm mt-0.5">{brief.senior.allergies}</p>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                  <p className="font-bold uppercase text-slate-600">Active Conditions</p>
                  <p className="font-semibold text-slate-900 text-sm mt-0.5">{brief.senior.conditions}</p>
                </div>
              </div>

              {/* 14-Day Non-Diagnostic Trends */}
              <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-teal-900">
                    14-Day Home Vitals &amp; Adherence Summary
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-teal-800 border border-teal-200">
                    Med Adherence: {brief.adherencePct}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-white p-2.5 border border-teal-100">
                    <p className="text-[11px] font-semibold text-slate-500">7-Day Avg BP</p>
                    <p className="text-lg font-black text-slate-900">
                      {brief.trends.recentBpAvg
                        ? `${brief.trends.recentBpAvg.systolic}/${brief.trends.recentBpAvg.diastolic}`
                        : '—'}{' '}
                      <span className="text-xs font-semibold text-slate-500">mmHg</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-teal-100">
                    <p className="text-[11px] font-semibold text-slate-500">7-Day Avg Glucose</p>
                    <p className="text-lg font-black text-slate-900">
                      {brief.trends.recentGlucoseAvg != null ? brief.trends.recentGlucoseAvg.toFixed(1) : '—'}{' '}
                      <span className="text-xs font-semibold text-slate-500">mmol/L</span>
                    </p>
                  </div>
                </div>
                <ul className="space-y-1 text-xs text-teal-950 font-medium pt-1">
                  {brief.trends.nonDiagnosticObservations.map((obs, idx) => (
                    <li key={idx}>• {obs}</li>
                  ))}
                </ul>
              </div>

              {/* Current Medications */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Current Active Medications</p>
                <div className="divide-y divide-stone-200 rounded-2xl border border-stone-200 overflow-hidden">
                  {brief.activeMeds.map((m, i) => (
                    <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-xs bg-white">
                      <div>
                        <p className="font-bold text-slate-900">
                          {m.name} <span className="font-normal text-slate-600">({m.dosage})</span>
                        </p>
                        <p className="text-slate-500 capitalize">Slots: {m.timeSlots.join(', ')}</p>
                      </div>
                      <span className="font-semibold text-slate-700">{m.pills_remaining} left</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Caregiver Reported Symptoms / Exceptions */}
              {brief.symptomExceptions.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 space-y-1.5">
                  <p className="text-xs font-bold uppercase text-amber-900">Recent Helper-Logged Symptoms / Refusals</p>
                  {brief.symptomExceptions.map((ex, i) => (
                    <p key={i} className="text-xs text-amber-950">
                      • <span className="font-bold">{ex.med_name}:</span> {ex.exception_reason}
                      {ex.note ? ` — "${ex.note}"` : ''}
                    </p>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-slate-500 italic">{brief.disclaimer}</p>
            </div>
          )}

          {tab === 'update' && (
            <div className="space-y-4">
              {!visitResult ? (
                <>
                  {/* Explicit PDPA Consent Banner */}
                  <label className="flex items-start gap-3 rounded-2xl border-2 border-teal-300 bg-teal-50 p-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                      className="mt-1 h-5 w-5 accent-teal-700"
                    />
                    <div className="text-xs text-teal-950 space-y-1">
                      <p className="font-extrabold flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-teal-700" />
                        Singapore PDPA Doctor Consent Confirmation (Required)
                      </p>
                      <p>
                        I confirm I am photographing written discharge/pharmacy instructions OR obtained the doctor&apos;s
                        permission before summarizing visit instructions for family care coordination.
                      </p>
                    </div>
                  </label>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Polyclinic / GP Clinic</label>
                    <input
                      type="text"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">
                      Doctor Wrap-Up Instructions / Discharge Slip Notes
                    </label>
                    <textarea
                      rows={4}
                      value={rawNotes}
                      onChange={(e) => setRawNotes(e.target.value)}
                      placeholder="e.g. Doctor increased Amlodipine from 5mg to 10mg due to elevated morning BP. Continue Metformin 500mg after meals. Watch for dizziness."
                      className="mt-1 w-full rounded-2xl border border-stone-300 px-3.5 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRawNotes(
                          'Doctor increased Amlodipine from 5mg to 10mg every morning because 7-day average BP rose to 144/84. Stop old 5mg pack. Continue Metformin 500mg twice daily after food. Follow-up in 6 weeks.',
                        )
                      }
                      className="mt-1.5 text-xs font-bold text-teal-700 hover:underline"
                    >
                      + Fill realistic Toa Payoh Polyclinic wrap-up note
                    </button>
                  </div>

                  {error && (
                    <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800">
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveUpdate()}
                    className="w-full rounded-2xl bg-teal-700 py-3.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {saving ? 'Generating What-Changed Diff...' : 'Generate Family Summary & Helper Action Cards'}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 space-y-1.5">
                    <p className="text-sm font-extrabold text-emerald-950">
                      ✅ Post-Visit Summary Created
                    </p>
                    <p className="text-xs text-emerald-900">{visitResult.extraction.summaryEn}</p>
                    {visitResult.approvalId && (
                      <p className="text-xs font-bold text-amber-800 bg-amber-100 rounded-lg px-2.5 py-1.5 mt-2">
                        🛡️ Dose change detected — safely queued in Family Approval Inbox before changing helper&apos;s meds.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-slate-600">Translated Helper Action Cards</p>
                    {visitResult.extraction.helperActions.map((act, i) => (
                      <div key={i} className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5 text-xs space-y-1">
                        <p className="font-bold text-slate-900">EN: {act.en}</p>
                        <p className="font-semibold text-teal-800">ID: {act.id}</p>
                        {act.zh && <p className="text-slate-700">中文: {act.zh}</p>}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setVisitResult(null);
                      setRawNotes('');
                      onClose();
                    }}
                    className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
