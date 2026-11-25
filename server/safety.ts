/**
 * Non-SaMD Deterministic Safety & Physiological Guardrail Engine
 *
 * Regulatory boundary (Singapore HSA SaMD compliance):
 * - Strictly validates physiological plausibility to catch OCR glare errors.
 * - Evaluates ONLY clinician/family-configured static thresholds.
 * - Produces non-diagnostic statistical trend summaries for doctor visits.
 * - Never performs clinical diagnosis or guarantees medical emergency detection.
 */

export interface SafetyThresholds {
  bpSysHigh: number;
  bpSysLow: number;
  bpDiaHigh: number;
  bpDiaLow: number;
  glucoseHigh: number; // mmol/L (Singapore standard)
  glucoseLow: number;  // mmol/L
  hrHigh: number;
  hrLow: number;
}

export interface VitalPayload {
  type: 'bp' | 'glucose' | 'hr' | 'wearable_fall';
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  glucoseMmol?: number | null;
  hrBpm?: number | null;
}

export interface SanityCheckResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validatePhysiologicalBounds(vital: VitalPayload): SanityCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (vital.type === 'bp') {
    const sys = vital.systolic;
    const dia = vital.diastolic;
    const pulse = vital.pulse;

    if (sys == null || dia == null || Number.isNaN(sys) || Number.isNaN(dia)) {
      errors.push('Both systolic and diastolic blood pressure readings are required.');
    } else {
      if (sys < 60 || sys > 260) {
        errors.push(`Systolic (${sys}) is outside plausible human bounds (60–260 mmHg). Check for LCD glare or missing digits.`);
      }
      if (dia < 30 || dia > 160) {
        errors.push(`Diastolic (${dia}) is outside plausible human bounds (30–160 mmHg). Check for LCD glare.`);
      }
      if (sys <= dia + 10) {
        errors.push(`Systolic (${sys}) must be higher than diastolic (${dia}) by at least 10 mmHg. Values may be swapped or misread.`);
      }
      if (sys >= 180 || dia >= 115) {
        warnings.push('Very high BP value detected — please visually verify the LCD screen carefully before confirming.');
      }
    }
    if (pulse != null && !Number.isNaN(pulse) && (pulse < 35 || pulse > 220)) {
      errors.push(`Pulse (${pulse} bpm) is outside plausible bounds (35–220 bpm).`);
    }
  } else if (vital.type === 'glucose') {
    const g = vital.glucoseMmol;
    if (g == null || Number.isNaN(g)) {
      errors.push('Blood glucose reading (mmol/L) is required.');
    } else if (g > 35) {
      errors.push(
        `Reading (${g}) looks like mg/dL or a missing decimal point! Singapore meters use mmol/L (typically 3.0–25.0). Re-check the decimal point.`,
      );
    } else if (g < 1.5 || g > 33.0) {
      errors.push(`Glucose (${g} mmol/L) is outside plausible meter bounds (1.5–33.0 mmol/L). Check for glare.`);
    } else if (g < 3.0) {
      warnings.push(
        `Very low glucose (${g} mmol/L) — verify whether the decimal point shifted (e.g. 18.0 misread as 1.8) before confirming.`,
      );
    }
  } else if (vital.type === 'hr') {
    const hr = vital.hrBpm;
    if (hr == null || Number.isNaN(hr)) {
      errors.push('Heart rate reading (bpm) is required.');
    } else if (hr < 35 || hr > 220) {
      errors.push(`Heart rate (${hr} bpm) is outside plausible bounds (35–220 bpm).`);
    }
  }

  return { valid: errors.length === 0, warnings, errors };
}

export interface ThresholdEvaluation {
  tier: 'green' | 'amber' | 'red';
  triggeredRule: string | null;
  familyMessage: string;
  helperGuidance: string;
}

