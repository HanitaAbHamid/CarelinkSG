import express from 'express';
import { getDb, getTodaySG } from './db.js';
import { eventBus } from './eventBus.js';
import {
  compute14DayTrends,
  evaluateThresholds,
  validatePhysiologicalBounds,
  type SafetyThresholds,
  type VitalRowForTrend,
} from './safety.js';
import {
  extractClinicVisitUpdate,
  extractVitalsFromLcd,
  getAiMode,
  parsePharmacyLabel,
  translateCareSpeech,
  type PharmacyOcrDraft,
} from './aiService.js';

export const apiRouter = express.Router();

function getHousehold(hhId = 'hh_lim_sg') {
  const db = getDb();
  return db.prepare('SELECT * FROM households WHERE id = ?').get(hhId) as Record<string, unknown> | undefined;
}

function getThresholdsFromHousehold(hh: Record<string, unknown>): SafetyThresholds {
  return {
    bpSysHigh: Number(hh.bp_sys_high),
    bpSysLow: Number(hh.bp_sys_low),
    bpDiaHigh: Number(hh.bp_dia_high),
    bpDiaLow: Number(hh.bp_dia_low),
    glucoseHigh: Number(hh.glucose_high),
    glucoseLow: Number(hh.glucose_low),
    hrHigh: Number(hh.hr_high),
    hrLow: Number(hh.hr_low),
  };
}

function getRole(req: express.Request): string {
  const role = String(req.headers['x-carelink-role'] || 'family_admin');
  return ['family_admin', 'family_member', 'helper', 'senior'].includes(role) ? role : 'family_admin';
}

function getActor(req: express.Request): string {
  const actor = String(req.headers['x-carelink-actor'] || '').trim();
  if (actor) return actor;
  const role = getRole(req);
  if (role === 'helper') return 'Siti Rahayu';
  if (role === 'senior') return 'Mdm Tan Siew Lan';
  if (role === 'family_member') return 'Mei Ling Lim';
  return 'Benny Lim';
}

apiRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'CareLink SG API',
    region: process.env.DATA_RESIDENCY_REGION || 'ap-southeast-1',
    aiMode: getAiMode(),
    nonSaMDNotice:
      'CareLink SG is a non-diagnostic family care coordination platform, not a registered medical device.',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/state', (req, res) => {
  const db = getDb();
  const hhId = 'hh_lim_sg';
  const role = getRole(req);
  const today = getTodaySG();
  const hh = getHousehold(hhId);
  if (!hh) return res.status(404).json({ error: 'Household not found' });

  const members = db.prepare('SELECT * FROM members WHERE household_id = ?').all(hhId);
  const medications = (
    db
      .prepare(`SELECT * FROM medications WHERE household_id = ? AND status = 'active' ORDER BY risk_tier DESC, name ASC`)
      .all(hhId) as Array<Record<string, unknown>>
  ).map((m) => ({
    ...m,
    timeSlots: JSON.parse(String(m.time_slots_json)),
    instructions: JSON.parse(String(m.instructions_json)),
    daysRemaining: Math.floor(Number(m.pills_remaining) / Math.max(0.5, Number(m.pills_per_day))),
  }));

  const todayMedLogs = db
    .prepare('SELECT * FROM medication_logs WHERE household_id = ? AND log_date = ? ORDER BY created_at DESC')
    .all(hhId, today);

  const recentMedExceptions = db
    .prepare(
      `SELECT ml.*, m.name as med_name
       FROM medication_logs ml
       JOIN medications m ON m.id = ml.med_id
       WHERE ml.household_id = ? AND ml.status = 'exception'
       ORDER BY ml.created_at DESC LIMIT 10`,
    )
    .all(hhId);

  const vitals = db
    .prepare('SELECT * FROM vitals WHERE household_id = ? ORDER BY recorded_at DESC LIMIT 40')
    .all(hhId) as unknown as VitalRowForTrend[];

  const trends = compute14DayTrends(vitals);

  const tasks = (
    db
      .prepare('SELECT * FROM care_tasks WHERE household_id = ? AND task_date = ? ORDER BY scheduled_time ASC')
      .all(hhId, today) as Array<Record<string, unknown>>
  ).map((t) => ({
    ...t,
    titleI18n: JSON.parse(String(t.title_i18n_json)),
  }));

  // RBAC enforcement: helpers see care operations & helper-facing alerts, never admin approvals or private family audit logs
  const approvals =
    role === 'family_admin' || role === 'family_member'
      ? (
          db
            .prepare(`SELECT * FROM approvals WHERE household_id = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 15`)
            .all(hhId) as Array<Record<string, unknown>>
        ).map((a) => ({
          ...a,
          payload: JSON.parse(String(a.payload_json)),
        }))
      : [];

  const alerts =
    role === 'helper'
      ? db
          .prepare(
            `SELECT * FROM alerts WHERE household_id = ? AND target_role IN ('helper', 'all') ORDER BY created_at DESC LIMIT 15`,
          )
          .all(hhId)
      : db
          .prepare('SELECT * FROM alerts WHERE household_id = ? ORDER BY created_at DESC LIMIT 25')
          .all(hhId);

  const clinicVisits = (
    db
      .prepare('SELECT * FROM clinic_visits WHERE household_id = ? ORDER BY created_at DESC LIMIT 10')
      .all(hhId) as Array<Record<string, unknown>>
  ).map((v) => ({
    ...v,
    helperActions: JSON.parse(String(v.helper_actions_json)),
    changes: JSON.parse(String(v.changes_json)),
  }));

  const carePacks = db
    .prepare('SELECT * FROM care_packs WHERE household_id = ? ORDER BY pack_key ASC')
    .all(hhId) as Array<Record<string, unknown>>;

  const enabledKeys = carePacks.filter((p) => Number(p.enabled) === 1).map((p) => String(p.pack_key));
  const carePackEntries =
    enabledKeys.length > 0
      ? (
          db
            .prepare(
              `SELECT * FROM care_pack_entries WHERE household_id = ? AND pack_key IN (${enabledKeys.map(() => '?').join(',')}) ORDER BY created_at DESC LIMIT 20`,
            )
            .all(hhId, ...enabledKeys) as Array<Record<string, unknown>>
        ).map((e) => ({ ...e, details: JSON.parse(String(e.details_json)) }))
      : [];

  const auditEvents =
    role === 'family_admin'
      ? (
          db
            .prepare('SELECT * FROM domain_events ORDER BY created_at DESC LIMIT 20')
            .all() as Array<Record<string, unknown>>
        ).map((e) => ({ ...e, payload: JSON.parse(String(e.payload_json)) }))
      : [];

  return res.json({
    today,
    role,
    aiMode: getAiMode(),
    household: hh,
    thresholds: getThresholdsFromHousehold(hh),
    members,
    medications,
    todayMedLogs,
    recentMedExceptions,
    vitals,
    trends,
    tasks,
    approvals,
    alerts,
    clinicVisits,
    carePacks,
    carePackEntries,
    auditEvents,
  });
});

