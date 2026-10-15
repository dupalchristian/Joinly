// Lädt die gezeichneten Avatar-Bögen (4×4 Figuren) und schneidet jede Figur einzeln aus.
// Läuft beim Veröffentlichen auf GitHub. Scheitert der Download, wird ohne Figuren weitergebaut.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUT = 'public/avatars';
export const SHEETS = [
  {
    url: 'https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__8/-t-e-x-t_-t-o_-i-m-a-g-e-6424c924-b994-4618-98da-e46acf6338e1.png?Expires=2107443748&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=ZmNqntHOlxpICz9Cs7fgnZzij3Wzb2Bv6PoqgpK153XHlwhb5lPR44OhI5HcYPSCAGzuv3PLHe6zjS24BEY972uL1Hi2n4C~meFRSiHUhmMcHoFwLw9H03jQFLsSVsH69MGDzbkCvgMi~8lSagy8TLrzdr1xnZJgkxi0a9vsgOB5lciipeFh~owIxQkFk7bNtuChnvipxJzgIoITmik9UyZwmt-QUCg1szkh2E3kzT6Z3BFcMTqWY7WxB4GBdWeIbp2mp2g1avoCGDB3IqbLGbONAxp96yhXQ0y3fg9wlX5w2t0NRcWdgEec0hCEjyYp-D58mUk3l4d3WZYpXWi6HQ__',
    names: ['rapper', 'mma', 'fussballer', 'bodybuilder', 'hippie', 'zocker', 'dj', 'koch', 'biker', 'wikinger', 'ninja', 'cowboy', 'pirat', 'boxer', 'surfer', 'astronaut']
  },
  {
    url: 'https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__7/-t-e-x-t_-t-o_-i-m-a-g-e-6db7cc91-8631-4302-89f7-0b3d88cf7ede.png?Expires=2107443734&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=taWF5HcJKxw4VOp~AYoAZNS~s8mZvtSVm9mGdsEu6J9q53ND2xEBU~K1oQTC1Kgo40JhEK8r-ThivgfcPszd~M3-bDkouIxbhVeYXyCz15KGHhQHyJj~fGmyURHuGdocgvOtegXOlyv5OzKGeB4M0Ap6aAquULBdMPAvmSwjjm70hucR1GibYE6WGoid08kMBXSYIIpfEbbDwP2zCf~3za3DNYrXuIe8~ye~-31OxogmjdC0qPN5FCuTz7y6g2Dz2wVM26AcWzDb33rLiWMJ2fQYq~MiJrFnP59zj-NFEiR7nhQKg0w-usEUQDOitDxgLRiqpHLYI0~eypylGXAR3g__',
    names: ['chemiker', 'bauarbeiter', 'muskelprotz', 'hipster', 'yogi', 'taucher', 'eishockey', 'golfer', 'rockstar', 'zauberer', 'detektiv', 'pilot', 'fan', 'partygirl', 'angler', 'opa']
  }
];

// Schneidet aus einem Bild-Buffer alle 16 Figuren aus (Inhalt pro Zelle automatisch gefunden)
export async function cutSheet(buf, names, outDir) {
  const img = sharp(buf).removeAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const cw = W / 4, ch = H / 4;
  const written = [];
  for (let i = 0; i < 16; i++) {
    const cx = (i % 4) * cw, cy = Math.floor(i / 4) * ch;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = Math.floor(cy); y < Math.floor(cy + ch); y += 2) {
      for (let x = Math.floor(cx); x < Math.floor(cx + cw); x += 2) {
        const o = (y * W + x) * C;
        if (data[o] + data[o + 1] + data[o + 2] > 90) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (x1 < 0) continue;
    const side = Math.min(Math.max(x1 - x0, y1 - y0) + 8, Math.floor(Math.min(cw, ch)));
    const mx = Math.round((x0 + x1) / 2), my = Math.round((y0 + y1) / 2);
    const left = Math.max(0, Math.min(W - side, mx - Math.round(side / 2)));
    const top = Math.max(0, Math.min(H - side, my - Math.round(side / 2)));
    const file = path.join(outDir, names[i] + '.webp');
    await sharp(buf).extract({ left, top, width: side, height: side }).resize(256, 256).webp({ quality: 82 }).toFile(file);
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
      all.push(...await cutSheet(buf, sh.names, OUT));
    } catch (e) {
      console.warn('Avatar-Bogen nicht geladen:', e.message);
    }
  }
  fs.writeFileSync(path.join(OUT, 'list.json'), JSON.stringify(all));
  console.log('Avatare:', all.length);
}
