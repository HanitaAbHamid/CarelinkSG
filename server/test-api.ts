import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.CARELINK_DB_PATH = ':memory:';
process.env.GEMINI_API_KEY = '';

const { createApp } = await import('./index.js');

const app = createApp();
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  server.once('listening', () => resolve());
  server.once('error', reject);
});
const port = (server.address() as AddressInfo).port;
const base = `http://127.0.0.1:${port}/api`;

async function req(path: string, opts: RequestInit = {}, role = 'family_admin') {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-carelink-role': role,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // CSV or plain text
  }
  return { status: res.status, body };
}

try {
  // 1. Health & Non-SaMD residency check
  const health = await req('/health');
  assert.equal(health.status, 200);
  assert.equal((health.body as Record<string, unknown>).region, 'ap-southeast-1');
  assert.equal((health.body as Record<string, unknown>).aiMode, 'offline_fallback');

  // 2. RBAC check: helper cannot see pending approvals or change thresholds
  const helperState = await req('/state', {}, 'helper');
  assert.equal(helperState.status, 200);
  assert.equal(((helperState.body as Record<string, unknown>).approvals as unknown[]).length, 0);
  const forbiddenThreshold = await req(
    '/household/thresholds',
    { method: 'PATCH', body: JSON.stringify({ bpSysHigh: 190 }) },
    'helper',
  );
  assert.equal(forbiddenThreshold.status, 403);

  // 3. OCR glare preview + mandatory human confirmation + physiological bounds rejection
  const glarePreview = await req(
    '/vitals/ocr-preview',
    { method: 'POST', body: JSON.stringify({ deviceType: 'glucose', sampleScenario: 'glare_error_glucose' }) },
    'helper',
  );
  assert.equal(glarePreview.status, 200);
  assert.equal((glarePreview.body as { preview: { glareRisk: boolean } }).preview.glareRisk, true);
  assert.ok((glarePreview.body as { sanity: { warnings: string[] } }).sanity.warnings.length > 0);

  const unconfirmedOcr = await req(
    '/vitals/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ type: 'bp', systolic: 130, diastolic: 80, source: 'ocr_confirmed', humanConfirmed: false }),
    },
    'helper',
  );
  assert.equal(unconfirmedOcr.status, 400);

  const impossibleBp = await req(
    '/vitals/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ type: 'bp', systolic: 85, diastolic: 95, source: 'ocr_confirmed', humanConfirmed: true }),
    },
    'helper',
  );
  assert.equal(impossibleBp.status, 422);

  const mgdlMistake = await req(
    '/vitals/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ type: 'glucose', glucoseMmol: 180, source: 'ocr_confirmed', humanConfirmed: true }),
    },
    'helper',
  );
  assert.equal(mgdlMistake.status, 422);

  // 4. Deterministic Red Threshold Alert on confirmed high BP
  const highBp = await req(
    '/vitals/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ type: 'bp', systolic: 168, diastolic: 96, pulse: 82, source: 'ocr_confirmed', humanConfirmed: true }),
    },
    'helper',
  );
  assert.equal(highBp.status, 201);
  assert.equal((highBp.body as { evaluation: { tier: string } }).evaluation.tier, 'red');

  // 5. Pharmacy Bag OCR -> queues approval -> Family Admin approves
  const ocrMed = await req(
    '/medications/ocr-label',
    { method: 'POST', body: JSON.stringify({ labelText: 'Losartan 50mg morning blood pressure' }) },
    'helper',
  );
  assert.equal(ocrMed.status, 201);
  const approvalId = (ocrMed.body as { approvalId: string }).approvalId;
  const approved = await req(
    `/approvals/${approvalId}/decide`,
    { method: 'POST', body: JSON.stringify({ decision: 'approve' }) },
    'family_admin',
  );
  assert.equal(approved.status, 200);
  assert.ok((approved.body as { createdMedId: string }).createdMedId);

  // 6. Non-punitive medication exception & idempotent offline logging
  const clientEventId = 'offline_evt_test_1';
  const medExc = await req(
    '/medications/log',
    {
      method: 'POST',
      body: JSON.stringify({
        medId: 'med_metformin',
        slot: 'morning',
        status: 'exception',
        exceptionReason: 'dizzy',
        note: 'Ah Ma felt slightly giddy after breakfast',
        clientEventId,
      }),
    },
    'helper',
  );
  assert.equal(medExc.status, 201);
  const dedup = await req(
    '/medications/log',
    {
      method: 'POST',
      body: JSON.stringify({
        medId: 'med_metformin',
        slot: 'morning',
        status: 'exception',
        clientEventId,
      }),
    },
    'helper',
  );
  assert.equal((dedup.body as { deduplicated: boolean }).deduplicated, true);

  // 7. Rest-Day Handoff
  const handoff = await req(
    '/household/handoff',
    { method: 'POST', body: JSON.stringify({ restDayActive: true, onDutyMember: 'Benny Lim' }) },
    'family_admin',
  );
  assert.equal(handoff.status, 200);
  assert.equal((handoff.body as { household: { rest_day_active: number } }).household.rest_day_active, 1);

  // 8. Clinic Co-Pilot PDPA consent enforcement + Doctor Brief
  const noConsent = await req(
    '/clinic/visit-update',
    { method: 'POST', body: JSON.stringify({ clinicName: 'Toa Payoh Polyclinic', rawNotes: 'Increase Amlodipine 10mg', doctorConsentGiven: false }) },
    'helper',
  );
  assert.equal(noConsent.status, 400);

  const withConsent = await req(
    '/clinic/visit-update',
    { method: 'POST', body: JSON.stringify({ clinicName: 'Toa Payoh Polyclinic', rawNotes: 'Increase Amlodipine to 10mg daily', doctorConsentGiven: true }) },
    'helper',
  );
  assert.equal(withConsent.status, 201);
  assert.ok((withConsent.body as { approvalId: string }).approvalId);

  const brief = await req('/clinic/brief');
  assert.equal(brief.status, 200);
  assert.ok((brief.body as { trends: { nonDiagnosticObservations: string[] } }).trends.nonDiagnosticObservations.length > 0);

  // 9. Opt-In Care Packs (disabled by default -> reject entry -> enable -> accept entry)
  const blockedEntry = await req(
    '/care-packs/care_expenses/entries',
    { method: 'POST', body: JSON.stringify({ title: 'Wet market vegetables', details: { amountSgd: 14.5 } }) },
    'helper',
  );
  assert.equal(blockedEntry.status, 400);

  const enablePack = await req(
    '/care-packs/care_expenses/toggle',
    { method: 'POST', body: JSON.stringify({ enabled: true }) },
    'family_admin',
  );
  assert.equal(enablePack.status, 200);

  const addedEntry = await req(
    '/care-packs/care_expenses/entries',
    { method: 'POST', body: JSON.stringify({ title: 'Wet market vegetables', details: { amountSgd: 14.5 } }) },
    'helper',
  );
  assert.equal(addedEntry.status, 201);

  // 10. Multilingual translation & PDPA CSV/JSON export
  const tr = await req('/translate', {
    method: 'POST',
    body: JSON.stringify({ text: 'Nenek merasa pusing?', fromLang: 'id', toLang: 'hokkien' }),
  });
  assert.equal(tr.status, 200);
  assert.ok(String((tr.body as { translatedText: string }).translatedText).length > 0);

  const csvExport = await req('/export?format=csv');
  assert.equal(csvExport.status, 200);
  assert.ok(String(csvExport.body).startsWith('recorded_at,type,systolic'));

  console.log('✅ All 10 CareLink SG API & safety invariant test suites passed!');
} finally {
  server.close();
}
