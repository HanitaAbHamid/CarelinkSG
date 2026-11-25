import type { DatabaseSync } from 'node:sqlite';

export type DomainEventType =
  | 'VitalConfirmed'
  | 'MedEventLogged'
  | 'PrescriptionDiffApproved'
  | 'CareTaskCompleted'
  | 'EscalationTriggered'
  | 'HandoffActivated'
  | 'CarePackToggled'
  | 'EmergencyTriggered'
  | 'ClinicUpdateCaptured';

export interface DomainEvent {
  id: string;
  type: DomainEventType;
  actor: string;
  actorRole: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

type EventListener = (event: DomainEvent) => void;

class CareEventBus {
  private listeners = new Map<DomainEventType | '*', EventListener[]>();
  private db: DatabaseSync | null = null;

  attachDb(db: DatabaseSync) {
    this.db = db;
  }

  on(type: DomainEventType | '*', listener: EventListener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  emit(
    type: DomainEventType,
    actor: string,
    actorRole: string,
    payload: Record<string, unknown>,
  ): DomainEvent {
    const event: DomainEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      actor,
      actorRole,
      payload,
      createdAt: new Date().toISOString(),
    };

    if (this.db) {
      this.db
        .prepare(
          `INSERT INTO domain_events (id, event_type, actor, actor_role, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.type,
          event.actor,
          event.actorRole,
          JSON.stringify(event.payload),
          event.createdAt,
        );
    }

    for (const listener of this.listeners.get(type) ?? []) {
      try {
        listener(event);
      } catch {
        // Isolate subscriber errors from core workflow
      }
    }
    for (const listener of this.listeners.get('*') ?? []) {
      try {
        listener(event);
      } catch {
        // Isolate wildcard subscriber errors
      }
    }

    return event;
  }
}

export const eventBus = new CareEventBus();