// Update doctor-set thresholds (Family Admin only)
apiRouter.patch('/household/thresholds', (req, res) => {
  if (getRole(req) !== 'family_admin') {
    return res.status(403).json({ error: 'Only the Family Admin can modify clinician-set safety thresholds.' });
  }
  const db = getDb();
  const {
    bpSysHigh,
    bpSysLow,
    bpDiaHigh,
    bpDiaLow,
    glucoseHigh,
    glucoseLow,
    hrHigh,
    hrLow,
    helperGraceMinutes,
  } = req.body as Partial<SafetyThresholds> & { helperGraceMinutes?: number };

  db.prepare(`
    UPDATE households SET
      bp_sys_high = COALESCE(?, bp_sys_high),
      bp_sys_low = COALESCE(?, bp_sys_low),
      bp_dia_high = COALESCE(?, bp_dia_high),
      bp_dia_low = COALESCE(?, bp_dia_low),
      glucose_high = COALESCE(?, glucose_high),
      glucose_low = COALESCE(?, glucose_low),
      hr_high = COALESCE(?, hr_high),
      hr_low = COALESCE(?, hr_low),
      helper_grace_minutes = COALESCE(?, helper_grace_minutes)
    WHERE id = 'hh_lim_sg'
  `).run(
    bpSysHigh ?? null,
    bpSysLow ?? null,
    bpDiaHigh ?? null,
    bpDiaLow ?? null,
    glucoseHigh ?? null,
    glucoseLow ?? null,
    hrHigh ?? null,
    hrLow ?? null,
    helperGraceMinutes ?? null,
  );

  return res.json({ ok: true, household: getHousehold() });
});

