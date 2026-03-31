import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';

function ProfileBox({ title, children }) {
  return (
    <section className="rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-content-subtle">{title}</h2>
      {children}
    </section>
  );
}

const inputClass =
  'w-full rounded-xl border border-surface-border bg-surface-muted/50 px-4 py-3 text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 sm:py-4';

export default function Profile() {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/auth/me')
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data);
          setName(data.name || '');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load profile.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveName(e) {
    e.preventDefault();
    setNameMsg('');
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMsg('Name cannot be empty.');
      return;
    }
    setSavingName(true);
    try {
      const { data } = await apiClient.patch('/auth/me', { name: trimmed });
      setProfile((p) => (p ? { ...p, name: data.name } : p));
      window.dispatchEvent(new Event('scriptify:profile-updated'));
      setNameMsg('Saved.');
    } catch (err) {
      setNameMsg(err.response?.data?.errors?.[0]?.msg || err.response?.data?.msg || 'Could not save name.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdMsg('');
    if (newPassword.length < 8) {
      setPwdMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg('New password and confirmation do not match.');
      return;
    }
    setPwdSaving(true);
    try {
      await apiClient.post('/auth/change-password', { newPassword });
      setPwdMsg('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdMsg(err.response?.data?.msg || err.response?.data?.errors?.[0]?.msg || 'Could not change password.');
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm.');
      return;
    }
    setDeleteLoading(true);
    try {
      await apiClient.post('/auth/delete-account', { password: deletePassword });
      setShowDeleteModal(false);
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.msg || err.response?.data?.errors?.[0]?.msg || 'Could not delete account.');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg animate-fade-in">
        <p className="text-red-300">{loadError}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg animate-fade-in">
        <div className="h-40 animate-pulse rounded-2xl bg-surface-muted/60" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-in pb-12 pt-2">
      <h1 className="mb-6 text-h2 font-bold text-content">Profile</h1>
      <div className="space-y-6">
        <ProfileBox title="Account">
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="mb-2 block text-small font-medium text-content-muted">
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="mb-2 block text-small font-medium text-content-muted">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                readOnly
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-surface-border bg-surface-muted/30 px-4 py-3 text-content-subtle sm:py-4"
              />
              <p className="mt-2 text-xs text-content-subtle">Email cannot be changed.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={savingName}
                className="rounded-xl bg-accent px-6 py-3 text-small font-semibold text-accent-foreground shadow-glow-sm hover:brightness-110 disabled:opacity-60"
              >
                {savingName ? 'Saving…' : 'Save name'}
              </button>
              {nameMsg ? <p className="text-small text-content-muted">{nameMsg}</p> : null}
            </div>
          </form>
        </ProfileBox>

        <ProfileBox title="Change password">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="new-pwd" className="mb-2 block text-small font-medium text-content-muted">
                New password
              </label>
              <input
                id="new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div>
              <label htmlFor="conf-pwd" className="mb-2 block text-small font-medium text-content-muted">
                Confirm new password
              </label>
              <input
                id="conf-pwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={pwdSaving}
              className="rounded-xl border border-surface-border bg-surface-muted/80 px-6 py-3 text-small font-semibold text-content transition hover:border-accent/40 disabled:opacity-60"
            >
              {pwdSaving ? 'Updating…' : 'Change password'}
            </button>
            {pwdMsg ? <p className="text-small text-content-muted">{pwdMsg}</p> : null}
          </form>
        </ProfileBox>

        <ProfileBox title="Session and account">
          <p className="mb-4 text-small text-content-muted">
            Log out on this device, or permanently close your account. Closing your account removes your media and files from storage, then marks your account as deleted while keeping a minimal record for our logs.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/', { replace: true });
              }}
              className="rounded-xl border border-surface-border bg-surface-muted/80 px-6 py-4 text-small font-semibold text-content transition hover:border-accent/30"
            >
              Log out
            </button>
            <button
              type="button"
              onClick={() => {
                setDeletePassword('');
                setDeleteError('');
                setShowDeleteModal(true);
              }}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-4 text-small font-semibold text-red-200 transition hover:bg-red-500/15"
            >
              Delete account
            </button>
          </div>
        </ProfileBox>
      </div>

      {showDeleteModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface/95 p-6 shadow-glass backdrop-blur-xl">
            <h3 id="delete-modal-title" className="text-lg font-bold text-content">
              Delete your account?
            </h3>
            <p className="mt-2 text-small text-content-muted">
              This cannot be undone. Your files will be removed from storage and you will not be able to sign in again. Your profile row is kept internally for audit purposes.
            </p>
            <label htmlFor="delete-pwd" className="mt-4 mb-2 block text-small font-medium text-content-muted">
              Confirm with your password
            </label>
            <input
              id="delete-pwd"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="mb-2 w-full rounded-xl border border-surface-border bg-surface-muted/50 px-4 py-3 text-content"
              autoComplete="current-password"
            />
            {deleteError ? <p className="mb-2 text-small text-red-300">{deleteError}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl px-6 py-3 text-small font-medium text-content-muted transition hover:bg-surface-muted/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="rounded-xl bg-red-600 px-6 py-3 text-small font-semibold text-white hover:bg-red-500 disabled:opacity-60"
              >
                {deleteLoading ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
