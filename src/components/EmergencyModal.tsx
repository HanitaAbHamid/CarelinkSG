import { useState } from 'react';
import { PhoneCall, ShieldAlert, Volume2, X, AlertTriangle, MapPin, CheckCircle2 } from 'lucide-react';
import type { Household, Member, UiLang, UserRole } from '../types';
import { apiRequest } from '../lib/api';
import { speakText } from '../lib/carePhrases';

interface Props {
  open: boolean;
  onClose: () => void;
  household: Household;
  members: Member[];
  lang: UiLang;
  role: UserRole;
  actor: string;
  onTriggered: () => void;
}

const STEPS: Record<UiLang, string[]> = {
  en: [
    'Stay calm. If Ah Ma fell, do NOT pull her up if she has hip, back, or head pain.',
    'Tap "Call 995 (SCDF)" for chest pain, breathing trouble, fainting, or fall injury.',
    'Play the English Voice Script below to tell the 995 operator the exact HDB address.',
  ],
  id: [
    'Tetap tenang. Jika Nenek jatuh, JANGAN paksa berdiri jika pinggul/kepala sakit.',
    'Tekan "Telepon 995 (SCDF)" jika sesak napas, pingsan, nyeri dada, atau jatuh.',
    'Putar Suara Bahasa Inggris di bawah agar operator 995 tahu alamat HDB & alergi.',
  ],
  ms: [
    'Bertenang. Jika Nenek jatuh, JANGAN paksa bangun jika sakit pinggul atau kepala.',
    'Tekan "Panggil 995 (SCDF)" jika sesak nafas, pengsan, sakit dada, atau cedera.',
    'Mainkan Skrip Suara Inggeris di bawah kepada operator 995.',
  ],
  zh: [
    '保持冷静。若阿嬷跌倒且诉说头部或髋部疼痛，切勿强行拉起。',
    '若出现胸痛、呼吸困难、昏厥或跌伤，请立即拨打 995（民防部队）。',
    '点击下方英文语音播报，向 995 接线员清晰提供组屋地址与药物过敏史。',
  ],
  ta: [
    'அமைதியாக இருங்கள். விழுந்து வலி இருந்தால் கட்டாயமாக எழுப்ப வேண்டாம்.',
    'மார்பு வலி, மூச்சுத் திணறல் அல்லது விழுந்தால் 995 (SCDF) அழைக்கவும்.',
    '995 ஆபரேட்டருக்கு முகவரியை சொல்ல கீழே உள்ள ஆங்கில குரலை இயக்கவும்.',
  ],
};

export function EmergencyModal({
  open,
  onClose,
  household,
  members,
  lang,
  role,
  actor,
  onTriggered,
}: Props) {
  const [notified, setNotified] = useState(false);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const primaryFamily = members.find((m) => m.role === 'family_admin') || members[0];
  const dispatcherScript = `Hello SCDF 995, I need an ambulance at ${household.hdb_address}. Postal code ${household.postal_code}. The patient is ${household.senior_name}, age ${household.senior_age}. Medical conditions: ${household.conditions}. Drug allergies: ${household.allergies}.`;

  async function notifyFamilyNow() {
    setSending(true);
    await apiRequest('/emergency/trigger', {
      method: 'POST',
      role,
      actor,
      body: { reason: 'Emergency 995 Action Card activated' },
    });
    setSending(false);
    setNotified(true);
    onTriggered();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 p-2 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border-2 border-rose-500">
        <div className="sticky top-0 flex items-center justify-between bg-rose-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-bold leading-tight">Emergency Action Card (SG 995)</h2>
              <p className="text-xs text-rose-100">Tier 1 Immediate Safety Protocol</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-rose-700/80 p-2 hover:bg-rose-800"
            aria-label="Close emergency card"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Giant HDB Address & Allergies Card */}
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 space-y-2.5">
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 shrink-0 text-rose-700 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Exact HDB Address (Show or Read to 995)
                </p>
                <p className="text-lg font-bold text-slate-900 leading-snug">{household.hdb_address}</p>
                <p className="text-sm font-semibold text-rose-800">Postal Code: S({household.postal_code})</p>
              </div>
            </div>

            <div className="border-t border-rose-200 pt-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Drug Allergies
              </p>
              <p className="text-base font-bold text-rose-900">{household.allergies}</p>
            </div>

            <div className="border-t border-rose-200 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Patient &amp; Conditions
              </p>
              <p className="text-sm font-medium text-slate-900">
                {household.senior_name} ({household.senior_age}yo) — {household.conditions}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="tel:995"
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-base font-bold text-white shadow-md hover:bg-rose-700 active:scale-[0.99]"
            >
              <PhoneCall className="h-5 w-5" />
              Call 995 (SCDF)
            </a>
            <a
              href={`tel:${primaryFamily?.phone?.replace(/\s+/g, '') || '+6591234567'}`}
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-base font-bold text-white shadow-md hover:bg-slate-800 active:scale-[0.99]"
            >
              <PhoneCall className="h-5 w-5" />
              Call {primaryFamily?.name?.split(' ')[0] || 'Family'}
            </a>
          </div>

          {/* Trigger Instant App Alert to Family */}
          <button
            type="button"
            disabled={sending || notified}
            onClick={notifyFamilyNow}
            className={`w-full flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
              notified
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {notified ? (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Tier 1 Red Alert Sent to All Family Members
              </>
            ) : (
              <>
                <ShieldAlert className="h-5 w-5" />
                {sending ? 'Sending Tier 1 Alert...' : 'Send Instant Tier 1 Alert to Family Now'}
              </>
            )}
          </button>

          {/* English Dispatcher Voice Script */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                995 English Dispatcher Script
              </p>
              <button
                type="button"
                onClick={() => speakText(dispatcherScript, 'en')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
              >
                <Volume2 className="h-4 w-4" />
                Play Audio
              </button>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">“{dispatcherScript}”</p>
          </div>

          {/* Localized Calm Instructions */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Step-by-Step Guide</p>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
              {(STEPS[lang] || STEPS.en).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