// Toggle MOM Rest-Day Handoff Mode
apiRouter.post('/household/handoff', (req, res) => {
  const db = getDb();
  const { restDayActive, onDutyMember, restDayOfWeek } = req.body as {
    restDayActive: boolean;
    onDutyMember: string;
    restDayOfWeek?: string;
  };

  const activeInt = restDayActive ? 1 : 0;
  const duty = onDutyMember || (restDayActive ? 'Benny Lim' : 'Siti Rahayu');

  db.prepare(`
    UPDATE households
    SET rest_day_active = ?, on_duty_member = ?, rest_day_of_week = COALESCE(?, rest_day_of_week)
    WHERE id = 'hh_lim_sg'
  `).run(activeInt, duty, restDayOfWeek ?? null);

  const actor = getActor(req);
  eventBus.emit('HandoffActivated', actor, getRole(req), {
    restDayActive,
    onDutyMember: duty,
  });

  db.prepare(`
    INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
    VALUES (?, 'hh_lim_sg', 'green', 'handoff', ?, ?, 'all', ?)
  `).run(
    `alt_${Date.now()}`,
    restDayActive ? `Rest-Day Handoff Active (${duty} on duty)` : 'Normal Weekday Care Schedule Resumed',
    restDayActive
      ? `Helper work notifications are silenced for MOM rest day. ${duty} now owns today's care checklist.`
      : `Care routine handed back to Siti Rahayu with all Sunday logs preserved.`,
    new Date().toISOString(),
  );

  return res.json({ ok: true, household: getHousehold() });
});

// Step 1 of Snap-and-Confirm LCD OCR (NEVER writes directly to DB)
apiRouter.post('/vitals/ocr-preview', async (req, res) => {
  const { deviceType, imageDataUrl, sampleScenario } = req.body as {
    deviceType: 'bp' | 'glucose';
    imageDataUrl?: string;
    sampleScenario?: 'normal_bp' | 'high_bp' | 'glare_error_glucose' | 'normal_glucose';
  };

  if (deviceType !== 'bp' && deviceType !== 'glucose') {
    return res.status(400).json({ error: 'deviceType must be "bp" or "glucose"' });
  }

  const preview = await extractVitalsFromLcd({ deviceType, imageDataUrl, sampleScenario });
  const sanity = validatePhysiologicalBounds({
    type: deviceType,
    systolic: preview.systolic,
    diastolic: preview.diastolic,
    pulse: preview.pulse,
    glucoseMmol: preview.glucoseMmol,
  });

  return res.json({
    preview,
    sanity,
    requiresHumanConfirmation: true,
  });
});