export function evaluateThresholds(
  vital: VitalPayload,
  thresholds: SafetyThresholds,
): ThresholdEvaluation {
  if (vital.type === 'wearable_fall') {
    return {
      tier: 'red',
      triggeredRule: 'OS Wearable Fall Trigger',
      familyMessage:
        'Connected watch reported a possible fall alert. Check in immediately with caregiver or senior.',
      helperGuidance:
        'Check on Ah Ma immediately. If she fell or feels pain/dizziness, do not force her to stand — tap Emergency 995.',
    };
  }

  if (vital.type === 'bp' && vital.systolic != null && vital.diastolic != null) {
    const { systolic: s, diastolic: d } = vital;
    if (s >= thresholds.bpSysHigh || d >= thresholds.bpDiaHigh) {
      return {
        tier: 'red',
        triggeredRule: `BP above doctor-set limit (${thresholds.bpSysHigh}/${thresholds.bpDiaHigh})`,
        familyMessage: `Confirmed BP ${s}/${d} mmHg exceeded your configured target (${thresholds.bpSysHigh}/${thresholds.bpDiaHigh}). Non-diagnostic notice: let senior rest 10 mins and re-check; seek medical care if symptomatic.`,
        helperGuidance:
          'BP is above target. Let Ah Ma sit quietly for 10 minutes, check again, and watch for headache or dizziness.',
      };
    }
    if (s <= thresholds.bpSysLow || d <= thresholds.bpDiaLow) {
      return {
        tier: 'red',
        triggeredRule: `BP below doctor-set limit (${thresholds.bpSysLow}/${thresholds.bpDiaLow})`,
        familyMessage: `Confirmed BP ${s}/${d} mmHg is below your configured low threshold (${thresholds.bpSysLow}/${thresholds.bpDiaLow}). Watch for dizziness or lightheadedness.`,
        helperGuidance:
          'BP is low. Keep Ah Ma seated or lying down so she does not fall. Inform family.',
      };
    }
    if (s >= thresholds.bpSysHigh - 12 || d >= thresholds.bpDiaHigh - 8) {
      return {
        tier: 'amber',
        triggeredRule: 'BP approaching upper target',
        familyMessage: `BP ${s}/${d} mmHg is slightly elevated (approaching ${thresholds.bpSysHigh}/${thresholds.bpDiaHigh}). Logged for Calm Digest.`,
        helperGuidance: 'BP is slightly elevated. Encourage rest and water; log normally.',
      };
    }
    return {
      tier: 'green',
      triggeredRule: null,
      familyMessage: `BP ${s}/${d} mmHg is within configured target range.`,
      helperGuidance: 'BP reading is within normal target range. Good job!',
    };
  }

  if (vital.type === 'glucose' && vital.glucoseMmol != null) {
    const g = vital.glucoseMmol;
    if (g <= thresholds.glucoseLow) {
      return {
        tier: 'red',
        triggeredRule: `Glucose at/below doctor-set floor (${thresholds.glucoseLow} mmol/L)`,
        familyMessage: `Confirmed blood glucose ${g.toFixed(1)} mmol/L is below configured limit (${thresholds.glucoseLow} mmol/L). Check on senior promptly.`,
        helperGuidance:
          'Blood sugar is low! If Ah Ma is awake and able to swallow, follow her clinic hypo plan (sweet drink/glucose tablet) and inform family.',
      };
    }
    if (g >= thresholds.glucoseHigh) {
      return {
        tier: 'red',
        triggeredRule: `Glucose above doctor-set ceiling (${thresholds.glucoseHigh} mmol/L)`,
        familyMessage: `Confirmed blood glucose ${g.toFixed(1)} mmol/L exceeded configured limit (${thresholds.glucoseHigh} mmol/L). Review recent meals/meds and consult clinic if persistent.`,
        helperGuidance:
          'Blood sugar is above target. Ensure she drinks plain water, check if medication was taken, and monitor how she feels.',
      };
    }
    if (g >= thresholds.glucoseHigh - 2.5) {
      return {
        tier: 'amber',
        triggeredRule: 'Glucose approaching upper target',
        familyMessage: `Glucose ${g.toFixed(1)} mmol/L is slightly high. Included in Calm Digest.`,
        helperGuidance: 'Blood sugar is slightly high. Offer plain water and monitor.',
      };
    }
    return {
      tier: 'green',
      triggeredRule: null,
      familyMessage: `Glucose ${g.toFixed(1)} mmol/L is within configured target range.`,
      helperGuidance: 'Blood sugar reading is within target range.',
    };
  }

  if (vital.type === 'hr' && vital.hrBpm != null) {
    const hr = vital.hrBpm;
    if (hr >= thresholds.hrHigh || hr <= thresholds.hrLow) {
      return {
        tier: 'red',
        triggeredRule: `Heart rate outside configured bounds (${thresholds.hrLow}–${thresholds.hrHigh} bpm)`,
        familyMessage: `Heart rate ${hr} bpm fell outside configured bounds (${thresholds.hrLow}–${thresholds.hrHigh} bpm). Non-diagnostic alert — verify senior's comfort.`,
        helperGuidance: 'Heart rate is outside normal range. Ask Ah Ma to sit and rest; check if she feels breathless or dizzy.',
      };
    }
    return {
      tier: 'green',
      triggeredRule: null,
      familyMessage: `Heart rate ${hr} bpm is within configured target range.`,
      helperGuidance: 'Heart rate is within target range.',
    };
  }

  return {
    tier: 'green',
    triggeredRule: null,
    familyMessage: 'Vital logged.',
    helperGuidance: 'Reading saved.',
  };
}

