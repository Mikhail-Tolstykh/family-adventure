// Placeholder pixel art generated in code. Any texture with the same key loaded
// from public/assets (art made in Gemini / ChatGPT) replaces it.
import Phaser from 'phaser';

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, unit: number, draw: (p: Px, ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return; // real art loaded from public/assets wins
  const t = scene.textures.createCanvas(key, w * unit, h * unit)!;
  const ctx = t.getContext();
  ctx.imageSmoothingEnabled = false;
  draw((x, y, ww, hh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x * unit, y * unit, ww * unit, hh * unit);
  }, ctx);
  t.refresh();
}

// Draws a picture from rows of characters; '.' is transparent.
function rows(p: Px, art: string[], pal: Record<string, string>, ox = 0, oy = 0) {
  art.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) p(ox + x, oy + y, 1, 1, pal[ch]); }));
}

const DARK = '#1d1d24';

interface Look {
  hair: string; skin: string; shirt: string; pants: string; shoes: string;
  shorts?: boolean; bob?: boolean; glasses?: boolean; backpack?: string; bag?: string; cap?: string;
}

const LOOKS: Record<'dad' | 'mom' | 'girl', Look> = {
  dad: { hair: '#3a2618', skin: '#f0c08a', shirt: '#1f1f26', pants: '#c9ab7c', shoes: '#151515', shorts: true, backpack: '#34343c' },
  mom: { hair: '#7a4a2a', skin: '#f3c79a', shirt: '#1f1f26', pants: '#7fa6cf', shoes: '#f2f2f2', bob: true, glasses: true, bag: '#111114' },
  girl: { hair: '#8a4b26', skin: '#f6cfa4', shirt: '#5a5a6e', pants: '#6b9bd1', shoes: '#ff7ab8', cap: '#ff8fc0', backpack: '#ff9fcf' },
};

type Pose = 'idle' | 'runA' | 'runB' | 'jump';
const POSES: Pose[] = ['idle', 'runA', 'runB', 'jump'];

// Adult: 14x24 units at 2px = 28x48, facing right.
function adult(p: Px, L: Look, f: Pose) {
  if (L.backpack) p(2, 7, 3, 6, L.backpack);
  p(5, 0, 5, 2, L.hair);
  p(4, 1, 2, L.bob ? 6 : 4, L.hair);
  if (L.bob) p(9, 1, 2, 2, L.hair);
  p(6, 2, 4, 4, L.skin);
  p(10, 3, 1, 2, L.skin);
  if (L.glasses) p(7, 3, 4, 1, '#0c0c0c');
  else p(9, 3, 1, 1, DARK);
  p(8, 5, 2, 1, '#c98a62');
  p(6, 6, 3, 1, L.skin);
  p(4, 7, 7, 7, L.shirt);
  if (f === 'jump') { p(10, 4, 2, 4, L.skin); p(10, 7, 2, 1, L.shirt); }
  else if (f === 'runA') { p(10, 7, 2, 2, L.shirt); p(11, 9, 2, 2, L.skin); }
  else if (f === 'runB') { p(3, 7, 2, 2, L.shirt); p(2, 9, 2, 3, L.skin); }
  else { p(10, 7, 2, 2, L.shirt); p(10, 9, 2, 3, L.skin); }
  if (L.bag) { p(3, 11, 3, 3, L.bag); p(5, 7, 1, 4, L.bag); }
  p(4, 14, 7, 2, L.pants);
  const leg = (x: number, y: number, h: number) => {
    for (let i = 0; i < h; i++) p(x, y + i, 2, 1, L.shorts && y + i >= 17 ? L.skin : L.pants);
  };
  const shoe = (x: number, y: number) => p(x, y, 3, 2, L.shoes);
  if (f === 'idle') { leg(5, 16, 6); leg(8, 16, 6); shoe(5, 22); shoe(8, 22); }
  if (f === 'runA') { leg(4, 16, 3); leg(3, 19, 3); shoe(2, 22); leg(8, 16, 3); leg(10, 19, 3); shoe(10, 22); }
  if (f === 'runB') { leg(5, 16, 6); shoe(5, 22); leg(8, 16, 3); leg(9, 19, 2); shoe(9, 21); }
  if (f === 'jump') { leg(5, 16, 4); shoe(5, 20); leg(8, 16, 3); leg(9, 18, 2); shoe(10, 19); }
}