// Step 2: Human-Confirmed Vitals Save + Deterministic Threshold Evaluation
apiRouter.post('/vitals/confirm', (req, res) => {
  const db = getDb();
  const hh = getHousehold();
  if (!hh) return res.status(404).json({ error: 'Household not found' });

  const { type, systolic, diastolic, pulse, glucoseMmol, hrBpm, source, note, humanConfirmed } = req.body as {
    type: 'bp' | 'glucose' | 'hr' | 'wearable_fall';
    systolic?: number | null;
    diastolic?: number | null;
    pulse?: number | null;
    glucoseMmol?: number | null;
    hrBpm?: number | null;
    source?: string;
    note?: string;
    humanConfirmed?: boolean;
  };

  if (source === 'ocr_confirmed' && !humanConfirmed) {
    return res.status(400).json({
      error: 'Human confirmation tap is mandatory for LCD OCR vitals to prevent glare hallucinations.',
    });
  }

  const sanity = validatePhysiologicalBounds({ type, systolic, diastolic, pulse, glucoseMmol, hrBpm });
  if (!sanity.valid) {
    return res.status(422).json({
      error: 'Physiological sanity check rejected this reading.',
      errors: sanity.errors,
      warnings: sanity.warnings,
    });
  }

  const thresholds = getThresholdsFromHousehold(hh);
  const evaluation = evaluateThresholds({ type, systolic, diastolic, pulse, glucoseMmol, hrBpm }, thresholds);

  const actor = getActor(req);
  const role = getRole(req);
  const id = `vit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO vitals (
      id, household_id, type, systolic, diastolic, pulse, glucose_mmol, hr_bpm,
      source, confirmed_by, threshold_tier, note, recorded_at
    ) VALUES (?, 'hh_lim_sg', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    type,
    systolic ?? null,
    diastolic ?? null,
    pulse ?? null,
    glucoseMmol ?? null,
    hrBpm ?? null,
    source || 'ocr_confirmed',
    actor,
    evaluation.tier,
    note || null,
    now,
  );

  eventBus.emit('VitalConfirmed', actor, role, {
    vitalId: id,
    type,
    tier: evaluation.tier,
    triggeredRule: evaluation.triggeredRule,
  });

  if (evaluation.tier === 'red' || evaluation.tier === 'amber') {
    db.prepare(`
      INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
      VALUES (?, 'hh_lim_sg', ?, 'vital_threshold', ?, ?, 'all', ?)
    `).run(
      `alt_${Date.now()}`,
      evaluation.tier,
      evaluation.tier === 'red'
        ? `Tier 1 Red Alert: ${evaluation.triggeredRule}`
        : `Tier 2 Watch: ${evaluation.triggeredRule}`,
      evaluation.familyMessage,
      now,
    );

    if (evaluation.tier === 'red') {
      eventBus.emit('EscalationTriggered', actor, role, {
        tier: 'red',
        reason: evaluation.triggeredRule,
        vitalId: id,
      });
    }
  }

  return res.status(201).json({
    ok: true,
    vitalId: id,
    evaluation,
    warnings: sanity.warnings,
  });
});

// Passive Apple Health / Google Health Connect sync endpoint
apiRouter.post('/vitals/wearable-sync', (req, res) => {
  const db = getDb();
  const hh = getHousehold();
  if (!hh) return res.status(404).json({ error: 'Household not found' });

  const { platform, hrBpm, possibleFall } = req.body as {
    platform: 'apple_health' | 'google_health_connect';
    hrBpm?: number;
    possibleFall?: boolean;
  };

  const thresholds = getThresholdsFromHousehold(hh);
  const now = new Date().toISOString();
  const created: string[] = [];

  if (possibleFall) {
    const id = `vit_fall_${Date.now()}`;
    db.prepare(`
      INSERT INTO vitals (id, household_id, type, source, confirmed_by, threshold_tier, note, recorded_at)
      VALUES (?, 'hh_lim_sg', 'wearable_fall', ?, ?, 'red', 'Native OS watch fall alert relayed', ?)
    `).run(id, platform || 'apple_health', 'OS Wearable Bridge', now);
    db.prepare(`
      INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
      VALUES (?, 'hh_lim_sg', 'red', 'fall', 'Possible Fall Detected (OS Watch)', 'Connected watch triggered native fall detection. Check on Ah Ma immediately or contact caregiver.', 'all', ?)
    `).run(`alt_fall_${Date.now()}`, now);
    eventBus.emit('EscalationTriggered', 'OS Wearable Bridge', 'system', { type: 'wearable_fall', platform });
    created.push(id);
  }

  if (hrBpm != null) {
    const sanity = validatePhysiologicalBounds({ type: 'hr', hrBpm });
    if (sanity.valid) {
      const ev = evaluateThresholds({ type: 'hr', hrBpm }, thresholds);
      const id = `vit_hr_${Date.now()}`;
      db.prepare(`
        INSERT INTO vitals (id, household_id, type, hr_bpm, source, confirmed_by, threshold_tier, note, recorded_at)
        VALUES (?, 'hh_lim_sg', 'hr', ?, ?, 'OS Passive Sync', ?, 'Synced via native health aggregator', ?)
      `).run(id, hrBpm, platform || 'apple_health', ev.tier, now);
      if (ev.tier === 'red') {
        db.prepare(`
          INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
          VALUES (?, 'hh_lim_sg', 'red', 'vital_threshold', ?, ?, 'family', ?)
        `).run(`alt_hr_${Date.now()}`, `Heart Rate Alert (${hrBpm} bpm)`, ev.familyMessage, now);
      }
      created.push(id);
    }
  }

  return res.status(201).json({ ok: true, createdIds: created });
});

// Pharmacy Bag Label OCR -> ALWAYS submits to Family Approval Inbox (never auto-activates!)
apiRouter.post('/medications/ocr-label', async (req, res) => {
  const db = getDb();
  const { imageDataUrl, labelText } = req.body as { imageDataUrl?: string; labelText?: string };
  const draft = await parsePharmacyLabel({ imageDataUrl, labelText });

  const actor = getActor(req);
  const approvalId = `appr_${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO approvals (
      id, household_id, kind, title, summary_en, payload_json, submitted_by, status, created_at
    ) VALUES (?, 'hh_lim_sg', 'pharmacy_med', ?, ?, ?, ?, 'pending', ?)
  `).run(
    approvalId,
    `Pharmacy Bag OCR — ${draft.name} ${draft.dosage}`,
    `${actor} scanned a pharmacy label from ${draft.clinicSource}: ${draft.name} (${draft.dosage}), ${draft.riskTier === 'high' ? 'High-Risk tier' : 'Standard tier'}, ${draft.pillsRemaining} pills. Review & approve to activate on daily checklist.`,
    JSON.stringify({
      name: draft.name,
      dosage: draft.dosage,
      riskTier: draft.riskTier,
      timeSlots: draft.timeSlots,
      pillsRemaining: draft.pillsRemaining,
      pillsPerDay: draft.pillsPerDay,
      clinicSource: draft.clinicSource,
      instructions: draft.instructions,
    }),
    actor,
    now,
  );

  db.prepare(`
    INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
    VALUES (?, 'hh_lim_sg', 'amber', 'approval_needed', ?, ?, 'family', ?)
  `).run(
    `alt_${Date.now()}`,
    `Approval Needed: ${draft.name}`,
    `${actor} scanned a new pharmacy bag. Please review and approve before it activates.`,
    now,
  );

  return res.status(201).json({
    ok: true,
    approvalId,
    draft,
    requiresFamilyApproval: true,
  });
});

// Family Admin approves or rejects pending medication / clinic update
apiRouter.post('/approvals/:id/decide', (req, res) => {
  const role = getRole(req);
  if (role !== 'family_admin' && role !== 'family_member') {
    return res.status(403).json({ error: 'Only family members can approve medication changes.' });
  }

  const db = getDb();
  const { decision } = req.body as { decision: 'approve' | 'reject' };
  const approval = db
    .prepare('SELECT * FROM approvals WHERE id = ? AND household_id = ?')
    .get(req.params.id, 'hh_lim_sg') as Record<string, unknown> | undefined;

  if (!approval) return res.status(404).json({ error: 'Approval item not found' });
  if (approval.status !== 'pending') {
    return res.status(409).json({ error: 'Approval item already decided' });
  }

  const actor = getActor(req);
  const now = new Date().toISOString();
  const newStatus = decision === 'approve' ? 'approved' : 'rejected';

  db.prepare('UPDATE approvals SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
    newStatus,
    actor,
    now,
    String(approval.id),
  );

  let createdMedId: string | null = null;
  if (decision === 'approve') {
    const payload = JSON.parse(String(approval.payload_json)) as Omit<PharmacyOcrDraft, 'mode'>;
    createdMedId = `med_${Date.now()}`;
    db.prepare(`
      INSERT INTO medications (
        id, household_id, name, dosage, risk_tier, time_slots_json, instructions_json,
        pills_remaining, pills_per_day, refill_alert_days, clinic_source, status, created_at
      ) VALUES (?, 'hh_lim_sg', ?, ?, ?, ?, ?, ?, ?, 7, ?, 'active', ?)
    `).run(
      createdMedId,
      payload.name,
      payload.dosage,
      payload.riskTier || 'standard',
      JSON.stringify(payload.timeSlots || ['morning']),
      JSON.stringify(payload.instructions || { en: 'Take as directed by clinic.' }),
      payload.pillsRemaining || 30,
      payload.pillsPerDay || 1,
      payload.clinicSource || 'Singapore Clinic',
      now,
    );

    eventBus.emit('PrescriptionDiffApproved', actor, role, {
      approvalId: approval.id,
      medId: createdMedId,
      medName: payload.name,
    });

    db.prepare(`
      INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
      VALUES (?, 'hh_lim_sg', 'green', 'med_approved', ?, ?, 'all', ?)
    `).run(
      `alt_${Date.now()}`,
      `Approved: ${payload.name} ${payload.dosage}`,
      `${actor} verified and activated ${payload.name}. Translated instructions are now live on the helper schedule.`,
      now,
    );
  }

  return res.json({ ok: true, status: newStatus, createdMedId });
});

// Log Medication Given (Risk-Tiered Proof) or Non-Punitive Exception
apiRouter.post('/medications/log', (req, res) => {
  const db = getDb();
  const { medId, slot, status, exceptionReason, note, proofPhoto, clientEventId } = req.body as {
    medId: string;
    slot: string;
    status: 'taken' | 'exception';
    exceptionReason?: string;
    note?: string;
    proofPhoto?: string;
    clientEventId?: string;
  };

  if (clientEventId) {
    const existing = db.prepare('SELECT id FROM medication_logs WHERE client_event_id = ?').get(clientEventId);
    if (existing) return res.json({ ok: true, deduplicated: true });
  }

  const med = db.prepare('SELECT * FROM medications WHERE id = ?').get(medId) as Record<string, unknown> | undefined;
  if (!med) return res.status(404).json({ error: 'Medication not found' });

  const actor = getActor(req);
  const role = getRole(req);
  const today = getTodaySG();
  const now = new Date().toISOString();
  const id = `mlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  db.prepare(`
    INSERT INTO medication_logs (
      id, household_id, med_id, log_date, slot, status, exception_reason, note,
      proof_photo, logged_by, logged_role, client_event_id, created_at
    ) VALUES (?, 'hh_lim_sg', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    medId,
    today,
    slot || 'morning',
    status,
    exceptionReason ?? null,
    note ?? null,
    proofPhoto ?? null,
    actor,
    role,
    clientEventId ?? null,
    now,
  );

  if (status === 'taken') {
    const nextRemaining = Math.max(0, Number(med.pills_remaining) - 1);
    db.prepare('UPDATE medications SET pills_remaining = ? WHERE id = ?').run(nextRemaining, medId);

    const daysLeft = nextRemaining / Math.max(0.5, Number(med.pills_per_day));
    if (daysLeft <= Number(med.refill_alert_days)) {
      db.prepare(`
        INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
        VALUES (?, 'hh_lim_sg', 'amber', 'refill', ?, ?, 'family', ?)
      `).run(
        `alt_refill_${Date.now()}`,
        `Low Supply: ${String(med.name)}`,
        `${nextRemaining} tablets left (~${Math.floor(daysLeft)} days). Please arrange a HealthHub/polyclinic refill.`,
        now,
      );
    }
  } else {
    // Constructive, non-punitive family visibility when helper reports refusal/unwell
    const tier = med.risk_tier === 'high' ? 'amber' : 'green';
    db.prepare(`
      INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
      VALUES (?, 'hh_lim_sg', ?, 'med_exception', ?, ?, 'family', ?)
    `).run(
      `alt_mexc_${Date.now()}`,
      tier,
      `Caregiver Reported Exception: ${String(med.name)} (${slot})`,
      `${actor} logged "${exceptionReason || 'could not give'}"${note ? ` — "${note}"` : ''}. Thank them for transparent reporting and check in if symptoms persist.`,
      now,
    );
  }

  eventBus.emit('MedEventLogged', actor, role, {
    logId: id,
    medId,
    medName: med.name,
    riskTier: med.risk_tier,
    status,
    exceptionReason: exceptionReason ?? null,
    hasTrayProof: Boolean(proofPhoto),
  });

  return res.status(201).json({ ok: true, id });
});

// Daily Care Task Update (supports offline queue idempotency)
apiRouter.post('/tasks/:id/update', (req, res) => {
  const db = getDb();
  const { status, exceptionNote, clientEventId } = req.body as {
    status: 'pending' | 'done' | 'exception';
    exceptionNote?: string;
    clientEventId?: string;
  };

  const task = db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const actor = getActor(req);
  const role = getRole(req);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE care_tasks
    SET status = ?, exception_note = ?, completed_by = ?, completed_at = ?, client_event_id = COALESCE(?, client_event_id)
    WHERE id = ?
  `).run(
    status,
    exceptionNote ?? null,
    status === 'pending' ? null : actor,
    status === 'pending' ? null : now,
    clientEventId ?? null,
    String(task.id),
  );

  eventBus.emit('CareTaskCompleted', actor, role, {
    taskId: task.id,
    title: task.title_en,
    status,
    exceptionNote: exceptionNote ?? null,
  });

  if (status === 'exception') {
    db.prepare(`
      INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
      VALUES (?, 'hh_lim_sg', 'amber', 'task_exception', ?, ?, 'family', ?)
    `).run(
      `alt_texc_${Date.now()}`,
      `Routine Note: ${String(task.title_en)}`,
      `${actor} flagged an exception${exceptionNote ? `: "${exceptionNote}"` : ''}. Included in Calm Digest.`,
      now,
    );
  }

  return res.json({ ok: true });
});

// Add Custom Care Task
apiRouter.post('/tasks', (req, res) => {
  const db = getDb();
  const { titleEn, category, scheduledTime } = req.body as {
    titleEn: string;
    category?: string;
    scheduledTime?: string;
  };
  if (!titleEn?.trim()) return res.status(400).json({ error: 'titleEn is required' });

  const id = `task_${Date.now()}`;
  const today = getTodaySG();
  db.prepare(`
    INSERT INTO care_tasks (id, household_id, task_date, title_en, title_i18n_json, category, scheduled_time, status)
    VALUES (?, 'hh_lim_sg', ?, ?, ?, ?, ?, 'pending')
  `).run(
    id,
    today,
    titleEn.trim(),
    JSON.stringify({ en: titleEn.trim(), id: titleEn.trim(), ms: titleEn.trim(), zh: titleEn.trim(), ta: titleEn.trim() }),
    category || 'exercise',
    scheduledTime || '15:00',
  );
  return res.status(201).json({ ok: true, id });
});

// Multilingual AI Eldercare Translation
apiRouter.post('/translate', async (req, res) => {
  const { text, fromLang, toLang } = req.body as { text: string; fromLang: string; toLang: string };
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
  const result = await translateCareSpeech({
    text: text.trim(),
    fromLang: fromLang || 'id',
    toLang: toLang || 'zh',
  });
  return res.json(result);
});

// Pre-Visit 1-Page Clinical Doctor Brief
apiRouter.get('/clinic/brief', (_req, res) => {
  const db = getDb();
  const hh = getHousehold();
  if (!hh) return res.status(404).json({ error: 'Household not found' });

  const vitals = db
    .prepare('SELECT * FROM vitals WHERE household_id = ? ORDER BY recorded_at DESC LIMIT 60')
    .all('hh_lim_sg') as unknown as VitalRowForTrend[];
  const trends = compute14DayTrends(vitals);

  const activeMeds = (
    db
      .prepare(`SELECT name, dosage, risk_tier, time_slots_json, pills_remaining, clinic_source FROM medications WHERE household_id = 'hh_lim_sg' AND status = 'active'`)
      .all() as Array<Record<string, unknown>>
  ).map((m) => ({
    ...m,
    timeSlots: JSON.parse(String(m.time_slots_json)),
  }));

  const recentLogs = db
    .prepare(
      `SELECT ml.status, ml.exception_reason, ml.note, ml.created_at, m.name as med_name
       FROM medication_logs ml JOIN medications m ON m.id = ml.med_id
       WHERE ml.household_id = 'hh_lim_sg' ORDER BY ml.created_at DESC LIMIT 30`,
    )
    .all() as Array<Record<string, unknown>>;

  const totalLogs = recentLogs.length;
  const takenLogs = recentLogs.filter((l) => l.status === 'taken').length;
  const adherencePct = totalLogs ? Math.round((takenLogs / totalLogs) * 100) : 100;
  const symptomExceptions = recentLogs.filter((l) => l.status === 'exception');

  return res.json({
    generatedAt: new Date().toISOString(),
    disclaimer:
      'Non-diagnostic home care summary prepared by family/caregiver to assist clinical consultation.',
    senior: {
      name: hh.senior_name,
      age: hh.senior_age,
      allergies: hh.allergies,
      conditions: hh.conditions,
      primaryClinic: hh.primary_clinic,
      primaryDoctor: hh.primary_doctor,
    },
    adherencePct,
    trends,
    activeMeds,
    symptomExceptions,
    recentBpReadings: vitals.filter((v) => v.type === 'bp').slice(0, 7),
    recentGlucoseReadings: vitals.filter((v) => v.type === 'glucose').slice(0, 7),
  });
});

// Post-Visit Update Capture (enforces PDPA consent banner acknowledgment when capturing clinic discussion)
apiRouter.post('/clinic/visit-update', async (req, res) => {
  const db = getDb();
  const { clinicName, rawNotes, imageDataUrl, doctorConsentGiven } = req.body as {
    clinicName?: string;
    rawNotes?: string;
    imageDataUrl?: string;
    doctorConsentGiven?: boolean;
  };

  if (!doctorConsentGiven) {
    return res.status(400).json({
      error: 'PDPA Safeguard: Confirm that clinic/doctor consent was obtained before capturing visit notes or audio.',
    });
  }

  const clinic = clinicName?.trim() || 'Toa Payoh Polyclinic (NHG)';
  const extraction = await extractClinicVisitUpdate({
    clinicName: clinic,
    rawNotes: rawNotes || '',
    imageDataUrl,
  });

  const actor = getActor(req);
  const role = getRole(req);
  const now = new Date().toISOString();
  const visitId = `vis_${Date.now()}`;

  db.prepare(`
    INSERT INTO clinic_visits (
      id, household_id, visit_date, clinic_name, summary_en, helper_actions_json,
      changes_json, doctor_consent_given, created_by, created_at
    ) VALUES (?, 'hh_lim_sg', ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    visitId,
    getTodaySG(),
    clinic,
    extraction.summaryEn,
    JSON.stringify(extraction.helperActions),
    JSON.stringify(extraction.changes),
    actor,
    now,
  );

  let approvalId: string | null = null;
  if (extraction.proposedMedApproval) {
    approvalId = `appr_clin_${Date.now()}`;
    db.prepare(`
      INSERT INTO approvals (
        id, household_id, kind, title, summary_en, payload_json, submitted_by, status, created_at
      ) VALUES (?, 'hh_lim_sg', 'clinic_diff', ?, ?, ?, ?, 'pending', ?)
    `).run(
      approvalId,
      extraction.proposedMedApproval.title,
      extraction.proposedMedApproval.summaryEn,
      JSON.stringify(extraction.proposedMedApproval.payload),
      actor,
      now,
    );
  }

  eventBus.emit('ClinicUpdateCaptured', actor, role, { visitId, clinic, approvalId });

  return res.status(201).json({
    ok: true,
    visitId,
    approvalId,
    extraction,
  });
});

// Trigger Tier 1 Emergency 995 Action Card
apiRouter.post('/emergency/trigger', (req, res) => {
  const db = getDb();
  const hh = getHousehold();
  if (!hh) return res.status(404).json({ error: 'Household not found' });

  const { reason } = req.body as { reason?: string };
  const actor = getActor(req);
  const role = getRole(req);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO alerts (id, household_id, tier, category, title, message, target_role, created_at)
    VALUES (?, 'hh_lim_sg', 'red', 'emergency', ?, ?, 'all', ?)
  `).run(
    `alt_emg_${Date.now()}`,
    'TIER 1 EMERGENCY TRIGGERED',
    `${actor} opened the Emergency 995 Action Card (${reason || 'Urgent assistance requested'}). Call family/helper immediately.`,
    now,
  );

  eventBus.emit('EmergencyTriggered', actor, role, { reason: reason || 'urgent' });

  return res.status(201).json({
    ok: true,
    dispatcherScriptEn: `Hello SCDF 995, I need an ambulance at ${hh.hdb_address}. The patient is ${hh.senior_name}, age ${hh.senior_age}. Medical history: ${hh.conditions}. Drug allergies: ${hh.allergies}.`,
  });
});

// Acknowledge Alert
apiRouter.post('/alerts/:id/ack', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id);
  return res.json({ ok: true });
});

