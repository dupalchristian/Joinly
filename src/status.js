import { hhmm } from './time.js';

export const kindOf = (s) => s.kind || 'plan';
export const respOf = (p) => p.response || 'yes';
export const myAnswer = (s, me) => s.participants?.find(p => p.profile_id === me?.id) || null;
export const yesList = (s) => (s.participants || []).filter(p => respOf(p) === 'yes');
export const maybeList = (s) => (s.participants || []).filter(p => respOf(p) === 'maybe');
export const noList = (s) => (s.participants || []).filter(p => respOf(p) === 'no');
// Wer kommt: Gastgeber + alle Zusagen
export const goingPeople = (s) => [s.author, ...yesList(s).map(p => p.profiles)].filter(Boolean);
export const isLive = (s, now = new Date()) => new Date(s.starts_at) <= now && new Date(s.ends_at) > now;

export function statusTexts(s, me, now = new Date()) {
  const k = kindOf(s);
  const isHost = s.profile_id === me?.id;
  const who = isHost ? 'Du' : s.author?.first_name;
  const live = isLive(s, now);
  const time = live && k !== 'plan' ? `Jetzt bis ${hhmm(s.ends_at)} Uhr` : `${hhmm(s.starts_at)} – ${hhmm(s.ends_at)} Uhr`;
  if (k === 'free') return { title: 'Gerade frei', sub: isHost ? 'Du hast Zeit' : `${who} hat Zeit`, time, joinLabel: 'Bin dabei', joinedLabel: 'Dabei ✓', live };
  if (k === 'open') return { title: `Kommt vorbei${s.place_name ? ': ' + s.place_name : ''}`, sub: isHost ? 'Deine Tür ist offen' : `${who} ist da, komm einfach vorbei`, time, joinLabel: 'Komme vorbei', joinedLabel: 'Komme ✓', live };
  return { title: s.activity, sub: `${isHost ? 'Du bist' : who} offen dafür`, time, joinLabel: 'Bin dabei', joinedLabel: 'Dabei ✓', live };
}