// Kid: 12x17 units at 2px = 24x34.
function kid(p: Px, L: Look, f: Pose) {
  p(1, 6, 3, 4, L.backpack!);
  p(1, 2, 2, 4, L.hair);
  p(3, 1, 3, 5, L.hair);
  p(3, 0, 6, 2, L.cap!);
  p(9, 1, 3, 1, L.cap!);
  p(5, 2, 5, 4, L.skin);
  p(8, 3, 1, 1, DARK);
  p(9, 4, 1, 1, '#ff9db5');
  p(7, 5, 2, 1, '#c96a62');
  p(4, 6, 5, 5, L.shirt);
  if (f === 'jump') p(9, 3, 2, 4, L.skin);
  else if (f === 'runA') p(9, 7, 2, 2, L.skin);
  else if (f === 'runB') p(3, 7, 2, 3, L.skin);
  else p(8, 7, 2, 3, L.skin);
  p(4, 11, 5, 2, L.pants);
  const s = L.skin, sh = L.shoes;
  if (f === 'idle') { p(4, 13, 2, 2, s); p(7, 13, 2, 2, s); p(4, 15, 3, 2, sh); p(7, 15, 3, 2, sh); }
  if (f === 'runA') { p(3, 13, 2, 2, s); p(8, 13, 2, 2, s); p(2, 15, 3, 2, sh); p(9, 15, 3, 2, sh); }
  if (f === 'runB') { p(5, 13, 2, 2, s); p(7, 13, 2, 1, s); p(5, 15, 3, 2, sh); p(8, 14, 3, 2, sh); }
  if (f === 'jump') { p(4, 13, 2, 1, s); p(7, 13, 2, 1, s); p(4, 14, 3, 2, sh); p(8, 13, 3, 2, sh); }
}

function portrait(p: Px, id: 'dad' | 'mom' | 'girl') {
  const L = LOOKS[id];
  p(0, 0, 11, 11, id === 'dad' ? '#4a90d9' : id === 'mom' ? '#e39a5a' : '#b98be0');
  p(2, 9, 7, 2, L.shirt);
  if (id === 'mom') { p(1, 2, 2, 7, L.hair); p(8, 2, 2, 7, L.hair); }
  if (id === 'girl') p(1, 3, 2, 6, L.hair);
  p(3, 3, 5, 6, L.skin);
  if (id === 'dad') { p(2, 1, 7, 3, L.hair); p(2, 3, 1, 3, L.hair); }
  if (id === 'mom') p(2, 1, 7, 3, L.hair);
  if (id === 'girl') { p(2, 1, 7, 2, L.cap!); p(8, 3, 2, 1, L.cap!); }
  if (L.glasses) { p(3, 5, 2, 1, '#0c0c0c'); p(6, 5, 2, 1, '#0c0c0c'); p(5, 5, 1, 1, '#0c0c0c'); }
  else { p(4, 5, 1, 1, DARK); p(6, 5, 1, 1, DARK); }
  p(4, 7, 3, 1, '#c98a62');
}

