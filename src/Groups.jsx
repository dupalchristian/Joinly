import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Avatar } from './common.jsx';
import { Back, Check, Close, Share } from './Icons.jsx';

export const inviteUrl = (code) => `${location.origin}${location.pathname}?invite=${code}`;

export default function Groups({ me, groups, groupId, setGroupId, onBack, reloadGroups, toast, tick }) {
  const group = groups.find(g => g.id === groupId && g.status === 'active');
  const [members, setMembers] = useState([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(groups.length === 0);

  const loadMembers = () => group && api.listMembers(group.id).then(setMembers).catch(() => {});
  useEffect(() => { loadMembers(); }, [group?.id, tick]);

  const isAdmin = group?.role === 'admin';
  const active = members.filter(m => m.status === 'active');
  const pending = members.filter(m => m.status === 'pending');

  const share = async () => {
    const url = inviteUrl(group.invite_code);
    const text = `Komm in unsere Gruppe „${group.name}“ bei Joinly: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Joinly', text, url }); return; } catch { /* abgebrochen */ }
    }
    try { await navigator.clipboard.writeText(url); toast('Einladungslink kopiert'); } catch { prompt('Einladungslink:', url); }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const id = await api.createGroup(newName.trim());
    setNewName(''); setCreating(false);
    await reloadGroups();
    setGroupId(id);
    toast('Gruppe erstellt – lade jetzt deine Freunde ein');
  };

  return (
    <div className="screen stack" style={{ gap: 26 }}>
      <div className="row" style={{ paddingTop: 6 }}>
        {groups.length > 0 && <button className="icon-btn" onClick={onBack} aria-label="Zurück"><Back /></button>}
        <h1 className="h2">Gruppen</h1>
      </div>

      {groups.length > 0 && (
        <div className="list">
          {groups.map(g => (
            <button key={g.id} className="list-btn" onClick={() => g.status === 'active' && setGroupId(g.id)}>
              <div className="grow col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700 }}>{g.name}</span>
                <span className="small muted">{g.status === 'pending' ? 'Wartet auf Freigabe' : g.role === 'admin' ? 'Du bist Admin' : 'Mitglied'}</span>
              </div>
              {g.id === groupId && g.status === 'active' && <span style={{ color: 'var(--accent)' }}><Check /></span>}
            </button>
          ))}
        </div>
      )}

      {group && (
        <>
          <button className="btn primary block" onClick={share}><Share /> Freunde zu „{group.name}“ einladen</button>
          <p className="small muted" style={{ margin: '-14px 0 0' }}>Schick den Link per WhatsApp oder E-Mail. {isAdmin ? 'Du gibst neue Leute danach frei.' : 'Der Admin gibt neue Leute danach frei.'}</p>

          {pending.length > 0 && (
            <section className="stack">
              <h2 className="label" style={{ margin: 0 }}>Möchten beitreten ({pending.length})</h2>
              <div className="list">
                {pending.map(m => (
                  <div key={m.profile.id} className="list-item">
                    <Avatar p={m.profile} me={me} lg />
                    <div className="grow col" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{m.profile.first_name}</span>
                      <span className="small muted">{m.profile.phone}</span>
                    </div>
                    {isAdmin ? (
                      <div className="row" style={{ gap: 8 }}>
                        <button className="icon-btn" aria-label={`${m.profile.first_name} ablehnen`} onClick={async () => { await api.removeMember(group.id, m.profile.id); loadMembers(); }}><Close size={18} /></button>
                        <button className="icon-btn" style={{ background: 'var(--accent)', color: '#000' }} aria-label={`${m.profile.first_name} freigeben`}
                          onClick={async () => { await api.approve(group.id, m.profile.id); loadMembers(); toast(`${m.profile.first_name} ist jetzt dabei`); }}><Check size={18} /></button>
                      </div>
                    ) : <span className="small muted">wartet</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="stack">
            <h2 className="label" style={{ margin: 0 }}>Mitglieder ({active.length})</h2>
            <div className="list">
              {active.map(m => (
                <div key={m.profile.id} className="list-item">
                  <Avatar p={m.profile} me={me} lg />
                  <div className="grow col" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>{m.profile.id === me.id ? `${m.profile.first_name} (du)` : m.profile.first_name}</span>
                    {m.role === 'admin' && <span className="small" style={{ color: 'var(--accent)' }}>Admin</span>}
                  </div>
                  {isAdmin && m.profile.id !== me.id && (
                    <button className="btn ghost" style={{ height: 36, fontSize: 13 }}
                      onClick={async () => { if (confirm(`${m.profile.first_name} aus der Gruppe entfernen?`)) { await api.removeMember(group.id, m.profile.id); loadMembers(); } }}>Entfernen</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {creating ? (
        <form className="stack" onSubmit={create}>
          <h2 className="label" style={{ margin: 0 }}>Neue Gruppe</h2>
          <label className="field">Name der Gruppe
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z. B. Freunde, Familie, Arbeit" maxLength={40} autoFocus />
          </label>
          <button className="btn white block" disabled={!newName.trim()}>Gruppe erstellen</button>
        </form>
      ) : (
        <button className="btn ghost block" onClick={() => setCreating(true)}>+ Neue Gruppe erstellen</button>
      )}
    </div>
  );
}
