// Abzeichen: ab 5 bzw. 10 abgeschlossenen Teilnahmen pro Aktivität
const BADGE_ICON = {
  'Wandern': '🥾', 'Joggen': '👟', 'Laufen': '👟', 'Eisbaden': '🧊', 'Spazieren': '🌳', 'Abendessen': '🍽️',
  'Mittagessen': '🍽️', 'Frühstück': '🥐', 'Brunch': '🥞', 'Radfahren': '🚲', 'Mountainbiken': '🚵', 'Rennrad': '🚴',
  'Schwimmen': '🩱', 'Baden am See': '🏖️', 'Sauna': '🔥', 'Yoga': '🧘', 'Fitnessstudio': '💪', 'Bouldern': '🧗',
  'Klettern': '🧗', 'Tennis': '🎾', 'Padel': '🏓', 'Fußball': '⚽', 'Fußball schauen': '📺', 'Basketball': '🏀',
  'Golf': '⛳', 'Skifahren': '⛷️', 'Snowboarden': '🏂', 'Kaffee': '☕', 'Kaffee & Kuchen': '🍰', 'Biergarten': '🍺',
  'Bar': '🍸', 'Cocktails': '🍹', 'Daydrinking': '🍹', 'Grillen': '🍖', 'Kino': '🍿', 'Spieleabend': '🎲',
  'Zocken': '🎮', 'Kochen': '👨‍🍳', 'Feiern gehen': '🪩', 'Konzert': '🎤', 'Angeln': '🎣', 'Gassi gehen': '🐕'
};
export const badgeIcon = (activity, fallback) => BADGE_ICON[activity] || fallback || '🏅';
export const LEVELS = [{ n: 5, name: 'Stammgast' }, { n: 10, name: 'Legende' }];

// counts: [{ profile_id, activity, n }], icons: Aktivität → Symbol aus den Status
export function buildBadges(counts, icons = {}) {
  const byPerson = {};
  for (const c of counts || []) {
    const n = Number(c.n);
    if (n < 5) continue;
    const b = { activity: c.activity, n, level: n >= 10 ? 2 : 1, icon: badgeIcon(c.activity, icons[c.activity]) };
    const cur = byPerson[c.profile_id];
    if (!cur || b.n > cur.n) byPerson[c.profile_id] = b;
  }
  return byPerson;
}
