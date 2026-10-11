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
  body: [w: number, h: number, ox: number, oy: number];
}

export const CHARS: Record<CharId, { name: string; ability: string; form: Form }> = {
  dad: { name: 'Папа', ability: 'СИЛА', form: { tex: 'dad_idle', body: [16, 44, 6, 4] } },
  mom: { name: 'Мама', ability: 'ВРЕМЯ', form: { tex: 'mom_idle', body: [16, 42, 6, 6] } },
  girl: { name: 'Дочка', ability: 'ВОДА', form: { tex: 'girl_idle', body: [14, 30, 5, 4] } },
};

export const AXOLOTL: Form = { tex: 'axo_a', body: [26, 12, 3, 4] };

export const SLOW = { factor: 0.3, duration: 5, cooldown: 4 };
