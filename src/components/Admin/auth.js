/* Placeholder credential gate — local-only, no backend yet.
   Replace with Supabase auth once the DB is wired in (Phase 26). */
const ADMIN_USERNAME = 'iona';
const ADMIN_PASSWORD = 'iona-admin-2026';
const SESSION_KEY = 'iona-admin-authed';

export function checkCredentials(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function isAuthed() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function setAuthed() {
  sessionStorage.setItem(SESSION_KEY, 'true');
}

export function clearAuthed() {
  sessionStorage.removeItem(SESSION_KEY);
}
