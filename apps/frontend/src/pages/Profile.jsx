import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';

function ProfileBox({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

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
        <p className="text-red-600">{loadError}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg animate-fade-in">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-in pb-12 pt-2">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Profile</h1>
      <div className="space-y-6">
        <ProfileBox title="Account">
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                readOnly
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-400">Email cannot be changed.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingName}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 disabled:opacity-60"
              >
                {savingName ? 'Saving…' : 'Save name'}
              </button>
              {nameMsg ? <p className="text-sm text-slate-600">{nameMsg}</p> : null}
            </div>
          </form>
        </ProfileBox>

        <ProfileBox title="Change password">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="new-pwd" className="mb-1 block text-sm font-medium text-slate-700">
                New password
              </label>
              <input
                id="new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div>
              <label htmlFor="conf-pwd" className="mb-1 block text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <input
                id="conf-pwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={pwdSaving}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-900 disabled:opacity-60"
            >
              {pwdSaving ? 'Updating…' : 'Change password'}
            </button>
            {pwdMsg ? <p className="text-sm text-slate-600">{pwdMsg}</p> : null}
          </form>
        </ProfileBox>

        <ProfileBox title="Session and account">
          <p className="mb-4 text-sm text-slate-600">
            Log out on this device, or permanently close your account. Closing your account removes your media and files from storage, then marks your account as deleted while keeping a minimal record for our logs.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/', { replace: true });
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
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
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Delete account
            </button>
          </div>
        </ProfileBox>
      </div>

      {showDeleteModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-modal-title" className="text-lg font-bold text-slate-800">
              Delete your account?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This cannot be undone. Your files will be removed from storage and you will not be able to sign in again. Your profile row is kept internally for audit purposes.
            </p>
            <label htmlFor="delete-pwd" className="mt-4 mb-1 block text-sm font-medium text-slate-700">
              Confirm with your password
            </label>
            <input
              id="delete-pwd"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="mb-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800"
              autoComplete="current-password"
            />
            {deleteError ? <p className="mb-2 text-sm text-red-600">{deleteError}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
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
