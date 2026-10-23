export const GAME_W = 360;
export const GAME_H = 640;
export const TILE = 32;

export const PHYS = {
  gravity: 1400,
  run: 170,
  jump: 490,
  coyote: 0.1,
  jumpBuffer: 0.12,
};

export type CharId = 'dad' | 'mom' | 'girl';
export const ORDER: CharId[] = ['dad', 'mom', 'girl'];

export interface Form {
  tex: string;
  body: [w: number, h: number]; // hitbox, centered on the frame's bottom edge
}

export const CHARS: Record<CharId, { name: string; ability: string; form: Form }> = {
  dad: { name: 'Папа', ability: 'СИЛА', form: { tex: 'dad_idle', body: [16, 44] } },
  mom: { name: 'Мама', ability: 'ВРЕМЯ', form: { tex: 'mom_idle', body: [16, 42] } },
  girl: { name: 'Дочка', ability: 'ВОДА', form: { tex: 'girl_idle', body: [14, 30] } },
};

export const AXOLOTL: Form = { tex: 'axo_a', body: [26, 12] };

export const SLOW = { factor: 0.3, duration: 5, cooldown: 4 };

// Dad and mom float on the surface; only the axolotl dives.
export const SWIM = { speed: 110, axoSpeed: 140 };
export const DASH = { speed: 380, time: 0.28, cooldown: 0.8 };