export function makeTextures(scene: Phaser.Scene) {
  for (const id of ['dad', 'mom'] as const)
    for (const f of POSES) tex(scene, `${id}_${f}`, 14, 24, 2, (p) => adult(p, LOOKS[id], f));
  for (const f of POSES) tex(scene, `girl_${f}`, 12, 17, 2, (p) => kid(p, LOOKS.girl, f));
  for (const id of ['dad', 'mom', 'girl'] as const) tex(scene, `portrait_${id}`, 11, 11, 4, (p) => portrait(p, id));

  // Axolotl 16x8 units = 32x16, two tail frames.
  for (const [key, tailY] of [['axo_a', 3], ['axo_b', 5]] as const) {
    tex(scene, key, 16, 8, 2, (p) => {
      p(0, tailY, 4, 2, '#ff9ec7');
      p(3, 3, 9, 4, '#ff9ec7');
      p(10, 2, 5, 5, '#ffb3d4');
      p(9, 0, 1, 2, '#e0457b'); p(11, 0, 1, 2, '#e0457b'); p(13, 1, 1, 1, '#e0457b');
      p(13, 3, 1, 1, DARK);
      p(14, 5, 1, 1, '#c2306a');
      p(5, 7, 1, 1, '#ff7fb5'); p(10, 7, 1, 1, '#ff7fb5');
    });
  }

  // Tiles: 0 grass, 1 dirt, 2 plank, 3 water top, 4 water, 5 rock, 6/7 grass edges, 8 dirt.
  tex(scene, 'tiles', 16 * 9, 16, 2, (p) => {
    const dirt = (ox: number) => {
      p(ox, 0, 16, 16, '#7b4320');
      const stones = [[0, 0, 7, 5], [8, 0, 8, 6], [0, 6, 5, 6], [6, 7, 6, 5], [13, 7, 3, 5], [0, 13, 8, 3], [9, 13, 7, 3]];
      for (const [x, y, w, h] of stones) { p(ox + x, y, w - 1, h - 1, '#b8743b'); p(ox + x, y, w - 2, 1, '#cf8a4c'); }
    };
    dirt(0);
    p(0, 0, 16, 4, '#5cbf3a'); p(0, 0, 16, 1, '#8be04e');
    for (const x of [1, 4, 6, 9, 12, 14]) p(x, 4, 1, (x % 3) + 1, '#5cbf3a');
    dirt(16);
    p(32, 0, 16, 16, '#00000000');
    p(32, 3, 16, 8, '#b07a45'); p(32, 3, 16, 1, '#d39a5e'); p(32, 10, 16, 1, '#6e4524');
    for (const x of [35, 40, 45]) p(x, 3, 1, 8, '#6e4524');
    p(48, 0, 16, 16, 'rgba(79,182,255,0.75)');
    p(48, 0, 16, 2, 'rgba(210,240,255,0.95)');
    p(50, 2, 3, 1, 'rgba(210,240,255,0.8)'); p(58, 2, 4, 1, 'rgba(210,240,255,0.8)');
    p(64, 0, 16, 16, 'rgba(41,128,214,0.8)');
    p(67, 5, 2, 1, 'rgba(160,215,255,0.5)'); p(74, 11, 3, 1, 'rgba(160,215,255,0.5)');
    p(80, 0, 16, 16, '#5f616b');
    for (const [x, y, w] of [[0, 0, 7], [8, 0, 8], [0, 5, 4], [5, 5, 7], [13, 5, 3], [0, 10, 8], [9, 10, 7]] as const) {
      p(80 + x, y + 1, w - 1, 4, '#878a96'); p(80 + x, y + 1, w - 1, 1, '#a3a6b2');
    }
    for (const ox of [96, 112]) { dirt(ox); p(ox, 0, 16, 4, '#5cbf3a'); p(ox, 0, 16, 1, '#8be04e'); }
    dirt(128);
  });

  tex(scene, 'crate', 16, 16, 2, (p) => {
    p(0, 0, 16, 16, '#6e4524');
    p(1, 1, 14, 14, '#b9834c');
    p(1, 1, 14, 2, '#d39a5e');
    for (let i = 2; i < 14; i++) { p(i, i, 2, 1, '#6e4524'); p(15 - i, i, 1, 1, '#6e4524'); }
    p(0, 7, 16, 2, '#6e4524');
  });

  for (const [key, on] of [['lever_off', false], ['lever_on', true]] as const) {
    tex(scene, key, 16, 16, 2, (p) => {
      if (on) { p(10, 1, 2, 2, '#888'); p(9, 3, 2, 2, '#888'); p(8, 5, 2, 3, '#888'); p(10, 0, 3, 2, '#e53935'); }
      else { p(4, 1, 2, 2, '#888'); p(5, 3, 2, 2, '#888'); p(6, 5, 2, 3, '#888'); p(3, 0, 3, 2, '#e53935'); }
      p(2, 8, 12, 8, '#4d5560'); p(2, 8, 12, 1, '#7d8794');
      p(4, 11, 3, 2, on ? '#5cff6b' : '#7a2020'); p(9, 11, 3, 2, '#ffc94a');
    });
  }

  for (const [key, c] of [['cp_off', '#9aa1ad'], ['cp_on', '#4caf50']] as const) {
    tex(scene, key, 8, 16, 2, (p) => { p(1, 0, 1, 16, '#e8e8e8'); p(2, 1, 5, 4, c); p(0, 15, 4, 1, '#666'); });
  }

  tex(scene, 'goal', 16, 48, 2, (p) => {
    p(1, 0, 2, 48, '#f0f0f0'); p(0, 46, 5, 2, '#555');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) p(3 + x * 2, 2 + y * 2, 2, 2, (x + y) % 2 ? '#111' : '#fff');
  });

  for (const [key, legUp] of [['crab_a', 0], ['crab_b', 1]] as const) {
    tex(scene, key, 16, 10, 2, (p) => {
      p(1, 2 - legUp, 3, 2, '#e8463a'); p(12, 2 - legUp, 3, 2, '#e8463a');
      p(3, 4, 10, 4, '#e8463a'); p(4, 3, 8, 1, '#ff6b5c');
      p(5, 2, 1, 2, '#e8463a'); p(10, 2, 1, 2, '#e8463a'); p(5, 1, 1, 1, DARK); p(10, 1, 1, 1, DARK);
      p(2 + legUp, 8, 1, 2, '#b8302a'); p(5, 8, 1, 2, '#b8302a'); p(10, 8, 1, 2, '#b8302a'); p(13 - legUp, 8, 1, 2, '#b8302a');
    });
  }

  tex(scene, 'crusher', 32, 300, 2, (p) => {
    p(0, 0, 32, 292, '#4a4d57');
    for (let y = 0; y < 288; y += 8) {
      const o = (y / 8) % 2 ? 4 : 0;
      for (let x = -o; x < 32; x += 8) p(Math.max(0, x) + 1, y + 1, 6 - (x < 0 ? -x : 0), 6, '#6b6f7c');
    }
    p(0, 286, 32, 6, '#2e3038');
    for (let x = 0; x < 32; x += 4) { p(x, 292, 4, 2, '#c9ccd6'); p(x + 1, 294, 2, 2, '#c9ccd6'); p(x + 1, 296, 2, 2, '#9ea2ad'); }
  });

  tex(scene, 'mplat', 48, 8, 2, (p) => {
    p(0, 0, 48, 8, '#4d5560'); p(1, 1, 46, 6, '#8a95a5'); p(1, 1, 46, 1, '#c3cad6');
    for (let x = 4; x < 48; x += 8) p(x, 3, 2, 2, '#4d5560');
  });

  tex(scene, 'heart', 7, 6, 2, (p) => rows(p, ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: '#e8313f', w: '#ffb3b8' }));
  tex(scene, 'heart_empty', 7, 6, 2, (p) => rows(p, ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: '#3a3f55' }));
  for (const k of ['coin_1', 'coin_2', 'coin_3']) tex(scene, k, 8, 8, 2, (p) => rows(p, ['..oooo..', '.oyyyyo.', 'oyyyyyyo', 'oyyyyyyo', 'oyyyyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'], { o: '#b8740e', y: '#ffc928' }));
  tex(scene, 'coin', 8, 8, 2, (p) => rows(p, ['..oooo..', '.oyyyyo.', 'oyywyyyo', 'oyywyyyo', 'oyyyyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'], { o: '#b8740e', y: '#ffc928', w: '#fff3b0' }));
  tex(scene, 'star', 9, 9, 2, (p) => rows(p, ['....y....', '...yyy...', 'yyyyyyyyy', '.yyywyyy.', '..yyyyy..', '..yyyyy..', '.yyy.yyy.', '.yy...yy.', 'y.......y'], { y: '#ffd83a', w: '#fff6c2' }));

  makeBackgrounds(scene);
}

