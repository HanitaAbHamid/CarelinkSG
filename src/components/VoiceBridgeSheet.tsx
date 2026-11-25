import { useState } from 'react';
import { ArrowLeftRight, Mic, MicOff, Send, Volume2, WifiOff, X, Sparkles } from 'lucide-react';
import type { UiLang, UserRole } from '../types';
import { OFFLINE_CARE_PHRASES, SPEECH_LANG_CODES, speakText, type CarePhrase } from '../lib/carePhrases';
import { apiRequest } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultFromLang: UiLang;
  role: UserRole;
}

const ALL_BRIDGE_LANGS = [
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'en', label: 'English (SG)' },
  { code: 'zh', label: 'Mandarin (华文)' },
  { code: 'hokkien', label: 'Hokkien (福建话)' },
  { code: 'cantonese', label: 'Cantonese (广东话)' },
  { code: 'teochew', label: 'Teochew (潮州话)' },
  { code: 'ms', label: 'Malay (Melayu)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'tl', label: 'Tagalog (Extensible)' },
  { code: 'my', label: 'Burmese (Extensible)' },
];

type SeniorTarget = 'zh' | 'hokkien' | 'cantonese' | 'teochew' | 'ms' | 'ta' | 'en';

interface LiveResult {
  mode: string;
  originalText: string;
  translatedText: string;
  pronunciationGuide?: string;
  singaporeCareNote?: string;
  toLang: string;
}

