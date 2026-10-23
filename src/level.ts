// Ten levels built from chunks (flat ground, pits, pools, underwater caves).
// Coordinates are in tiles (32px); rows 0..19 top to bottom, plus EXTRA_ROWS of floor.
// Ground row h means the walkable surface is the top of row h; an entity standing there has y = h - 1.
// Reachability: a jump clears 2 tiles up and 3 tiles across; walls of 3 need dad's crate.

export const T = { GRASS: 0, DIRT: 1, PLANK: 2, WATER_TOP: 3, WATER: 4, ROCK: 5, GRASS_L: 6, GRASS_R: 7, DIRT_2: 8 } as const;
// The camera shows rows VIEW_TOP..VIEW_TOP+19; rows above it are hidden sky.
export const EXTRA_ROWS = 3;
export const VIEW_TOP = EXTRA_ROWS * 32;

export const SOLID_TILES = [T.GRASS, T.DIRT, T.PLANK, T.ROCK, T.GRASS_L, T.GRASS_R, T.DIRT_2];

export interface Pt { x: number; y: number }
export interface Lever { x: number; y: number; bridge: Pt[] }
export interface Rockfall { x: number; ground: number; phase: number }
export interface Gull { x: number; y: number; min: number; max: number }
export interface Barrels { x: number; y: number; min: number; period: number; speed: number }
export interface Shark { x: number; y: number; r: number; speed: number; phase: number }
export interface Jelly { x: number; y: number; range: number }
export interface Current { x0: number; x1: number; y0: number; y1: number; force: number }

export interface LevelData {
  name: string;
  tint: number;
  width: number;
  height: number;
  tiles: number[][];
  start: Pt;
  goal: Pt;
  coins: Pt[];
  stars: Pt[];
  checkpoints: Pt[];
  crates: Pt[];
  crabs: { x: number; y: number; min: number; max: number }[];
  levers: Lever[];
  movers: { x: number; y: number; min: number; max: number; speed: number }[];
  signs: { x: number; y: number; text: string }[];
  rockfalls: Rockfall[];
  gulls: Gull[];
  barrels: Barrels[];
  sharks: Shark[];
  octopuses: Pt[];
  jellies: Jelly[];
  urchins: Pt[];
  currents: Current[];
}

const H = 20;

class Builder {
  g: string[][] = Array.from({ length: H }, () => []);
  x = 0;
  h = 16;
  d: Omit<LevelData, 'width' | 'height' | 'tiles'> = {
    name: '', tint: 0xffffff, start: { x: 2, y: 15 }, goal: { x: 0, y: 0 },
    coins: [], stars: [], checkpoints: [], crates: [], crabs: [], levers: [], movers: [], signs: [],
    rockfalls: [], gulls: [], barrels: [], sharks: [], octopuses: [], jellies: [], urchins: [], currents: [],
  };

  private ensure(x: number) { while (this.g[0].length <= x) this.g.forEach((r) => r.push('.')); }
  private put(x: number, y: number, c: string) { this.ensure(x); this.g[y][x] = c; }
  private cols(n: number, f: (x: number) => void) {
    const x0 = this.x;
    this.ensure(x0 + n - 1);
    for (let x = x0; x < x0 + n; x++) f(x);
    this.x += n;
    return x0;
  }

  /** Ground whose surface is row h. */
  flat(n: number, h = this.h) { this.h = h; return this.cols(n, (x) => { for (let y = h; y < H; y++) this.put(x, y, 'S'); }); }
  /** Bottomless gap. */
  pit(n: number) { return this.cols(n, () => {}); }
  /** Open water one tile below the bank: everyone floats on top, only the axolotl dives. */
  pool(n: number) {
    const surf = this.h + 1;
    return this.cols(n, (x) => { for (let y = surf; y < H - 1; y++) this.put(x, y, 'W'); this.put(x, H - 1, 'R'); });
  }
  /** Underwater cave: rock down to row ceil (below the pool surface, so swimmers on top can't pass). */
  cave(n: number, ceil = this.h + 1) {
    return this.cols(n, (x) => {
      for (let y = 0; y <= ceil; y++) this.put(x, y, 'R');
      for (let y = ceil + 1; y < H - 1; y++) this.put(x, y, 'W');
      this.put(x, H - 1, 'R');
    });
  }
  rock(x: number, y0: number, y1: number, w = 2) { for (let i = 0; i < w; i++) for (let y = y0; y <= y1; y++) this.put(x + i, y, 'R'); }
  plat(x: number, y: number, n: number) { for (let i = 0; i < n; i++) this.put(x + i, y, 'S'); }