// Opt-In Care Packs (Anti-Bloat Modularity)
apiRouter.post('/care-packs/:packKey/toggle', (req, res) => {
  const role = getRole(req);
  if (role !== 'family_admin') {
    return res.status(403).json({ error: 'Only Family Admin can enable or disable Care Packs.' });
  }
  const db = getDb();
  const { enabled } = req.body as { enabled: boolean };
  const now = new Date().toISOString();

  const result = db
    .prepare(`UPDATE care_packs SET enabled = ?, updated_at = ? WHERE pack_key = ? AND household_id = 'hh_lim_sg'`)
    .run(enabled ? 1 : 0, now, req.params.packKey);

  if (result.changes === 0) return res.status(404).json({ error: 'Care pack not found' });

  eventBus.emit('CarePackToggled', getActor(req), role, {
    packKey: req.params.packKey,
    enabled: Boolean(enabled),
  });

  return res.json({ ok: true });
});

apiRouter.post('/care-packs/:packKey/entries', (req, res) => {
  const db = getDb();
  const pack = db
    .prepare(`SELECT enabled FROM care_packs WHERE pack_key = ? AND household_id = 'hh_lim_sg'`)
    .get(req.params.packKey) as { enabled: number } | undefined;
  if (!pack || pack.enabled !== 1) {
    return res.status(400).json({ error: 'This Care Pack is currently disabled.' });
  }

  const { title, details } = req.body as { title: string; details?: Record<string, unknown> };
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const id = `cpe_${Date.now()}`;
  db.prepare(`
    INSERT INTO care_pack_entries (id, household_id, pack_key, title, details_json, logged_by, created_at)
    VALUES (?, 'hh_lim_sg', ?, ?, ?, ?, ?)
  `).run(id, req.params.packKey, title.trim(), JSON.stringify(details || {}), getActor(req), new Date().toISOString());

  return res.status(201).json({ ok: true, id });
});

