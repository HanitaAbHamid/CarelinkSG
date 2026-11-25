import { useState, type ChangeEvent } from 'react';
import { Camera, CheckCircle2, FileText, ShieldCheck, X } from 'lucide-react';
import type { UserRole } from '../types';
import { apiRequest } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  actor: string;
  onSubmitted: () => void;
}

interface OcrMedResp {
  approvalId: string;
  draft: {
    mode: string;
    name: string;
    dosage: string;
    riskTier: 'high' | 'standard';
    timeSlots: string[];
    pillsRemaining: number;
    clinicSource: string;
    instructions: Record<string, string>;
  };
}

export function PharmacyOcrModal({ open, onClose, role, actor, onSubmitted }: Props) {
  const [labelText, setLabelText] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrMedResp | null>(null);

  if (!open) return null;

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  async function submitScan(overrideHint?: string) {
    setLoading(true);
    const res = await apiRequest<OcrMedResp>('/medications/ocr-label', {
      method: 'POST',
      role,
      actor,
      body: {
        imageDataUrl,
        labelText: overrideHint ?? labelText,
      },
    });
    setLoading(false);
    if (res.data) {
      setResult(res.data);
      onSubmitted();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between bg-teal-700 px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Scan Singapore Pharmacy Bag
            </h2>
            <p className="text-xs text-teal-100">
              SingHealth / NHG / NUHS / GP labels — requires Family Approval before activating
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setImageDataUrl(undefined);
              onClose();
            }}
            className="rounded-full bg-teal-800 p-2 hover:bg-teal-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-400 bg-teal-50/50 p-5 cursor-pointer">
                <Camera className="h-8 w-8 text-teal-700" />
                <span className="text-sm font-bold text-teal-900">
                  {imageDataUrl ? 'Photo Attached — Ready to Scan' : 'Snap Polyclinic / Pharmacy Bag Label'}
                </span>
                <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
              </label>

              <textarea
                rows={2}
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                placeholder="Or paste/type label text (e.g. Glipizide 5mg — 1 tablet before breakfast, Toa Payoh Polyclinic)"
                className="w-full rounded-2xl border border-stone-300 px-3.5 py-2.5 text-sm"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void submitScan('Losartan 50mg blood pressure morning 30 tablets')}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold hover:border-teal-500"
                >
                  Sample: NHG Losartan 50mg (High-Risk)
                </button>
                <button
                  type="button"
                  onClick={() => void submitScan('Glipizide 5mg diabetes before breakfast 28 tablets')}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold hover:border-teal-500"
                >
                  Sample: Glipizide 5mg (Diabetes)
                </button>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => void submitScan()}
                className="w-full rounded-2xl bg-teal-700 py-3.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? 'Parsing & Translating...' : 'Scan & Send to Family Approval Inbox'}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 space-y-2">
                <p className="text-sm font-extrabold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Queued for 1-Tap Family Admin Approval
                </p>
                <p className="text-xs text-emerald-800">
                  Safety rule: AI never changes a medication schedule automatically. Switch to Family Hub to review &amp; tap Approve.
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-extrabold text-slate-900 text-base">
                    {result.draft.name} — {result.draft.dosage}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      result.draft.riskTier === 'high'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {result.draft.riskTier === 'high' ? 'High-Risk (3-Sec Tray Photo)' : 'Standard (1-Tap)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Source: {result.draft.clinicSource} • Qty: {result.draft.pillsRemaining} pills
                </p>
                <div className="rounded-xl bg-stone-50 p-3 space-y-1.5 text-xs">
                  <p>
                    <span className="font-bold">EN:</span> {result.draft.instructions.en}
                  </p>
                  <p>
                    <span className="font-bold">ID (Helper):</span> {result.draft.instructions.id}
                  </p>
                  <p>
                    <span className="font-bold">中文:</span> {result.draft.instructions.zh}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setImageDataUrl(undefined);
                  setLabelText('');
                  onClose();
                }}
                className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" /> Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