  start(x: number, y = this.h - 1) { this.d.start = { x, y }; }
  goal(x: number, y = this.h - 1) { this.d.goal = { x, y }; }
  sign(x: number, y: number, text: string) { this.d.signs.push({ x, y, text }); }
  coins(x: number, y: number, n = 1, step = 1) { for (let i = 0; i < n; i++) this.d.coins.push({ x: x + i * step, y }); }
  star(x: number, y: number) { this.d.stars.push({ x, y }); }
  cp(x: number, y = this.h - 1) { this.d.checkpoints.push({ x, y }); }
  crate(x: number, y = this.h - 1) { this.d.crates.push({ x, y }); }
  crab(x: number, min: number, max: number, y = this.h - 1) { this.d.crabs.push({ x, y, min, max }); }
  lever(x: number, y: number, bx0: number, bx1: number, by: number) {
    const bridge: Pt[] = [];
    for (let bx = bx0; bx <= bx1; bx++) bridge.push({ x: bx, y: by });
    this.d.levers.push({ x, y, bridge });
  }
  mover(x: number, y: number, min: number, max: number, speed: number) { this.d.movers.push({ x, y, min, max, speed }); }
  rocks(xs: number[], ground = this.h) { xs.forEach((x, i) => this.d.rockfalls.push({ x, ground, phase: (i * 0.37) % 1 })); }
  gull(x: number, y: number, min: number, max: number) { this.d.gulls.push({ x, y, min, max }); }
  barrels(x: number, min: number, period: number, speed: number, y = this.h - 1) { this.d.barrels.push({ x, y, min, period, speed }); }
  shark(x: number, y: number, r: number, speed: number, phase = 0) { this.d.sharks.push({ x, y, r, speed, phase }); }
  octo(x: number, y = 18) { this.d.octopuses.push({ x, y }); }
  jelly(x: number, y: number, range: number) { this.d.jellies.push({ x, y, range }); }
  urchin(...xs: number[]) { for (const x of xs) this.d.urchins.push({ x, y: 18 }); }
  current(x0: number, x1: number, y0: number, y1: number, force = -190) { this.d.currents.push({ x0, x1, y0, y1, force }); }

  build(): LevelData {
    // Extra rows under the floor sit behind the touch buttons.
    for (let i = 0; i < EXTRA_ROWS; i++) this.g.push([...this.g[H - 1]]);
    const g = this.g, W = g[0].length;
    const solidAt = (x: number, y: number) => y >= 0 && g[y][x] === 'S';
    const tiles = g.map((r, y) => r.map((c, x) => {
      if (c === 'S') {
        if (solidAt(x, y - 1)) return (x * 7 + y * 3) % 5 === 0 ? T.DIRT_2 : T.DIRT;
        const l = x > 0 && g[y][x - 1] === 'S', rr = x < W - 1 && g[y][x + 1] === 'S';
        return !l && rr ? T.GRASS_L : l && !rr ? T.GRASS_R : T.GRASS;
      }
      if (c === 'W') return y > 0 && g[y - 1][x] === '.' ? T.WATER_TOP : T.WATER;
      if (c === 'R') return T.ROCK;
      return -1;
    }));
    return { ...this.d, width: W, height: g.length, tiles };
  }
}

