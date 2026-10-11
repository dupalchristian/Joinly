// Standard-Aktivitäten: die ersten vier sind die Favoriten, danach die Vorauswahl.
export const DEFAULT_ACTIVITIES = [
  ['Spazieren', '🚶'], ['Joggen', '🏃'], ['Eisbaden', '🧊'], ['Abendessen', '🍝'],
  ['Frühstück', '🥐'], ['Brunch', '🍳'], ['Mittagessen', '🥗'], ['Kaffee', '☕'], ['Kaffee & Kuchen', '🍰'],
  ['Biergarten', '🍺'], ['Bar', '🍸'], ['Cocktails', '🍹'], ['Weinabend', '🍷'], ['Feiern gehen', '🪩'],
  ['Kochen', '👨‍🍳'], ['Grillen', '🔥'], ['Picknick', '🧺'], ['Pizza', '🍕'], ['Sushi', '🍣'], ['Burger', '🍔'],
  ['Wandern', '🥾'], ['Radfahren', '🚴'], ['Mountainbiken', '🚵'], ['Rennrad', '🚲'], ['Schwimmen', '🏊'],
  ['Baden am See', '🏖️'], ['Sauna', '🧖'], ['Yoga', '🧘'], ['Fitnessstudio', '🏋️'], ['Bouldern', '🧗'],
  ['Klettern', '🪢'], ['Tennis', '🎾'], ['Padel', '🏓'], ['Tischtennis', '🏓'], ['Badminton', '🏸'],
  ['Squash', '🟢'], ['Fußball', '⚽'], ['Fußball schauen', '📺'], ['Basketball', '🏀'], ['Volleyball', '🏐'],
  ['Beachvolleyball', '🏐'], ['Golf', '⛳'], ['Minigolf', '🏌️'], ['Bowling', '🎳'], ['Billard', '🎱'],
  ['Darts', '🎯'], ['Kicker', '⚽'], ['Skifahren', '⛷️'], ['Snowboarden', '🏂'], ['Langlaufen', '🎿'],
  ['Schlittschuh', '⛸️'], ['Rodeln', '🛷'], ['SUP', '🏄'], ['Kajak', '🛶'], ['Segeln', '⛵'],
  ['Surfen', '🌊'], ['Angeln', '🎣'], ['Reiten', '🐎'], ['Inlineskaten', '🛼'], ['Skaten', '🛹'],
  ['Gassi gehen', '🐕'], ['Kino', '🎬'], ['Serienabend', '🍿'], ['Theater', '🎭'], ['Konzert', '🎤'],
  ['Festival', '🎪'], ['Museum', '🖼️'], ['Ausstellung', '🏛️'], ['Lesung', '📚'], ['Comedy', '😂'],
  ['Spieleabend', '🎲'], ['Kartenspielen', '🃏'], ['Schafkopf', '🃏'], ['Pub-Quiz', '❓'], ['Escape Room', '🔐'],
  ['Karaoke', '🎙️'], ['Zocken', '🎮'], ['Lasertag', '🔫'], ['Kart fahren', '🏎️'], ['Shoppen', '🛍️'],
  ['Flohmarkt', '🧸'], ['Wochenmarkt', '🥕'], ['Stadtbummel', '🏙️'], ['Ausflug', '🗺️'], ['Roadtrip', '🚗'],
  ['Tagesausflug', '🚆'], ['Freizeitpark', '🎢'], ['Zoo', '🦒'], ['Therme', '♨️'], ['Wellness', '💆'],
  ['Fotografieren', '📷'], ['Musik machen', '🎸'], ['Tanzen', '💃'], ['Malen', '🎨'], ['Gärtnern', '🌱'],
  ['Umzugshilfe', '📦'], ['Heimwerken', '🔨'], ['Lernen', '📖'], ['Coworking', '💻'], ['Telefonieren', '📞'],
  ['Spontan treffen', '👋']
].map(([name, icon]) => ({ name, icon }));

export const ICON_CHOICES = ['✨', '🍹', '🍻', '🎉', '🏃', '🚶', '🧊', '🍝', '☕', '🎲', '🎬', '🎾', '⚽', '🚴', '🥾', '🏊', '🧘', '🎤', '🛍️', '🔥', '🌳', '🌙', '🐕', '👋'];
