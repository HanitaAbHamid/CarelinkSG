import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { eventBus } from './eventBus.js';

let dbInstance: DatabaseSync | null = null;

export function getTodaySG(): string {
  // Singapore Standard Time (UTC+8)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function initDb(customPath?: string): DatabaseSync {
  const dbPath =
    customPath ??
    process.env.CARELINK_DB_PATH ??
    path.resolve(process.cwd(), 'data', 'carelinksg.sqlite');

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      senior_name TEXT NOT NULL,
      senior_age INTEGER NOT NULL,
      senior_languages TEXT NOT NULL,
      hdb_address TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      allergies TEXT NOT NULL,
      conditions TEXT NOT NULL,
      primary_clinic TEXT NOT NULL,
      primary_doctor TEXT NOT NULL,
      next_appointment TEXT NOT NULL,
      bp_sys_high INTEGER NOT NULL DEFAULT 160,
      bp_sys_low INTEGER NOT NULL DEFAULT 90,
      bp_dia_high INTEGER NOT NULL DEFAULT 100,
      bp_dia_low INTEGER NOT NULL DEFAULT 55,
      glucose_high REAL NOT NULL DEFAULT 14.0,
      glucose_low REAL NOT NULL DEFAULT 4.0,
      hr_high INTEGER NOT NULL DEFAULT 115,
      hr_low INTEGER NOT NULL DEFAULT 50,
      helper_grace_minutes INTEGER NOT NULL DEFAULT 90,
      rest_day_of_week TEXT NOT NULL DEFAULT 'Sunday',
      rest_day_active INTEGER NOT NULL DEFAULT 0,
      on_duty_member TEXT NOT NULL DEFAULT 'Siti Rahayu',
      digest_times TEXT NOT NULL DEFAULT '12:30,20:30',
      region TEXT NOT NULL DEFAULT 'ap-southeast-1'
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL, -- family_admin | family_member | helper | senior
      relationship TEXT NOT NULL,
      language TEXT NOT NULL,
      phone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      risk_tier TEXT NOT NULL, -- high | standard
      time_slots_json TEXT NOT NULL, -- ["morning","evening"]
      instructions_json TEXT NOT NULL, -- {"en":..., "id":..., "ms":..., "zh":..., "ta":...}
      pills_remaining INTEGER NOT NULL DEFAULT 30,
      pills_per_day REAL NOT NULL DEFAULT 1,
      refill_alert_days INTEGER NOT NULL DEFAULT 7,
      clinic_source TEXT NOT NULL DEFAULT 'Toa Payoh Polyclinic (NHG)',
      status TEXT NOT NULL DEFAULT 'active', -- active | pending_approval | archived
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medication_logs (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      med_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      slot TEXT NOT NULL,
      status TEXT NOT NULL, -- taken | exception
      exception_reason TEXT,
      note TEXT,
      proof_photo TEXT,
      logged_by TEXT NOT NULL,
      logged_role TEXT NOT NULL,
      client_event_id TEXT UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vitals (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      type TEXT NOT NULL, -- bp | glucose | hr | wearable_fall
      systolic INTEGER,
      diastolic INTEGER,
      pulse INTEGER,
      glucose_mmol REAL,
      hr_bpm INTEGER,
      source TEXT NOT NULL, -- ocr_confirmed | apple_health | google_health_connect | manual
      confirmed_by TEXT NOT NULL,
      threshold_tier TEXT NOT NULL, -- green | amber | red
      note TEXT,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS care_tasks (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      task_date TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_i18n_json TEXT NOT NULL,
      category TEXT NOT NULL, -- meal | meds | vitals | exercise | walk | hydration
      scheduled_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | done | exception
      exception_note TEXT,
      completed_by TEXT,
      completed_at TEXT,
      client_event_id TEXT
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      kind TEXT NOT NULL, -- pharmacy_med | clinic_diff
      title TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      submitted_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      tier TEXT NOT NULL, -- red | amber | green
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      target_role TEXT NOT NULL DEFAULT 'family', -- family | helper | all
      acknowledged INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clinic_visits (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      clinic_name TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      helper_actions_json TEXT NOT NULL,
      changes_json TEXT NOT NULL,
      doctor_consent_given INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS care_packs (
      pack_key TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS care_pack_entries (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      pack_key TEXT NOT NULL,
      title TEXT NOT NULL,
      details_json TEXT NOT NULL,
      logged_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domain_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  dbInstance = db;
  eventBus.attachDb(db);
  seedIfEmpty(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

function seedIfEmpty(db: DatabaseSync) {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM households').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const hhId = 'hh_lim_sg';
  const today = getTodaySG();
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO households (
      id, senior_name, senior_age, senior_languages, hdb_address, postal_code,
      allergies, conditions, primary_clinic, primary_doctor, next_appointment,
      bp_sys_high, bp_sys_low, bp_dia_high, bp_dia_low,
      glucose_high, glucose_low, hr_high, hr_low,
      helper_grace_minutes, rest_day_of_week, rest_day_active, on_duty_member
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hhId,
    'Mdm Tan Siew Lan (Ah Ma)',
    79,
    'Hokkien, Mandarin',
    'Blk 128 Lorong 1 Toa Payoh #08-412, Singapore 310128',
    '310128',
    'Penicillin (rash), Aspirin (stomach bleeding)',
    'Hypertension, Type 2 Diabetes, Mild Knee Osteoarthritis',
    'Toa Payoh Polyclinic (NHG)',
    'Dr. Cheryl Ng',
    '2026-12-10 09:30 (Toa Payoh Polyclinic — Chronic Care)',
    160,
    90,
    100,
    55,
    14.0,
    4.0,
    115,
    50,
    90,
    'Sunday',
    0,
    'Siti Rahayu',
  );

  // Members
  const insertMember = db.prepare(`
    INSERT INTO members (id, household_id, name, role, relationship, language, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertMember.run('mem_benny', hhId, 'Benny Lim', 'family_admin', 'Eldest Son (Admin)', 'en', '+65 9123 4567');
  insertMember.run('mem_meiling', hhId, 'Mei Ling Lim', 'family_member', 'Daughter', 'en', '+65 9876 5432');
  insertMember.run('mem_siti', hhId, 'Siti Rahayu', 'helper', 'Caregiver / MDW', 'id', '+65 8234 5678');
  insertMember.run('mem_ahma', hhId, 'Mdm Tan Siew Lan', 'senior', 'Mother', 'zh', '+65 6255 1234');

  // Medications (High-Risk vs Standard)
  const insertMed = db.prepare(`
    INSERT INTO medications (
      id, household_id, name, dosage, risk_tier, time_slots_json, instructions_json,
      pills_remaining, pills_per_day, refill_alert_days, clinic_source, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMed.run(
    'med_amlodipine',
    hhId,
    'Amlodipine',
    '5 mg (1 tablet)',
    'high',
    JSON.stringify(['morning']),
    JSON.stringify({
      en: 'Take 1 tablet in the morning for blood pressure. Watch for ankle swelling or dizziness.',
      id: 'Minum 1 tablet pagi hari untuk darah tinggi. Perhatikan jika pusing atau kaki bengkak.',
      ms: 'Makan 1 biji pagi untuk tekanan darah tinggi. Pantau jika pening.',
      zh: '早上服用1粒降血压药。注意是否头晕或脚踝浮肿。',
      ta: 'இரத்த அழுத்தத்திற்கு காலையில் 1 மாத்திரை எடுத்துக்கொள்ளவும். தலைச்சுற்றல் உள்ளதா பார்க்கவும்.',
    }),
    12,
    1,
    7,
    'Toa Payoh Polyclinic (NHG)',
    'active',
    nowIso,
  );

  insertMed.run(
    'med_metformin',
    hhId,
    'Metformin',
    '500 mg (1 tablet)',
    'high',
    JSON.stringify(['morning', 'evening']),
    JSON.stringify({
      en: 'Take 1 tablet WITH or immediately AFTER breakfast & dinner for diabetes.',
      id: 'Minum 1 tablet BERSAMA atau langsung SETELAH sarapan & makan malam (gula darah).',
      ms: 'Makan 1 biji SELEPAS sarapan & makan malam untuk kencing manis.',
      zh: '早餐及晚餐后立即服用1粒降血糖药。',
      ta: 'காலை மற்றும் இரவு உணவுக்குப் பிறகு சர்க்கரை நோய்க்கு 1 மாத்திரை சாப்பிடவும்.',
    }),
    10,
    2,
    7,
    'Toa Payoh Polyclinic (NHG)',
    'active',
    nowIso,
  );

  insertMed.run(
    'med_atorvastatin',
    hhId,
    'Atorvastatin',
    '20 mg (1 tablet)',
    'high',
    JSON.stringify(['bedtime']),
    JSON.stringify({
      en: 'Take 1 tablet at bedtime for cholesterol. Avoid grapefruit.',
      id: 'Minum 1 tablet sebelum tidur untuk kolesterol. Hindari buah grapefruit.',
      ms: 'Makan 1 biji sebelum tidur untuk kolesterol. Elakkan limau gedang.',
      zh: '睡前服用1粒降胆固醇药。避免食用西柚。',
      ta: 'கொலஸ்ட்ராலுக்கு இரவு தூங்கும் முன் 1 மாத்திரை எடுக்கவும்.',
    }),
    26,
    1,
    7,
    'Toa Payoh Polyclinic (NHG)',
    'active',
    nowIso,
  );

  insertMed.run(
    'med_vitd',
    hhId,
    'Calcium + Vitamin D3',
    '600 mg (1 tablet)',
    'standard',
    JSON.stringify(['noon']),
    JSON.stringify({
      en: 'Take 1 tablet after lunch for bone strength.',
      id: 'Minum 1 tablet setelah makan siang untuk kekuatan tulang.',
      ms: 'Makan 1 biji selepas makan tengah hari untuk tulang.',
      zh: '午餐后服用1粒钙片与维生素D。',
      ta: 'எலும்பு வலிமைக்கு மதிய உணவுக்குப் பிறகு 1 மாத்திரை எடுக்கவும்.',
    }),
    38,
    1,
    7,
    'Guardian Pharmacy SG',
    'active',
    nowIso,
  );

  // Seed today's morning medication log (already done by Siti)
  db.prepare(`
    INSERT INTO medication_logs (
      id, household_id, med_id, log_date, slot, status, note, proof_photo, logged_by, logged_role, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'mlog_seed_1',
    hhId,
    'med_amlodipine',
    today,
    'morning',
    'taken',
    'Morning blister tray verified with warm water.',
    'tray_verified_badge',
    'Siti Rahayu',
    'helper',
    new Date(Date.now() - 3 * 3600_000).toISOString(),
  );

  // Seed 14-day vitals history (shows realistic +11 mmHg systolic rise in recent 7 days for Doctor Brief!)
  const insertVital = db.prepare(`
    INSERT INTO vitals (
      id, household_id, type, systolic, diastolic, pulse, glucose_mmol, hr_bpm,
      source, confirmed_by, threshold_tier, note, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const bpHistory: Array<[number, number, number, number]> = [
    // [daysAgo, sys, dia, pulse]
    [13, 130, 76, 70],
    [11, 132, 78, 72],
    [9, 128, 75, 69],
    [8, 134, 79, 73],
    [6, 139, 82, 74],
    [4, 144, 84, 75],
    [2, 146, 85, 76],
    [1, 142, 83, 74],
    [0, 145, 84, 73],
  ];

  bpHistory.forEach(([daysAgo, s, d, p], idx) => {
    const ts = new Date(Date.now() - daysAgo * 86_400_000 - 2 * 3600_000).toISOString();
    insertVital.run(
      `vit_bp_${idx}`,
      hhId,
      'bp',
      s,
      d,
      p,
      null,
      null,
      'ocr_confirmed',
      'Siti Rahayu',
      s >= 148 ? 'amber' : 'green',
      daysAgo === 0 ? 'Morning seated check (Omron LCD confirmed)' : 'Routine morning BP check',
      ts,
    );
  });

  const glucoseHistory: Array<[number, number]> = [
    [12, 6.4],
    [9, 6.8],
    [6, 7.1],
    [3, 7.4],
    [1, 6.9],
    [0, 7.2],
  ];
  glucoseHistory.forEach(([daysAgo, g], idx) => {
    const ts = new Date(Date.now() - daysAgo * 86_400_000 - 3 * 3600_000).toISOString();
    insertVital.run(
      `vit_glu_${idx}`,
      hhId,
      'glucose',
      null,
      null,
      null,
      g,
      null,
      'ocr_confirmed',
      'Siti Rahayu',
      'green',
      'Fasting morning Accu-Chek confirmed',
      ts,
    );
  });

  insertVital.run(
    'vit_hr_0',
    hhId,
    'hr',
    null,
    null,
    null,
    null,
    72,
    'apple_health',
    'Apple Health Sync',
    'green',
    'Resting heart rate synced passively',
    new Date(Date.now() - 3600_000).toISOString(),
  );

  // Seed Today's Daily Care Checklist (Helper-first localized tasks)
  const insertTask = db.prepare(`
    INSERT INTO care_tasks (
      id, household_id, task_date, title_en, title_i18n_json, category, scheduled_time, status, completed_by, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const todayTasks = [
    {
      id: 'task_breakfast',
      en: 'Warm Breakfast (Oat porridge & low-sugar kopi)',
      i18n: {
        en: 'Warm Breakfast (Oat porridge & low-sugar kopi)',
        id: 'Sarapan Hangat (Bubur oat & kopi kurang gula)',
        ms: 'Sarapan Pagi (Bubur oat & kopi kurang gula)',
        zh: '早餐（燕麦粥及少糖咖啡）',
        ta: 'காலை உணவு (ஓட்ஸ் கஞ்சி & குறைந்த சர்க்கரை காபி)',
      },
      category: 'meal',
      time: '07:45',
      status: 'done',
      doneBy: 'Siti Rahayu',
    },
    {
      id: 'task_bp',
      en: 'Morning Blood Pressure & Fasting Glucose Check',
      i18n: {
        en: 'Morning Blood Pressure & Fasting Glucose Check',
        id: 'Cek Tekanan Darah & Gula Darah Pagi',
        ms: 'Semakan Tekanan Darah & Gula Pagi',
        zh: '早晨测量血压与空腹血糖',
        ta: 'காலை இரத்த அழுத்தம் & சர்க்கரை பரிசோதனை',
      },
      category: 'vitals',
      time: '08:15',
      status: 'done',
      doneBy: 'Siti Rahayu',
    },
    {
      id: 'task_morning_meds',
      en: 'Morning Medications (Amlodipine & Metformin)',
      i18n: {
        en: 'Morning Medications (Amlodipine & Metformin)',
        id: 'Obat Pagi (Amlodipine & Metformin setelah makan)',
        ms: 'Ubat Pagi (Amlodipine & Metformin)',
        zh: '早晨服药（降压药与降糖药）',
        ta: 'காலை மாத்திரைகள் (அம்லோடிபின் & மெட்ஃபார்மின்)',
      },
      category: 'meds',
      time: '08:30',
      status: 'pending',
      doneBy: null,
    },
    {
      id: 'task_exercise',
      en: '15-min Seated Knee & Shoulder Stretches',
      i18n: {
        en: '15-min Seated Knee & Shoulder Stretches',
        id: 'Senam Duduk Lutut & Bahu 15 Menit',
        ms: 'Senaman Duduk Lutut & Bahu 15 Minit',
        zh: '15分钟坐姿膝盖与肩部伸展',
        ta: '15 நிமிட அமர்ந்த முழங்கால் & தோள் பயிற்சி',
      },
      category: 'exercise',
      time: '10:30',
      status: 'pending',
      doneBy: null,
    },
    {
      id: 'task_walk',
      en: 'Evening Void-Deck / Park Walk (20 mins, shaded)',
      i18n: {
        en: 'Evening Void-Deck / Park Walk (20 mins, shaded)',
        id: 'Jalan Sore di Taman / Void Deck (20 menit)',
        ms: 'Berjalan Petang di Taman / Kolong Blok (20 minit)',
        zh: '傍晚组屋楼下/公园散步20分钟',
        ta: 'மாலை நடைப்பயிற்சி (20 நிமிடம்)',
      },
      category: 'walk',
      time: '17:30',
      status: 'pending',
      doneBy: null,
    },
  ];

  for (const t of todayTasks) {
    insertTask.run(
      t.id,
      hhId,
      today,
      t.en,
      JSON.stringify(t.i18n),
      t.category,
      t.time,
      t.status,
      t.doneBy,
      t.doneBy ? new Date(Date.now() - 3 * 3600_000).toISOString() : null,
    );
  }

  // Seed 1 realistic pending Family Approval (Polyclinic Prescription Update)
  db.prepare(`
    INSERT INTO approvals (
      id, household_id, kind, title, summary_en, payload_json, submitted_by, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'appr_seed_1',
    hhId,
    'pharmacy_med',
    'New Pharmacy Bag Scanned — Omeprazole 20mg',
    'Siti scanned a Toa Payoh Polyclinic pharmacy bag: Omeprazole 20mg (1 capsule before breakfast for gastric protection, 28 capsules). Approve to add to daily schedule & translate for helper.',
    JSON.stringify({
      name: 'Omeprazole',
      dosage: '20 mg (1 capsule)',
      riskTier: 'standard',
      timeSlots: ['morning'],
      pillsRemaining: 28,
      pillsPerDay: 1,
      clinicSource: 'Toa Payoh Polyclinic (NHG)',
      instructions: {
        en: 'Take 1 capsule 30 mins BEFORE breakfast for stomach protection.',
        id: 'Minum 1 kapsul 30 menit SEBELUM sarapan untuk melindungi lambung.',
        ms: 'Makan 1 kapsul 30 minit SEBELUM sarapan untuk perlindungan perut.',
        zh: '早餐前30分钟服用1粒护胃药。',
        ta: 'காலை உணவுக்கு 30 நிமிடம் முன் வயிற்றுப் பாதுகாப்பிற்கு 1 கேப்சூல் எடுக்கவும்.',
      },
    }),
    'Siti Rahayu',
    'pending',
    new Date(Date.now() - 45 * 60_000).toISOString(),
  );

  // Seed Calm Digest / Alerts
  const insertAlert = db.prepare(`
    INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, acknowledged, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAlert.run(
    'alt_seed_1',
    hhId,
    'green',
    'calm_digest',
    'Morning Calm Summary',
    'Breakfast completed, fasting glucose 7.2 mmol/L (in range), BP 145/84 mmHg (in range). Metformin refill due in 5 days.',
    'family',
    0,
    new Date(Date.now() - 2 * 3600_000).toISOString(),
  );
  insertAlert.run(
    'alt_seed_2',
    hhId,
    'amber',
    'refill',
    'Refill Reminder — Metformin 500mg',
    'Approximately 5 days of Metformin remaining (10 tablets left). Consider submitting a HealthHub polyclinic refill request.',
    'family',
    0,
    new Date(Date.now() - 5 * 3600_000).toISOString(),
  );

  // Seed Opt-In Care Packs (ALL disabled by default to prevent UI bloat!)
  const insertPack = db.prepare(`
    INSERT INTO care_packs (pack_key, household_id, name, description, enabled, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertPack.run(
    'wound_log',
    hhId,
    'Wound & Skin Care Tracker',
    'Timestamped healing photo & dressing log for diabetic foot care, pressure sores, or post-surgery recovery.',
    0,
    nowIso,
  );
  insertPack.run(
    'care_expenses',
    hhId,
    'Care & Grocery Expense Ledger',
    'Simple receipt snap log for wet-market groceries, pharmacy refills, and clinic transport reimbursement with your helper.',
    0,
    nowIso,
  );
  insertPack.run(
    'dementia_safezone',
    hhId,
    'Dementia Routine & Safe-Zone Check-in',
    'Structured sundowning calming cues, wandering ID card, and outdoor walk return check-ins.',
    0,
    nowIso,
  );

  // Seed one prior clinic visit
  db.prepare(`
    INSERT INTO clinic_visits (
      id, household_id, visit_date, clinic_name, summary_en, helper_actions_json, changes_json, doctor_consent_given, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'vis_seed_1',
    hhId,
    '2026-10-15',
    'Toa Payoh Polyclinic (NHG)',
    'Routine 3-highs chronic review with Dr. Cheryl Ng. HbA1c improved to 6.8%. Continue current Metformin & Amlodipine doses; monitor morning BP closely over next 4 weeks.',
    JSON.stringify([
      {
        en: 'Continue Amlodipine 5mg every morning and record BP 4x per week.',
        id: 'Lanjutkan Amlodipine 5mg setiap pagi dan catat tensi 4x seminggu.',
      },
      {
        en: 'Keep low-salt soup and avoid salty preserved vegetables (chai poh).',
        id: 'Kurangi garam di sup dan hindari sayur asin.',
      },
    ]),
    JSON.stringify(['No dosage changes at Oct visit', 'Target morning BP below 140/85 ideally; alert threshold stays 160/100']),
    1,
    'Benny Lim',
    new Date(Date.now() - 40 * 86_400_000).toISOString(),
  );
}
