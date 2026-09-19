import { useState } from 'react';
import LoginScreen from './LoginScreen.jsx';
import LiveEditor from './LiveEditor.jsx';
import { isAuthed, clearAuthed } from './auth.js';

export default function AdminApp() {
  const [authed, setAuthedState] = useState(isAuthed());

  function handleLogout() {
    clearAuthed();
    setAuthedState(false);
  }

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthedState(true)} />;
  }

  return <LiveEditor onLogout={handleLogout} />;
}
