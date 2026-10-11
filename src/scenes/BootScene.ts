import Phaser from 'phaser';
import { makeTextures } from '../art';

const ART = [
  'bg_sky', 'bg_mountains', 'bg_sea', 'bg_trees', 'tiles', 'crate', 'lever_off', 'lever_on', 'cp_off', 'cp_on', 'goal',
  'mplat', 'crab_a', 'crab_b', 'crusher', 'coin', 'coin_1', 'coin_2', 'coin_3', 'star', 'heart', 'heart_empty',
];

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    // Missing files are fine: makeTextures() draws a placeholder for any key not loaded.
    this.load.on('loaderror', () => {});
    for (const key of ART) this.load.image(key, `assets/${key}.png`);
  }

  create() {
    makeTextures(this);
    for (const id of ['dad', 'mom', 'girl']) {
      this.anims.create({ key: `${id}_idle`, frames: [{ key: `${id}_idle` }], frameRate: 1 });
      this.anims.create({
        key: `${id}_run`,
        frames: [{ key: `${id}_runA` }, { key: `${id}_idle` }, { key: `${id}_runB` }, { key: `${id}_idle` }],
        frameRate: 12, repeat: -1,
      });
      this.anims.create({ key: `${id}_jump`, frames: [{ key: `${id}_jump` }], frameRate: 1 });
    }
    this.anims.create({ key: 'axo_swim', frames: [{ key: 'axo_a' }, { key: 'axo_b' }], frameRate: 5, repeat: -1 });
    this.anims.create({ key: 'coin_spin', frames: ['coin', 'coin_1', 'coin_2', 'coin_3'].map((key) => ({ key })), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'crab_walk', frames: [{ key: 'crab_a' }, { key: 'crab_b' }], frameRate: 6, repeat: -1 });
    this.scene.start('game');
  }
}
