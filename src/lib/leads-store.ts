// Browser-only store for quote requests made in this demo. It stands in for the
// leads table a real backend (e.g. Supabase) would hold.
import type { Lead } from "./sample-data";

const KEY = "rtc-demo-leads";

export function loadLocalLeads(): Lead[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Lead[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalLead(lead: Lead): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([lead, ...loadLocalLeads()]));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalLeads() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable; nothing to clear
  }
}
