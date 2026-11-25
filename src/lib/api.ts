import type { AppStateResponse, UserRole } from '../types';

const OFFLINE_QUEUE_KEY = 'carelinksg_offline_queue_v1';
const CACHED_STATE_KEY = 'carelinksg_cached_state_v1';

export interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  body: Record<string, unknown>;
  role: UserRole;
  actor: string;
  queuedAt: string;
}

export function getOfflineQueue(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: QueuedMutation[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedState(): AppStateResponse | null {
  try {
    const raw = localStorage.getItem(CACHED_STATE_KEY);
    return raw ? (JSON.parse(raw) as AppStateResponse) : null;
  } catch {
    return null;
  }
}

function setCachedState(state: AppStateResponse) {
  try {
    localStorage.setItem(CACHED_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    role: UserRole;
    actor?: string;
    queueIfOffline?: boolean;
  },
): Promise<{ data?: T; queuedOffline?: boolean; error?: string; details?: string[] }> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-carelink-role': options.role,
  };
  if (options.actor) headers['x-carelink-actor'] = options.actor;

  const clientEventId =
    options.queueIfOffline && options.body && !options.body.clientEventId
      ? `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      : undefined;

  const payload = clientEventId ? { ...options.body, clientEventId } : options.body;

  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        error: json.error || `Request failed (${res.status})`,
        details: Array.isArray(json.errors) ? json.errors : undefined,
      };
    }
    if (path === '/state' && method === 'GET') {
      setCachedState(json as AppStateResponse);
    }
    return { data: json as T };
  } catch {
    if (options.queueIfOffline && method !== 'GET' && payload) {
      const queue = getOfflineQueue();
      queue.push({
        id: clientEventId || `q_${Date.now()}`,
        url: path,
        method,
        body: payload,
        role: options.role,
        actor: options.actor || 'Siti Rahayu',
        queuedAt: new Date().toISOString(),
      });
      saveOfflineQueue(queue);
      return { queuedOffline: true };
    }
    return { error: 'Network unavailable. Working from local cache.' };
  }
}

export async function flushOfflineQueue(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedMutation[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(`/api${item.url}`, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          'x-carelink-role': item.role,
          'x-carelink-actor': item.actor,
        },
        body: JSON.stringify(item.body),
      });
      if (res.ok) {
        flushed += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  return flushed;
}
