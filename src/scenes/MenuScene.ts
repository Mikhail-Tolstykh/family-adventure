import Phaser from 'phaser';
import { GAME_W } from '../config';
import { buildLevel, LEVEL_COUNT } from '../level';
import { loadStars } from '../progress';

// Level select: all levels are open; finished ones show their best stars.
export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    this.add.image(0, 0, 'bg_sky').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, 640, 0x0b1530, 0.35).setOrigin(0);
    this.add.text(GAME_W / 2, 56, 'Семейное\nприключение', {
      fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: '#ffffff', align: 'center', stroke: '#0b1530', strokeThickness: 6,
    }).setOrigin(0.5);

    const best = loadStars();
    const next = Math.min(best.length, LEVEL_COUNT - 1);
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 20 + col * 166, y = 120 + row * 96, w = 154, h = 84;
      const g = this.add.graphics();
      const draw = (hover: boolean) => g.clear()
        .fillStyle(hover ? 0x22386e : 0x14234a, 0.92).fillRoundedRect(x, y, w, h, 10)
        .lineStyle(i === next ? 4 : 2, i === next ? 0xffd83a : 0xcfe3ff, 1).strokeRoundedRect(x, y, w, h, 10);
      draw(false);
      this.add.text(x + 12, y + 10, String(i + 1), { fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffd83a' });
      this.add.text(x + 42, y + 14, buildLevel(i).name, {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#ffffff', wordWrap: { width: w - 50 },
      });
      for (let s = 0; s < 3; s++) {
        const star = this.add.image(x + 30 + s * 26, y + h - 18, 'star').setScale(1.3);
        if (s >= (best[i] ?? 0)) star.setTint(0x555555).setAlpha(0.5);
      }
      const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerup', () => this.scene.start('game', { level: i }));
    }
    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('game', { level: next }));
    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('game', { level: next }));
  }
}
