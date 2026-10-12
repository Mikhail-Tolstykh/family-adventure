import Phaser from 'phaser';
import { makeTextures } from '../art';



export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    // assets/manifest.json lists every image made by tools/process_art.py.
    // Any texture not listed gets a placeholder from makeTextures().
    this.load.json('manifest', 'assets/manifest.json');
    this.load.on('filecomplete-json-manifest', (_k: string, _t: string, keys: string[]) => {
      for (const key of keys) this.load.image(key, `assets/${key}.png`);
    });
  }

  create() {
    makeTextures(this);
    // Numbered frames from real art (dad_run_0, dad_run_1, ...) win over placeholder poses.
    const numbered = (base: string) => {
      const keys: string[] = [];
      while (this.textures.exists(`${base}_${keys.length}`)) keys.push(`${base}_${keys.length}`);
      return keys;
    };
    const anim = (key: string, keys: string[], frameRate: number, repeat = -1) =>
      this.anims.create({ key, frames: keys.map((k) => ({ key: k })), frameRate, repeat });
    for (const id of ['dad', 'mom', 'girl']) {
      const idle = numbered(`${id}_idle`), run = numbered(`${id}_run`), jump = numbered(`${id}_jump`);
      anim(`${id}_idle`, idle.length ? [...idle, ...idle.slice(1, -1).reverse()] : [`${id}_idle`], 3);
      anim(`${id}_run`, run.length ? run : [`${id}_runA`, `${id}_idle`, `${id}_runB`, `${id}_idle`], run.length > 12 ? 30 : 12); // long sheets are smooth in-betweens
      anim(`${id}_jump`, [jump.length > 1 ? jump[1] : `${id}_jump`], 1, 0);
      anim(`${id}_fall`, [jump.length > 2 ? jump[2] : `${id}_jump`], 1, 0);
      const push = numbered(`${id}_push`);
      anim(`${id}_push`, push.length ? push : [`${id}_runA`, `${id}_idle`], 6);
    }
    this.anims.create({ key: 'axo_swim', frames: [{ key: 'axo_a' }, { key: 'axo_b' }], frameRate: 5, repeat: -1 });
    this.anims.create({ key: 'coin_spin', frames: ['coin', 'coin_1', 'coin_2', 'coin_3'].map((key) => ({ key })), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'crab_walk', frames: [{ key: 'crab_a' }, { key: 'crab_b' }], frameRate: 6, repeat: -1 });
    this.scene.start('game');
  }
}