const LEVELS: ((b: Builder) => void)[] = [
  // 1. Warm-up: running, jumping, crabs, first swim.
  (b) => {
    b.d.name = 'Побережье';
    b.flat(16, 16); b.start(2);
    b.sign(5, 12, 'Добро пожаловать\nна побережье!');
    b.coins(6, 15, 4); b.plat(12, 14, 3); b.coins(12, 13, 3);
    b.flat(10); b.crab(21, 17, 25);
    b.pit(3); b.coins(27, 14);
    b.flat(8); b.cp(30); b.sign(33, 12, 'В воде плавают все.\nНырять умеет\nтолько дочка');
    b.pool(12); b.star(43, 18); b.coins(40, 15, 3, 3);
    b.flat(10); b.crab(54, 50, 58);
    b.flat(8, 14); b.plat(61, 12, 3); b.star(62, 11);
    b.pit(3);
    b.flat(14, 14); b.cp(71); b.plat(75, 12, 3); b.coins(75, 11, 3); b.crab(80, 76, 83);
    b.flat(4, 16);
    b.pool(8); b.coins(90, 15, 3, 2);
    b.flat(26, 16); b.plat(99, 14, 2); b.plat(102, 12, 2); b.plat(105, 10, 2); b.star(106, 9);
    b.goal(118);
  },

  // 2. Dad: crates against walls, levers lower bridges.
  (b) => {
    b.d.name = 'Пристань';
    b.flat(12, 16); b.start(2); b.sign(6, 12, 'Ящики двигает\nтолько папа');
    b.flat(12); b.crate(17);
    b.flat(14, 13); b.cp(26); b.sign(30, 9, 'Рычаг тугой.\nНужен папа'); b.lever(34, 12, 38, 46, 13);
    b.pit(9); b.star(42, 11); b.coins(39, 12, 3, 3);
    b.flat(10, 13); b.crab(52, 48, 56);
    b.flat(6, 16);
    b.flat(10); b.crate(66);
    b.flat(8, 13); b.cp(74);
    b.pit(10); b.mover(81, 13, 81, 90, 80); b.coins(83, 11, 3, 3);
    b.flat(8, 13);
    b.flat(4, 16);
    b.pool(8); b.star(107, 18);
    b.flat(12, 16); b.crate(114); b.cp(112);
    b.flat(10, 13); b.lever(130, 12, 133, 140, 13);
    b.pit(8); b.star(137, 11);
    b.flat(14, 13); b.goal(151);
  },

  // 3. Daughter: first underwater caves, a current to dash through, jellyfish.
  (b) => {
    b.d.name = 'Тихая бухта';
    b.flat(14, 11); b.start(2); b.sign(6, 7, 'Под камнями\nпроплывёт\nтолько дочка');
    b.pool(5);
    b.cave(18, 13); b.coins(22, 16, 4, 4); b.urchin(25, 31); b.rock(28, 17, 18); b.star(33, 17);
    b.pool(5);
    b.flat(10, 11); b.cp(43); b.sign(46, 7, 'Течение сносит.\nВ воде жми\nкнопку РЫВОК');
    b.pool(4);
    b.cave(14, 13); b.current(60, 65, 14, 18); b.coins(61, 16, 4, 1); b.star(67, 16);
    b.pool(4);
    b.flat(8, 11); b.cp(76);
    b.pool(16); b.jelly(86, 14, 3); b.jelly(91, 13, 4); b.jelly(95, 14, 3); b.star(90, 18); b.coins(84, 17, 6, 2);
    b.flat(16, 11); b.crab(104, 99, 108); b.goal(110);
  },

  // 4. Mom: rockfalls and seagulls; slowing time makes them easy.
  (b) => {
    b.d.name = 'Скалы';
    b.d.tint = 0xffe2c4;
    b.flat(14, 16); b.start(2); b.sign(7, 12, 'Камнепад!\nМама замедлит\nвремя');
    b.flat(14); b.rocks([17, 20, 23, 26]);
    b.flat(10); b.cp(29); b.gull(33, 10, 28, 37);
    b.flat(8, 14);
    b.pit(3);
    b.flat(8, 14); b.gull(52, 9, 46, 58); b.star(53, 12);
    b.flat(4, 16); b.cp(58);
    b.flat(18); b.rocks([63, 66, 69, 72, 75]); b.star(70, 15);
    b.flat(10); b.cp(80); b.crab(85, 81, 88);
    b.flat(8, 14);
    b.pit(2);
    b.flat(8, 14); b.gull(97, 10, 90, 106); b.gull(102, 8, 95, 106);
    b.flat(14, 16); b.rocks([109, 112, 115, 118]);
    b.flat(12); b.plat(123, 14, 2); b.plat(126, 12, 2); b.star(127, 11); b.goal(130);
  },

  // 5. Long underwater reef with circling sharks.
  (b) => {
    b.d.name = 'Акулий риф';
    b.d.tint = 0xc8dcff;
    b.flat(12, 10); b.start(2); b.sign(6, 6, 'Акулы кружат.\nПроскочи\nрывком!');
    b.pool(4);
    b.cave(50, 11);
    b.shark(22, 15, 2.5, 1.6); b.shark(32, 15, 2.5, -1.8, 1.5); b.shark(44, 15, 2.8, 2); b.shark(55, 15, 2.5, -2, 3);
    b.rock(27, 12, 14); b.rock(38, 16, 18); b.rock(50, 12, 14);
    b.star(38, 15); b.cp(40, 18); b.coins(19, 13, 3, 2); b.coins(46, 17, 3, 2);
    b.current(58, 62, 12, 18); b.star(63, 13);
    b.pool(4);
    b.flat(8, 10); b.cp(71);
    b.pool(20); b.shark(88, 16, 2, 1.7); b.star(88, 16); b.coins(80, 14, 8, 2);
    b.flat(12, 10); b.goal(106);
  },

  // 6. Boats over the gaps, seagulls overhead, jellyfish in the sea.
  (b) => {
    b.d.name = 'Лодки и чайки';
    b.flat(10, 14); b.start(2); b.sign(5, 10, 'Прыгай по лодкам,\nберегись чаек');
    b.pit(10); b.mover(10, 14, 10, 19, 70); b.gull(15, 9, 10, 20);
    b.flat(6, 14); b.cp(21);
    b.pool(14); b.jelly(30, 16, 2); b.jelly(35, 16, 2); b.star(33, 18); b.coins(28, 13, 5, 2);
    b.flat(6, 14);
    b.pit(12); b.mover(46, 13, 46, 57, 90); b.gull(51, 8, 44, 60); b.star(51, 11);
    b.flat(8, 14); b.cp(59); b.crab(63, 60, 65);
    b.pit(2);
    b.flat(4, 12);
    b.pit(2);
    b.flat(4, 10); b.star(76, 8);
    b.flat(6, 14);
    b.pit(12); b.mover(84, 14, 84, 89, 60); b.mover(90, 12, 90, 95, 80); b.gull(90, 8, 82, 98);
    b.flat(14, 14); b.goal(106);
  },

  // 7. Octopus cave: ink shots, sea urchins, strong current.
  (b) => {
    b.d.name = 'Пещера осьминога';
    b.d.tint = 0xb8c8f0;
    b.flat(10, 9); b.start(2); b.sign(5, 5, 'Осьминоги\nстреляют\nчернилами');
    b.pool(4);
    b.cave(60, 10);
    b.octo(22); b.octo(36); b.octo(50); b.octo(64);
    b.urchin(28, 29, 43, 57, 58);
    b.rock(32, 11, 14); b.rock(40, 15, 18); b.rock(46, 11, 13); b.rock(54, 16, 18);
    b.star(40, 14); b.cp(47, 18); b.coins(17, 13, 4, 1); b.coins(48, 15, 3, 1);
    b.current(60, 66, 11, 18); b.star(70, 12);
    b.pool(4);
    b.flat(10, 9); b.cp(80);
    b.pool(16); b.octo(95); b.star(98, 18); b.coins(90, 15, 5, 2);
    b.flat(10, 9); b.goal(110);
  },

  // 8. Port: dad's crates and levers, rolling barrels (mom slows the fast ones).
  (b) => {
    b.d.name = 'Порт';
    b.flat(12, 16); b.start(2); b.sign(6, 12, 'Бочки катятся!\nПерепрыгивай');
    b.flat(16); b.barrels(27, 12, 2.4, 150);
    b.flat(12); b.cp(29); b.crate(32);
    b.flat(12, 13); b.lever(49, 12, 52, 59, 13);
    b.pit(8);
    b.flat(16, 13); b.cp(61); b.sign(63, 9, 'Слишком быстро?\nМама поможет'); b.barrels(75, 60, 1.0, 220); b.star(68, 12);
    b.flat(4, 16);
    b.flat(12, 16); b.crate(83);
    b.flat(10, 13); b.lever(99, 12, 102, 110, 13);
    b.pit(9); b.gull(106, 9, 100, 112); b.star(106, 11);
    b.flat(10, 13); b.cp(112);
    b.flat(14, 16); b.rocks([124, 127, 130]); b.star(127, 15);
    b.flat(10, 16); b.goal(141);
  },

  // 9. The deep: a long underwater maze with everything in it.
  (b) => {
    b.d.name = 'Глубина';
    b.d.tint = 0x9fb4e8;
    b.flat(10, 9); b.start(2); b.sign(7, 6, 'Глубина. Только\nдля аксолотля');
    b.pool(4);
    b.cave(80, 10);
    // Zigzag: pillars alternate between hanging from the ceiling and standing on the floor.
    for (const [x, top] of [[20, true], [28, false], [36, true], [44, false], [52, true], [60, false], [68, true], [76, false], [84, true]] as const) {
      if (top) b.rock(x, 11, 14); else b.rock(x, 15, 18);
    }
    b.shark(24, 14.5, 1.8, 1.8); b.jelly(32, 11, 4); b.octo(40); b.shark(48, 14.5, 1.8, -2); b.cp(48, 18);
    b.current(54, 58, 11, 18); b.jelly(64, 11, 4); b.octo(72); b.shark(80, 14.5, 1.8, 2.2, 2);
    b.urchin(30, 31, 56, 88);
    b.star(44, 12); b.star(62, 16); b.star(90, 12);
    b.coins(16, 16, 3, 1); b.coins(33, 16, 2, 1); b.coins(65, 16, 3, 1); b.coins(86, 16, 3, 1);
    b.pool(4);
    b.flat(10, 9); b.goal(104);
  },

  // 10. Lighthouse: a bit of everything.
  (b) => {
    b.d.name = 'Маяк';
    b.d.tint = 0xffc9a8;
    b.flat(12, 16); b.start(2); b.sign(6, 12, 'Последний рывок\nк маяку!');
    b.flat(12); b.crate(15);
    b.flat(10, 13); b.lever(31, 12, 34, 41, 13);
    b.pit(8); b.gull(38, 9, 32, 44);
    b.flat(14, 13); b.cp(43); b.rocks([45, 48, 51, 54]); b.star(49, 12);
    b.flat(6, 11); b.cp(57);
    b.pool(4);
    b.cave(30, 12);
    b.shark(72, 15.5, 2, 1.8); b.octo(80); b.urchin(76, 77); b.current(84, 88, 13, 18); b.star(86, 14); b.shark(91, 15.5, 2, -2);
    b.coins(68, 14, 3, 1);
    b.pool(4);
    b.flat(8, 11); b.cp(101);
    b.flat(14, 11); b.barrels(121, 108, 1.4, 190); b.star(115, 9);
    b.flat(6, 14);
    b.pit(10); b.mover(128, 14, 128, 137, 90); b.gull(133, 9, 126, 140);
    b.flat(16, 14); b.goal(150);
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function buildLevel(i: number): LevelData {
  const b = new Builder();
  LEVELS[i](b);
  return b.build();
}
