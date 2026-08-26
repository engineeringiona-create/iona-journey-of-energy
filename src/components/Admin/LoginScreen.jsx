import { useState } from 'react';
import { checkCredentials, setAuthed } from './auth.js';

export default function LoginScreen({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (checkCredentials(username, password)) {
      setAuthed();
      setError('');
      onSuccess();
    } else {
      setError('Kullanıcı adı veya şifre hatalı.');
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg)] px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/images/iona-wordmark.svg" alt="iona" width="140" height="45" className="h-10 w-auto mb-3" />
          <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--text)]">
            <span className="text-[var(--brand)]">Admin</span>
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">Site içeriğini yönetmek için giriş yapın</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 shadow-[0_25px_60px_-25px_rgba(20,24,20,0.35)] flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="admin-username" className="text-[12px] font-bold tracking-[0.06em] text-[var(--text-muted)] uppercase">
              Kullanıcı adı
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] transition-colors duration-300"
              placeholder="kullanici.adi"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="admin-password" className="text-[12px] font-bold tracking-[0.06em] text-[var(--text-muted)] uppercase">
              Şifre
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] transition-colors duration-300"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <button
            type="submit"
            className="w-full font-label-caps text-[13px] font-bold tracking-[0.08em] bg-[var(--brand-orange)] text-white py-3 rounded-full hover:brightness-110 transition-all duration-300"
          >
            Giriş Yap
          </button>
        </form>

        <p className="text-center text-[12px] text-[var(--text-muted)] mt-6">
          Geçici giriş — veritabanı bağlanınca değişecek.
        </p>
      </div>
    </div>
  );
}
