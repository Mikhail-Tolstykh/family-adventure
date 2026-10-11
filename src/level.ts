// Level 1 "Побережье". Coordinates are in tiles (32px); rows 0..19 top to bottom, plus EXTRA_ROWS of floor.
// Built in code for now; later levels can come from the Tiled editor.

export const T = { GRASS: 0, DIRT: 1, PLANK: 2, WATER_TOP: 3, WATER: 4, ROCK: 5 } as const;
// The camera shows rows VIEW_TOP..VIEW_TOP+19; rows above it are hidden sky.
export const EXTRA_ROWS = 3;
export const VIEW_TOP = EXTRA_ROWS * 32;

export const SOLID_TILES = [T.GRASS, T.DIRT, T.PLANK, T.ROCK];

export interface Pt { x: number; y: number }
export interface LevelData {
  width: number;
  height: number;
  tiles: number[][];
  start: Pt;
  coins: Pt[];
  stars: Pt[];
  checkpoints: Pt[];
  crates: Pt[];
  crabs: { x: number; y: number; min: number; max: number }[];
  lever: Pt;
  bridge: Pt[];
  crushers: { x: number; phase: number }[];
  movers: { x: number; y: number; min: number; max: number; speed: number }[];
  signs: { x: number; y: number; text: string }[];
  goal: Pt;
}

export function buildLevel(): LevelData {
  const W = 172, H = 20;
  const g: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0: number, x1: number, y0: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c;
  };
  const solid = (x0: number, x1: number, y0: number, y1: number) => fill(x0, x1, y0, y1, 'S');
  const row = (y: number, ...xs: number[]) => xs.map((x) => ({ x, y }));

  const L: Omit<LevelData, 'width' | 'height' | 'tiles'> = {
    start: { x: 2, y: 15 },
    coins: [], stars: [], checkpoints: [], crates: [], crabs: [], bridge: [], crushers: [], movers: [], signs: [],
    lever: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
  };

  // A. Warm-up: running, jumping, a crab.
  solid(0, 30, 16, 19);
  solid(11, 13, 12, 13);
  solid(16, 18, 9, 10);
  L.coins.push(...row(15, 5, 6, 7, 8), ...row(11, 11, 12, 13), ...row(8, 16, 17, 18));
  L.crabs.push({ x: 25, y: 15, min: 21, max: 29 });
  L.signs.push({ x: 4, y: 12, text: 'Добро пожаловать\nна побережье!' });

  // B. Dad: push the crate to the wall, then pull the lever to lower the bridge.
  solid(33, 43, 16, 19);
  solid(44, 56, 13, 19);
  L.checkpoints.push({ x: 34, y: 15 });
  L.crates.push({ x: 38, y: 15 });
  L.signs.push({ x: 38, y: 12, text: 'Ящик сдвинет\nтолько папа' });
  L.checkpoints.push({ x: 46, y: 12 });
  L.lever = { x: 54, y: 12 };
  L.signs.push({ x: 51, y: 10, text: 'Рычаг тугой.\nНужен папа' });
  for (let x = 57; x <= 66; x++) L.bridge.push({ x, y: 13 });
  L.stars.push({ x: 62, y: 10 });
  L.coins.push(...row(11, 58, 60, 64, 66));

  // C. Ledge with a crab.
  solid(67, 84, 13, 19);
  L.crabs.push({ x: 74, y: 12, min: 69, max: 79 });
  L.coins.push(...row(11, 71, 72, 73));

  // D. Daughter: only the axolotl swims under the rock.
  L.checkpoints.push({ x: 82, y: 12 });
  L.signs.push({ x: 81, y: 10, text: 'Под водой проплывёт\nтолько дочка' });
  fill(85, 108, 14, 18, 'W');
  solid(85, 108, 19, 19);
  fill(95, 97, 0, 16, 'R');
  L.stars.push({ x: 96, y: 18 });
  L.coins.push(...row(17, 88, 91, 100, 104));
  solid(109, 122, 13, 19);
  L.crabs.push({ x: 116, y: 12, min: 111, max: 121 });

  // E. Mom: crushers are too fast unless time is slowed.
  solid(123, 145, 16, 19);
  L.checkpoints.push({ x: 124, y: 15 });
  L.signs.push({ x: 118, y: 10, text: 'Мама умеет\nзамедлять время' });
  L.crushers.push({ x: 130, phase: 0 }, { x: 135, phase: 0.33 }, { x: 140, phase: 0.66 });
  L.stars.push({ x: 143, y: 14 });
  L.coins.push(...row(14, 132, 137));

  // F. Moving platform over a pit, then the finish.
  L.movers.push({ x: 147, y: 16, min: 146, max: 155, speed: 110 });
  solid(158, 171, 16, 19);
  L.coins.push(...row(13, 149, 151, 153));
  L.goal = { x: 166, y: 15 };

  // Extra rows under the floor sit behind the touch buttons.
  for (let i = 0; i < EXTRA_ROWS; i++) g.push([...g[H - 1]]);

  const solidAt = (x: number, y: number) => y >= 0 && g[y][x] === 'S';
  const tiles = g.map((r, y) => r.map((c, x) => {
    if (c === 'S') return solidAt(x, y - 1) ? T.DIRT : T.GRASS;
    if (c === 'W') return y > 0 && g[y - 1][x] === '.' ? T.WATER_TOP : T.WATER;
    if (c === 'R') return T.ROCK;
    return -1;
  }));

  return { width: W, height: H + EXTRA_ROWS, tiles, ...L };
}
