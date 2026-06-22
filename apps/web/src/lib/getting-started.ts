const CHECKLIST_KEY = 'beacon.gettingStarted';
const PROJECT_VIEWED_KEY = 'beacon.gettingStarted.projectViewed';

type ChecklistState = {
  dismissed: boolean;
};

function readChecklistState(): ChecklistState {
  if (typeof window === 'undefined') return { dismissed: false };
  try {
    const raw = window.localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return { dismissed: false };
    return JSON.parse(raw) as ChecklistState;
  } catch {
    return { dismissed: false };
  }
}

function writeChecklistState(state: ChecklistState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
}

export function isGettingStartedDismissed(): boolean {
  return readChecklistState().dismissed;
}

export function dismissGettingStarted() {
  writeChecklistState({ dismissed: true });
}

export function resetGettingStarted() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CHECKLIST_KEY);
  window.localStorage.removeItem(PROJECT_VIEWED_KEY);
}

export function markProjectViewedForChecklist() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROJECT_VIEWED_KEY, '1');
}

export function hasViewedProjectForChecklist(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PROJECT_VIEWED_KEY) === '1';
}