function makeBackgrounds(scene: Phaser.Scene) {
  tex(scene, 'bg_sky', 180, 320, 2, (p) => {
    const bands = ['#2a74dc', '#2f7fe0', '#3a8be6', '#4797ea', '#55a3ee', '#64aff2', '#73bbf5', '#84c6f7', '#95d0f9', '#a8dafb'];
    bands.forEach((c, i) => p(0, i * 32, 180, 32, c));
  });
  const rnd = new Phaser.Math.RandomDataGenerator(['family']);
  tex(scene, 'bg_clouds', 256, 60, 2, (p) => {
    for (const cx of [20, 110, 190]) {
      const cy = rnd.between(10, 40);
      const w = rnd.between(30, 50);
      p(cx, cy + 6, w, 6, '#dbe9f7');
      p(cx + 2, cy + 2, w - 4, 6, '#ffffff');
      p(cx + 8, cy - 3, 14, 6, '#ffffff');
      p(cx + 18, cy - 6, 12, 6, '#ffffff');
    }
  });
  tex(scene, 'bg_mountains', 256, 90, 2, (p) => {
    for (let x = 0; x < 256; x++) {
      const far = 40 + 30 * Math.max(0, Math.sin((x / 256) * Math.PI * 2 + 0.6)) + 8 * Math.sin(x / 9);
      p(x, 90 - far, 1, far, '#7b9fd6');
    }
    for (let x = 0; x < 256; x++) {
      const t = (x / 256) * Math.PI * 4;
      const near = 25 + 30 * Math.max(0, Math.sin(t + 2)) ** 1.5 + 4 * Math.sin(x / 5);
      p(x, 90 - near, 1, near, '#5a7fc0');
      p(x, 90 - near, 1, 1, '#8fb0e3');
    }
  });
  tex(scene, 'bg_sea', 256, 70, 2, (p) => {
    p(0, 18, 256, 52, '#2e8be6');
    for (let i = 0; i < 40; i++) p(rnd.between(0, 250), rnd.between(22, 68), rnd.between(3, 8), 1, '#7cc4ff');
    p(150, 8, 106, 14, '#4d8f3a');
    for (let i = 0; i < 9; i++) {
      const hx = 156 + i * 11, hy = rnd.between(0, 6);
      p(hx, hy + 4, 8, 6, '#f4efe2'); p(hx - 1, hy + 2, 10, 2, '#d9663f'); p(hx + 3, hy + 7, 2, 3, '#7a5a40');
    }
    p(232, -2, 4, 12, '#e8dcc0'); p(231, -4, 6, 2, '#b55a3a');
  });
}