export interface VitalRowForTrend {
  type: string;
  systolic: number | null;
  diastolic: number | null;
  glucose_mmol: number | null;
  hr_bpm: number | null;
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

export function compute14DayTrends(rows: VitalRowForTrend[]): TrendSummary {
  const now = Date.now();
  const msDay = 86_400_000;
  const recentCutoff = now - 7 * msDay;
  const priorCutoff = now - 14 * msDay;

  const avg = (nums: number[]) =>
    nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

  const recentSys: number[] = [];
  const recentDia: number[] = [];
  const priorSys: number[] = [];
  const priorDia: number[] = [];
  const recentGlu: number[] = [];
  const priorGlu: number[] = [];
  const recentHr: number[] = [];

  for (const r of rows) {
    const t = new Date(r.recorded_at).getTime();
    if (Number.isNaN(t) || t < priorCutoff) continue;
    const isRecent = t >= recentCutoff;

    if (r.type === 'bp' && r.systolic != null && r.diastolic != null) {
      if (isRecent) {
        recentSys.push(r.systolic);
        recentDia.push(r.diastolic);
      } else {
        priorSys.push(r.systolic);
        priorDia.push(r.diastolic);
      }
    }
    if (r.type === 'glucose' && r.glucose_mmol != null) {
      if (isRecent) recentGlu.push(r.glucose_mmol);
      else priorGlu.push(r.glucose_mmol);
    }
    if (r.type === 'hr' && r.hr_bpm != null && isRecent) {
      recentHr.push(r.hr_bpm);
    }
  }

  const rSys = avg(recentSys);
  const rDia = avg(recentDia);
  const pSys = avg(priorSys);
  const pDia = avg(priorDia);
  const rGlu = avg(recentGlu);
  const pGlu = avg(priorGlu);
  const rHr = avg(recentHr);

  const bpSysDelta = rSys != null && pSys != null ? Math.round((rSys - pSys) * 10) / 10 : null;
  const glucoseDelta = rGlu != null && pGlu != null ? Math.round((rGlu - pGlu) * 10) / 10 : null;

  const observations: string[] = [];
  if (rSys != null && rDia != null) {
    if (bpSysDelta != null && bpSysDelta >= 8) {
      observations.push(
        `7-day average BP is ${Math.round(rSys)}/${Math.round(rDia)} mmHg (+${Math.round(bpSysDelta)} mmHg systolic vs prior week). Consider sharing this trend at the next clinic review.`,
      );
    } else if (bpSysDelta != null && bpSysDelta <= -8) {
      observations.push(
        `7-day average BP eased to ${Math.round(rSys)}/${Math.round(rDia)} mmHg (${Math.round(bpSysDelta)} mmHg systolic vs prior week). Monitor for postural dizziness.`,
      );
    } else {
      observations.push(
        `7-day average BP is stable around ${Math.round(rSys)}/${Math.round(rDia)} mmHg.`,
      );
    }
  }

  if (rGlu != null) {
    if (glucoseDelta != null && glucoseDelta >= 1.2) {
      observations.push(
        `7-day average glucose is ${rGlu.toFixed(1)} mmol/L (+${glucoseDelta.toFixed(1)} mmol/L vs prior week). Worth reviewing meal timing or dosage with the doctor.`,
      );
    } else {
      observations.push(`7-day average glucose is ${rGlu.toFixed(1)} mmol/L.`);
    }
  }

  if (observations.length === 0) {
    observations.push('Not enough readings yet for a 14-day trend comparison.');
  }

  return {
    recentBpAvg: rSys != null && rDia != null ? { systolic: Math.round(rSys), diastolic: Math.round(rDia) } : null,
    priorBpAvg: pSys != null && pDia != null ? { systolic: Math.round(pSys), diastolic: Math.round(pDia) } : null,
    bpSysDelta,
    recentGlucoseAvg: rGlu,
    priorGlucoseAvg: pGlu,
    glucoseDelta,
    recentHrAvg: rHr != null ? Math.round(rHr) : null,
    nonDiagnosticObservations: observations,
  };
}