export function VoiceBridgeSheet({ open, onClose, defaultFromLang, role }: Props) {
  const [tab, setTab] = useState<'offline' | 'live'>('offline');
  const [category, setCategory] = useState<'all' | 'meds' | 'safety' | 'daily' | 'clinic'>('all');
  const [seniorTarget, setSeniorTarget] = useState<SeniorTarget>('hokkien');
  const [activePhrase, setActivePhrase] = useState<CarePhrase | null>(null);

  // Live AI bridge state
  const [fromLang, setFromLang] = useState<string>(defaultFromLang);
  const [toLang, setToLang] = useState<string>('zh');
  const [inputText, setInputText] = useState('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LiveResult | null>(null);
  const [micNote, setMicNote] = useState<string | null>(null);

  if (!open) return null;

  const filteredPhrases =
    category === 'all'
      ? OFFLINE_CARE_PHRASES
      : OFFLINE_CARE_PHRASES.filter((p) => p.category === category);

  function getPhraseTarget(p: CarePhrase, target: SeniorTarget): { main: string; sub?: string } {
    if (target === 'hokkien') return { main: p.hokkien.text, sub: p.hokkien.romanized };
    if (target === 'cantonese') return { main: p.cantonese.text, sub: p.cantonese.romanized };
    if (target === 'teochew') return { main: p.teochew.text, sub: p.teochew.romanized };
    return { main: p[target] };
  }

  function getHelperLabel(p: CarePhrase): string {
    if (defaultFromLang === 'id') return p.idLang;
    if (defaultFromLang === 'ms') return p.ms;
    if (defaultFromLang === 'zh') return p.zh;
    if (defaultFromLang === 'ta') return p.ta;
    return p.en;
  }

  function handlePhraseTap(phrase: CarePhrase) {
    setActivePhrase(phrase);
    const out = getPhraseTarget(phrase, seniorTarget);
    speakText(out.main, seniorTarget);
  }

  async function runLiveTranslation(overrideText?: string) {
    const text = (overrideText ?? inputText).trim();
    if (!text) return;
    setLoading(true);
    const res = await apiRequest<LiveResult>('/translate', {
      method: 'POST',
      role,
      body: { text, fromLang, toLang },
    });
    setLoading(false);
    if (res.data) {
      setResult(res.data);
      speakText(res.data.translatedText, toLang);
    }
  }

  function toggleVoiceMic() {
    setMicNote(null);
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicNote('Voice dictation is not available in this browser — type a message or tap quick samples below.');
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = SPEECH_LANG_CODES[fromLang] || 'en-SG';
      rec.interimResults = false;
      setListening(true);
      rec.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript || '';
        setInputText(transcript);
        setListening(false);
        if (transcript) void runLiveTranslation(transcript);
      };
      rec.onerror = () => {
        setListening(false);
        setMicNote('Could not access microphone — type or use Offline Care Deck instead.');
      };
      rec.onend = () => setListening(false);
      rec.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between bg-teal-700 px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Multilingual Care Bridge
            </h2>
            <p className="text-xs text-teal-100">
              EN • Mandarin • Malay • Bahasa Indonesia • Tamil + Hokkien/Cantonese/Teochew
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-teal-800 p-2 hover:bg-teal-900"
            aria-label="Close voice bridge"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="grid grid-cols-2 border-b border-stone-200 bg-stone-50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setTab('offline')}
            className={`rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition ${
              tab === 'offline' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            <WifiOff className="h-4 w-4" />
            Offline Care Deck
          </button>
          <button
            type="button"
            onClick={() => setTab('live')}
            className={`rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition ${
              tab === 'live' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Live AI Voice Bridge
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {tab === 'offline' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'meds', 'safety', 'daily', 'clinic'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                        category === cat
                          ? 'bg-teal-700 text-white'
                          : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <select
                  value={seniorTarget}
                  onChange={(e) => setSeniorTarget(e.target.value as SeniorTarget)}
                  className="rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  aria-label="Senior speech language"
                >
                  <option value="hokkien">Speak to Senior: Hokkien</option>
                  <option value="zh">Speak to Senior: Mandarin</option>
                  <option value="cantonese">Speak to Senior: Cantonese</option>
                  <option value="teochew">Speak to Senior: Teochew</option>
                  <option value="ms">Speak to Senior: Malay</option>
                  <option value="ta">Speak to Senior: Tamil</option>
                  <option value="en">Speak to Senior: English</option>
                </select>
              </div>

              {/* Giant Visual Card when tapped */}
              {activePhrase && (
                <div className="rounded-2xl border-2 border-teal-500 bg-teal-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-teal-800">
                      Show Senior (Large Print)
                    </span>
                    <button
                      type="button"
                      onClick={() => speakText(getPhraseTarget(activePhrase, seniorTarget).main, seniorTarget)}
                      className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <Volume2 className="h-4 w-4" /> Replay
                    </button>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-950 leading-snug">
                    {getPhraseTarget(activePhrase, seniorTarget).main}
                  </p>
                  {getPhraseTarget(activePhrase, seniorTarget).sub && (
                    <p className="text-sm font-semibold text-teal-900">
                      Pronunciation: {getPhraseTarget(activePhrase, seniorTarget).sub}
                    </p>
                  )}
                  <p className="text-xs text-slate-600">{getHelperLabel(activePhrase)}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredPhrases.map((p) => {
                  const target = getPhraseTarget(p, seniorTarget);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePhraseTap(p)}
                      className="text-left rounded-2xl border border-stone-200 bg-white p-3.5 hover:border-teal-400 hover:bg-teal-50/40 active:scale-[0.99] transition shadow-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-2xl leading-none">{p.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 leading-snug">{getHelperLabel(p)}</p>
                          <p className="text-xs font-semibold text-teal-700 mt-1 line-clamp-2">{target.main}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-center text-slate-500">
                100% pre-cached on device — works instantaneously inside HDB lifts &amp; polyclinic basements with zero mobile data.
              </p>
            </>
          ) : (
            <div className="space-y-4">
              {/* Language Pair Selector */}
              <div className="flex items-center gap-2">
                <select
                  value={fromLang}
                  onChange={(e) => setFromLang(e.target.value)}
                  className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold"
                >
                  {ALL_BRIDGE_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      Speaker: {l.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const tmp = fromLang;
                    setFromLang(toLang);
                    setToLang(tmp);
                  }}
                  className="rounded-xl border border-stone-300 p-2.5 hover:bg-stone-100"
                  aria-label="Swap languages"
                >
                  <ArrowLeftRight className="h-4 w-4 text-slate-700" />
                </button>
                <select
                  value={toLang}
                  onChange={(e) => setToLang(e.target.value)}
                  className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold"
                >
                  {ALL_BRIDGE_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      Listener: {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Giant Push-To-Talk Mic Button */}
              <div className="flex flex-col items-center gap-2 py-2">
                <button
                  type="button"
                  onClick={toggleVoiceMic}
                  className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition ${
                    listening
                      ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                      : 'bg-teal-700 text-white hover:bg-teal-800'
                  }`}
                >
                  {listening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                </button>
                <p className="text-xs font-semibold text-slate-600">
                  {listening ? 'Listening... speak naturally now' : 'Tap to speak — or type below'}
                </p>
                {micNote && <p className="text-xs text-amber-700 text-center">{micNote}</p>}
              </div>

              {/* Text Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runLiveTranslation();
                  }}
                  placeholder="e.g. Nenek merasa pusing setelah minum obat?"
                  className="flex-1 rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void runLiveTranslation()}
                  className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  {loading ? '...' : 'Translate'}
                </button>
              </div>

              {/* Quick Test Chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Nenek merasa pusing?',
                  'Waktunya minum obat pagi',
                  'Bagian lutut mana yang sakit?',
                  'Cek tekanan darah dulu ya',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setInputText(sample);
                      void runLiveTranslation(sample);
                    }}
                    className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-teal-100 hover:text-teal-900"
                  >
                    “{sample}”
                  </button>
                ))}
              </div>

              {/* Translation Result */}
              {result && (
                <div className="rounded-2xl border-2 border-teal-500 bg-teal-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-teal-800">
                      Translated ({result.mode === 'gemini' ? 'Live Gemini AI' : 'SG Offline Care Engine'})
                    </span>
                    <button
                      type="button"
                      onClick={() => speakText(result.translatedText, result.toLang)}
                      className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <Volume2 className="h-4 w-4" /> Speak
                    </button>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-950 leading-snug">
                    {result.translatedText}
                  </p>
                  {result.pronunciationGuide && (
                    <p className="text-sm font-semibold text-teal-900">Guide: {result.pronunciationGuide}</p>
                  )}
                  {result.singaporeCareNote && (
                    <p className="text-xs text-slate-700 border-t border-teal-200 pt-2">
                      {result.singaporeCareNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
