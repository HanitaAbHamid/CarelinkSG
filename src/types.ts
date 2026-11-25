export type UserRole = 'helper' | 'family_admin' | 'family_member' | 'senior';
export type UiLang = 'en' | 'id' | 'ms' | 'zh' | 'ta';

export interface Household {
  id: string;
  senior_name: string;
  senior_age: number;
  senior_languages: string;
  hdb_address: string;
  postal_code: string;
  allergies: string;
  conditions: string;
  primary_clinic: string;
  primary_doctor: string;
  next_appointment: string;
  bp_sys_high: number;
  bp_sys_low: number;
  bp_dia_high: number;
  bp_dia_low: number;
  glucose_high: number;
  glucose_low: number;
  hr_high: number;
  hr_low: number;
  helper_grace_minutes: number;
  rest_day_of_week: string;
  rest_day_active: number;
  on_duty_member: string;
  digest_times: string;
  region: string;
}

export interface Member {
  id: string;
  name: string;
  role: UserRole;
  relationship: string;
  language: string;
  phone: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  risk_tier: 'high' | 'standard';
  timeSlots: string[];
  instructions: Record<string, string>;
  pills_remaining: number;
  pills_per_day: number;
  refill_alert_days: number;
  daysRemaining: number;
  clinic_source: string;
  status: string;
}

export interface MedicationLog {
  id: string;
  med_id: string;
  med_name?: string;
  log_date: string;
  slot: string;
  status: 'taken' | 'exception';
  exception_reason: string | null;
  note: string | null;
  proof_photo: string | null;
  logged_by: string;
  logged_role: string;
  created_at: string;
}

export interface VitalRecord {
  id: string;
  type: 'bp' | 'glucose' | 'hr' | 'wearable_fall';
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  glucose_mmol: number | null;
  hr_bpm: number | null;
  source: string;
  confirmed_by: string;
  threshold_tier: 'green' | 'amber' | 'red';
  note: string | null;
  recorded_at: string;
}

export interface TrendSummary {
  recentBpAvg: { systolic: number; diastolic: number } | null;
  priorBpAvg: { systolic: number; diastolic: number } | null;
  bpSysDelta: number | null;
  recentGlucoseAvg: number | null;
  priorGlucoseAvg: number | null;
  glucoseDelta: number | null;
  recentHrAvg: number | null;
  nonDiagnosticObservations: string[];
}

export interface CareTask {
  id: string;
  task_date: string;
  title_en: string;
  titleI18n: Record<string, string>;
  category: string;
  scheduled_time: string;
  status: 'pending' | 'done' | 'exception';
  exception_note: string | null;
  completed_by: string | null;
  completed_at: string | null;
}

export interface ApprovalItem {
  id: string;
  kind: 'pharmacy_med' | 'clinic_diff';
  title: string;
  summary_en: string;
  payload: {
    name: string;
    dosage: string;
    riskTier: 'high' | 'standard';
    timeSlots: string[];
    pillsRemaining: number;
    pillsPerDay: number;
    clinicSource: string;
    instructions: Record<string, string>;
  };
  submitted_by: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AlertItem {
  id: string;
  tier: 'red' | 'amber' | 'green';
  category: string;
  title: string;
  message: string;
  target_role: string;
  acknowledged: number;
  created_at: string;
}

export interface ClinicVisit {
  id: string;
  visit_date: string;
  clinic_name: string;
  summary_en: string;
  helperActions: Array<{ en: string; id: string; zh?: string }>;
  changes: string[];
  doctor_consent_given: number;
  created_by: string;
  created_at: string;
}

export interface CarePack {
  pack_key: string;
  name: string;
  description: string;
  enabled: number;
  updated_at: string;
}

export interface CarePackEntry {
  id: string;
  pack_key: string;
  title: string;
  details: Record<string, unknown>;
  logged_by: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  actor: string;
  actor_role: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AppStateResponse {
  today: string;
  role: UserRole;
  aiMode: 'gemini' | 'offline_fallback';
  household: Household;
  thresholds: {
    bpSysHigh: number;
    bpSysLow: number;
    bpDiaHigh: number;
    bpDiaLow: number;
    glucoseHigh: number;
    glucoseLow: number;
    hrHigh: number;
    hrLow: number;
  };
  members: Member[];
  medications: Medication[];
  todayMedLogs: MedicationLog[];
  recentMedExceptions: MedicationLog[];
  vitals: VitalRecord[];
  trends: TrendSummary;
  tasks: CareTask[];
  approvals: ApprovalItem[];
  alerts: AlertItem[];
  clinicVisits: ClinicVisit[];
  carePacks: CarePack[];
  carePackEntries: CarePackEntry[];
  auditEvents: AuditEvent[];
}