// PDPA Zero-Lock-In Data Portability Export (JSON or CSV)
apiRouter.get('/export', (req, res) => {
  const db = getDb();
  const format = String(req.query.format || 'json').toLowerCase();
  const hh = getHousehold();
  const vitals = db.prepare('SELECT * FROM vitals ORDER BY recorded_at DESC').all() as Array<Record<string, unknown>>;
  const medications = db.prepare('SELECT * FROM medications').all();
  const medicationLogs = db.prepare('SELECT * FROM medication_logs ORDER BY created_at DESC').all();
  const clinicVisits = db.prepare('SELECT * FROM clinic_visits ORDER BY created_at DESC').all();

  if (format === 'csv') {
    const header = 'recorded_at,type,systolic,diastolic,pulse,glucose_mmol,hr_bpm,source,confirmed_by,threshold_tier,note';
    const lines = vitals.map((v) =>
      [
        v.recorded_at,
        v.type,
        v.systolic ?? '',
        v.diastolic ?? '',
        v.pulse ?? '',
        v.glucose_mmol ?? '',
        v.hr_bpm ?? '',
        v.source,
        v.confirmed_by,
        v.threshold_tier,
        `"${String(v.note ?? '').replace(/"/g, '""')}"`,
      ].join(','),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="carelinksg-vitals-export.csv"');
    return res.send([header, ...lines].join('\n'));
  }

  res.setHeader('Content-Disposition', 'attachment; filename="carelinksg-full-export.json"');
  return res.json({
    exportedAt: new Date().toISOString(),
    pdpaPortabilityNotice: 'Complete self-serve household health & care record export (Singapore ap-southeast-1).',
    household: hh,
    medications,
    medicationLogs,
    vitals,
    clinicVisits,
  });
});
