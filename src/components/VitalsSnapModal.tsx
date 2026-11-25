import { useState, type ChangeEvent } from 'react';
import { Camera, CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import type { UserRole } from '../types';
import { apiRequest } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  actor: string;
  onSaved: () => void;
}

interface PreviewResp {
  preview: {
    mode: string;
    deviceType: 'bp' | 'glucose';
    systolic?: number;
    diastolic?: number;
    pulse?: number;
    glucoseMmol?: number;
    confidenceNote: string;
    glareRisk: boolean;
  };
  sanity: {
    valid: boolean;
    warnings: string[];
    errors: string[];
  };
}

export function VitalsSnapModal({ open, onClose, role, actor, onSaved }: Props) {
  const [deviceType, setDeviceType] = useState<'bp' | 'glucose'>('bp');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'capture' | 'confirm' | 'done'>('capture');

  // Editable confirmed digits (human-in-the-loop kills glare hallucinations)
  const [systolic, setSystolic] = useState('136');
  const [diastolic, setDiastolic] = useState('80');
  const [pulse, setPulse] = useState('72');
  const [glucose, setGlucose] = useState('7.1');
  const [note, setNote] = useState('');
  const [confidenceNote, setConfidenceNote] = useState('');
  const [glareRisk, setGlareRisk] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<{ tier: string; guidance: string } | null>(null);

  if (!open) return null;

  function resetAll() {
    setStage('capture');
    setPhotoPreview(null);
    setErrorMsg(null);
    setWarnings([]);
    setGlareRisk(false);
    setSavedFeedback(null);
    setNote('');
  }

  async function runOcrPreview(
    sampleScenario?: 'normal_bp' | 'high_bp' | 'glare_error_glucose' | 'normal_glucose',
    imgData?: string,
    overrideType?: 'bp' | 'glucose',
  ) {
    const targetType = overrideType ?? deviceType;
    setDeviceType(targetType);
    setLoading(true);
    setErrorMsg(null);
    const res = await apiRequest<PreviewResp>('/vitals/ocr-preview', {
      method: 'POST',
      role,
      actor,
      body: {
        deviceType: targetType,
        imageDataUrl: imgData,
        sampleScenario,
      },
    });
    setLoading(false);
    if (res.error || !res.data) {
      setErrorMsg(res.error || 'Could not preview reading.');
      return;
    }
    const { preview, sanity } = res.data;
    if (preview.systolic != null) setSystolic(String(preview.systolic));
    if (preview.diastolic != null) setDiastolic(String(preview.diastolic));
    if (preview.pulse != null) setPulse(String(preview.pulse));
    if (preview.glucoseMmol != null) setGlucose(String(preview.glucoseMmol));
    setConfidenceNote(preview.confidenceNote);
    setGlareRisk(preview.glareRisk);
    setWarnings(sanity.warnings);
    setStage('confirm');
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPhotoPreview(dataUrl);
      void runOcrPreview(undefined, dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleConfirmSave() {
    setLoading(true);
    setErrorMsg(null);
    const body =
      deviceType === 'bp'
        ? {
            type: 'bp',
            systolic: Number(systolic),
            diastolic: Number(diastolic),
            pulse: pulse ? Number(pulse) : null,
            source: 'ocr_confirmed',
            humanConfirmed: true,
            note: note.trim() || 'LCD screen snapped & visually confirmed',
          }
        : {
            type: 'glucose',
            glucoseMmol: Number(glucose),
            source: 'ocr_confirmed',
            humanConfirmed: true,
            note: note.trim() || 'Glucometer LCD snapped & visually confirmed',
          };

    const res = await apiRequest<{
      evaluation: { tier: string; helperGuidance: string };
    }>('/vitals/confirm', {
      method: 'POST',
      role,
      actor,
      body,
    });
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.details ? res.details.join(' ') : res.error);
      return;
    }

    setSavedFeedback({
      tier: res.data?.evaluation.tier || 'green',
      guidance: res.data?.evaluation.helperGuidance || 'Reading saved.',
    });
    setStage('done');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Camera className="h-5 w-5 text-teal-400" />
              Snap-and-Confirm LCD Vitals
            </h2>
            <p className="text-xs text-slate-300">Works with any standard Omron / Accu-Chek — zero Bluetooth pairing</p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetAll();
              onClose();
            }}
            className="rounded-full bg-slate-800 p-2 hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {stage === 'capture' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeviceType('bp')}
                  className={`rounded-2xl border-2 p-3 text-sm font-bold ${
                    deviceType === 'bp'
                      ? 'border-teal-600 bg-teal-50 text-teal-900'
                      : 'border-stone-200 text-slate-700'
                  }`}
                >
                  🩺 Blood Pressure (mmHg)
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceType('glucose')}
                  className={`rounded-2xl border-2 p-3 text-sm font-bold ${
                    deviceType === 'glucose'
                      ? 'border-teal-600 bg-teal-50 text-teal-900'
                      : 'border-stone-200 text-slate-700'
                  }`}
                >
                  🩸 Blood Glucose (mmol/L)
                </button>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-400 bg-teal-50/50 p-6 cursor-pointer hover:bg-teal-50">
                <Camera className="h-9 w-9 text-teal-700" />
                <span className="text-sm font-bold text-teal-900">
                  {loading ? 'Reading LCD digits...' : 'Tap to Take Photo of Monitor LCD'}
                </span>
                <span className="text-xs text-slate-600">Uses Gemini Vision if configured, or offline OCR preview</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Quick Demo Scenarios (Including Glare Safety Test!) */}
              <div className="rounded-2xl bg-stone-50 border border-stone-200 p-3.5 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Or Test Realistic HDB Scenarios
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void runOcrPreview('normal_bp', undefined, 'bp')}
                    className="rounded-xl bg-white border border-stone-200 px-3 py-2 text-left text-xs font-semibold hover:border-teal-500"
                  >
                    ✅ Normal Omron BP (136/80)
                  </button>
                  <button
                    type="button"
                    onClick={() => void runOcrPreview('high_bp', undefined, 'bp')}
                    className="rounded-xl bg-white border border-rose-200 px-3 py-2 text-left text-xs font-semibold text-rose-800 hover:border-rose-500"
                  >
                    🚨 High BP Threshold (168/96)
                  </button>
                  <button
                    type="button"
                    onClick={() => void runOcrPreview('normal_glucose', undefined, 'glucose')}
                    className="rounded-xl bg-white border border-stone-200 px-3 py-2 text-left text-xs font-semibold hover:border-teal-500"
                  >
                    ✅ Normal Glucose (7.1 mmol/L)
                  </button>
                  <button
                    type="button"
                    onClick={() => void runOcrPreview('glare_error_glucose', undefined, 'glucose')}
                    className="rounded-xl bg-white border border-amber-300 px-3 py-2 text-left text-xs font-semibold text-amber-900 hover:border-amber-500"
                  >
                    ⚠️ Test Glare Guardrail (1.8 vs 18.0)
                  </button>
                </div>
              </div>
            </>
          )}

          {stage === 'confirm' && (
            <div className="space-y-4">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Captured monitor LCD"
                  className="h-32 w-full object-cover rounded-2xl border border-stone-200"
                />
              )}

              {(glareRisk || warnings.length > 0) && (
                <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3.5 flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-950 space-y-1">
                    <p className="font-bold">LCD Glare &amp; Physiological Sanity Guardrail Triggered</p>
                    <p>{confidenceNote}</p>
                    {warnings.map((w, i) => (
                      <p key={i} className="font-semibold">
                        • {w}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Giant 48pt Human-In-The-Loop Confirmation Inputs */}
              <div className="rounded-2xl border-2 border-teal-500 bg-teal-50/60 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-teal-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Step 2: Visually Match Against Monitor Screen (Tap to Fix Any Digit)
                </p>

                {deviceType === 'bp' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600">SYS (Top)</label>
                      <input
                        type="number"
                        value={systolic}
                        onChange={(e) => setSystolic(e.target.value)}
                        className="w-full rounded-xl border-2 border-teal-300 bg-white px-2 py-2 text-center text-3xl sm:text-4xl font-black text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600">DIA (Bottom)</label>
                      <input
                        type="number"
                        value={diastolic}
                        onChange={(e) => setDiastolic(e.target.value)}
                        className="w-full rounded-xl border-2 border-teal-300 bg-white px-2 py-2 text-center text-3xl sm:text-4xl font-black text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600">PULSE</label>
                      <input
                        type="number"
                        value={pulse}
                        onChange={(e) => setPulse(e.target.value)}
                        className="w-full rounded-xl border-2 border-stone-300 bg-white px-2 py-2 text-center text-3xl sm:text-4xl font-black text-slate-700"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-3 justify-center">
                    <div className="w-44">
                      <label className="text-xs font-bold text-slate-600 block text-center">
                        Blood Glucose (mmol/L)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={glucose}
                        onChange={(e) => setGlucose(e.target.value)}
                        className="w-full rounded-xl border-2 border-teal-400 bg-white px-3 py-2 text-center text-5xl font-black text-slate-900"
                      />
                    </div>
                    <span className="pb-3 text-base font-bold text-slate-600">mmol/L</span>
                  </div>
                )}

                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note (e.g. Before breakfast, seated 5 mins)"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  🚫 Safety Bounds Blocked Save: {errorMsg}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStage('capture')}
                  className="flex-1 rounded-2xl border border-stone-300 py-3.5 text-sm font-bold text-slate-700"
                >
                  Re-Snap
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleConfirmSave()}
                  className="flex-[2] rounded-2xl bg-emerald-600 py-3.5 text-base font-extrabold text-white shadow-md hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {loading ? 'Checking Thresholds...' : 'Yes, Matches Screen — Save'}
                </button>
              </div>
            </div>
          )}

          {stage === 'done' && savedFeedback && (
            <div className="space-y-4 text-center py-2">
              <div
                className={`rounded-2xl p-5 border-2 ${
                  savedFeedback.tier === 'red'
                    ? 'bg-rose-50 border-rose-400 text-rose-900'
                    : savedFeedback.tier === 'amber'
                      ? 'bg-amber-50 border-amber-400 text-amber-900'
                      : 'bg-emerald-50 border-emerald-400 text-emerald-900'
                }`}
              >
                <p className="text-lg font-extrabold">
                  {savedFeedback.tier === 'red'
                    ? '🚨 Tier 1 Threshold Alert Sent to Family'
                    : savedFeedback.tier === 'amber'
                      ? '⚠️ Slightly Elevated — Logged for Digest'
                      : '✅ Reading Confirmed & Saved'}
                </p>
                <p className="text-sm mt-2 font-medium">{savedFeedback.guidance}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  onClose();
                }}
                className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
