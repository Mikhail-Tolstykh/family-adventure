import Phaser from 'phaser';
import { makeTextures } from '../art';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

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
    this.anims.create({ key: 'crab_walk', frames: [{ key: 'crab_a' }, { key: 'crab_b' }], frameRate: 6, repeat: -1 });
    this.scene.start('game');
  }
}
