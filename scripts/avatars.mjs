// Lädt die gezeichneten Avatar-Bögen (4×4 Figuren) und schneidet jede Figur einzeln aus.
// Läuft beim Veröffentlichen auf GitHub. Scheitert der Download, wird ohne Figuren weitergebaut.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUT = 'public/avatars';
export const SHEETS = [
  {
    url: 'https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__6/-t-e-x-t_-t-o_-i-m-a-g-e-a7bbd92c-438c-4f6e-ba9f-2628de64a562.png?Expires=2107444852&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=INiL2lJHHy6GMkCYOfpoc-892Hp5mdn3ABrfy9l9I55og1AYuImO3Nai~VquUgqPANIeTyvSiV26MOIeM15bTjcosKauRIqf6~-qyp5NbfS-gW6eVnvwwvdA8x8GO15E-Lx-lTcf2ZpDCBpSUzUlHpBeGeCmcYPSOzEqHocG~ej1i3wr2bQYxtaBltUk18taXRKWm8f-hvCWvNmcu4I17Q57DcrIbCVCYak4QS7O-3DyLP5y5P9qRVRSZa~OvcrnQRMXyKNRYPs34MInedEtzyIjUSnMMEYkGjvaL77i7LJxrdWjIuqV7ydpZSjG0PgYFVEiBANu5u0EdHGLGv4q1A__',
    cols: 4, rows: 4,
    names: ['rapper', 'dj', 'skater', 'sneakerhead', 'hippie', 'influencer', 'raver', 'tattoo', 'scooter', 'mma', 'bodybuilder', 'fussballer', 'snowboarder', 'eisbader', 'jogger', 'zocker']
  },
  {
    url: 'https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__9/-t-e-x-t_-t-o_-i-m-a-g-e-f2f09faf-3258-4bdc-8d0f-a06b2fda411e.png?Expires=2107444852&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=wBBI1te~dubAWtk0NK1C~~EHF9res2tGfz~hHoXs4dk63tIbXPpz5xkAHV~hs3VTBmg8E~v0HuK93HfhCXB-pkk~4am8Y8AbL0A-oWShUrlACrRpb0pI8gcB4P-J9Kgep8-UHKDcSY6jnpTGUSnEAqsG-c2hfbQnIQU-TbrErH8Wr8qNUowYcE8~4Z7TBfsCm0vQAMPPcDXomIDbcoahCrYxHgk5i5aSa1vwVbM21mNlSEzcXsINJY6mGKiL1LTuD2PxpszjIr7tP9COxT-G2o2PYI4YmTgWH5Bn-VEuYLBPQkzItWP9Ykwjf1aJ7a7cZhRPbShgWdSqYd6dDDSEnw__',
    cols: 4, rows: 3,
    names: ['esportler', 'hacker', 'alien', 'zauberer', 'zombie', 'grillmeister', 'bierfan', 'schlafmuetze', 'gorilla', 'fee', 'gaertner', 'faultier']
  },
  {
    // eigene Emojis (transparenter Hintergrund)
    url: 'https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__6/-t-e-x-t_-t-o_-i-m-a-g-e-a07526f6-6718-4f3e-a535-cc5580578ab2.png?Expires=2107445427&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=osZPCSX~GMg0aP2pStFvUzs44zr3EWjbhzOvgL51UJMzsho~T7LPOwAIU270OmGgAG9R6IsaIkwq~Uj-7qh5lRZ4xitMudGOoHVPGAuJ4ccMfVUn~8~s8UrN0DLQxrLshgtZLQYsnhtOZxK8u~U44xOnLzh~idbXXlNJ0H03hYvpc0T7w-B2C0-IRuKcKkdSEP8JqI3M4Cl6F4mECKWPf3t5VIoHPciNbYX7125nmWtBwlpkP39gZFzaubgJfIFDnJmdHkbLNUHSTbi0Br9ATZaFIGAi6EWQxZjkhUQLDw4d3xhB61XeN2JipS130U9ahwVv0CFYlrveYaieFCK1SA__',
    cols: 2, rows: 1, dir: 'public/icons', size: 128,
    names: ['joint', 'karte']
  }
];

// Schneidet aus einem Bild-Buffer alle 16 Figuren aus (Inhalt pro Zelle automatisch gefunden)
export async function cutSheet(buf, names, outDir, cols = 4, rows = 4, size = 256) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const cw = W / cols, ch = H / rows;
  const written = [];
  for (let i = 0; i < cols * rows && i < names.length; i++) {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = Math.floor(cy); y < Math.floor(cy + ch); y += 2) {
      for (let x = Math.floor(cx); x < Math.floor(cx + cw); x += 2) {
        const o = (y * W + x) * C;
        if (data[o + 3] > 40 && data[o] + data[o + 1] + data[o + 2] > 90) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (x1 < 0) continue;
    const side = Math.min(Math.max(x1 - x0, y1 - y0) + 8, Math.floor(Math.min(cw, ch)));
    const mx = Math.round((x0 + x1) / 2), my = Math.round((y0 + y1) / 2);
    const left = Math.max(0, Math.min(W - side, mx - Math.round(side / 2)));
    const top = Math.max(0, Math.min(H - side, my - Math.round(side / 2)));
    const file = path.join(outDir, names[i] + '.webp');
    await sharp(buf).extract({ left, top, width: side, height: side }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 82 }).toFile(file);
    written.push(names[i]);
  }
  return written;
}

if (process.argv[1] && process.argv[1].endsWith('avatars.mjs')) {
  fs.mkdirSync(OUT, { recursive: true });
  const all = [];
  for (const sh of SHEETS) {
    try {
      const r = await fetch(sh.url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const dir = sh.dir || OUT;
      fs.mkdirSync(dir, { recursive: true });
      const done = await cutSheet(buf, sh.names, dir, sh.cols, sh.rows, sh.size || 256);
      if (!sh.dir) all.push(...done);
    } catch (e) {
      console.warn('Avatar-Bogen nicht geladen:', e.message);
    }
  }
  fs.writeFileSync(path.join(OUT, 'list.json'), JSON.stringify(all));
  console.log('Avatare:', all.length);
}
