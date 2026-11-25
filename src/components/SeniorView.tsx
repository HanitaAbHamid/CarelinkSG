import { Mic, PhoneCall, Heart } from 'lucide-react';
import type { AppStateResponse } from '../types';

interface Props {
  state: AppStateResponse;
  onOpenVoice: () => void;
  onOpenEmergency: () => void;
}

export function SeniorView({ state, onOpenVoice, onOpenEmergency }: Props) {
  const nextPendingTask = state.tasks.find((t) => t.status === 'pending');

  return (
    <div className="space-y-6 py-2">
      {/* Zero-App Senior Philosophy Notice */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-900">
        <span className="font-extrabold">Zero-App Senior Default:</span> Seniors never need to log in or operate a smartphone for CareLink SG to work. This optional high-contrast 2-button tablet/phone screen is only for seniors who want direct voice help.
      </div>

      {/* Warm Giant Greeting */}
      <div className="rounded-3xl bg-white border-2 border-stone-200 p-6 text-center space-y-2 shadow-xs">
        <Heart className="h-9 w-9 text-teal-700 mx-auto" />
        <h2 className="text-3xl font-black text-slate-950">阿嬷好 • Hello Ah Ma</h2>
        <p className="text-lg font-semibold text-slate-700">
          {nextPendingTask
            ? `Next: ${nextPendingTask.titleI18n.zh || nextPendingTask.title_en} (${nextPendingTask.scheduled_time})`
            : '今日照护已全部完成 • All done for today!'}
        </p>
      </div>

      {/* ONLY 2 Giant Accessible Buttons */}
      <div className="grid grid-cols-1 gap-4">
        <button
          type="button"
          onClick={onOpenVoice}
          className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-3xl bg-teal-700 p-6 text-white shadow-lg hover:bg-teal-800 active:scale-[0.98]"
        >
          <Mic className="h-12 w-12" />
          <span className="text-2xl font-black">说话翻译 • Speak to Siti</span>
          <span className="text-sm text-teal-100">Hokkien / Mandarin ↔ Bahasa Indonesia</span>
        </button>

        <button
          type="button"
          onClick={onOpenEmergency}
          className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-3xl bg-rose-600 p-6 text-white shadow-lg hover:bg-rose-700 active:scale-[0.98]"
        >
          <PhoneCall className="h-12 w-12" />
          <span className="text-2xl font-black">叫家人 / 紧急求助 • Call Family / 995</span>
          <span className="text-sm text-rose-100">One tap for Benny, Mei Ling, or SCDF 995</span>
        </button>
      </div>
    </div>
  );
}
