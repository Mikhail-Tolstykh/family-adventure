import Phaser from 'phaser';
import { GAME_W, GAME_H, PHYS } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#5fb7ff',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: PHYS.gravity }, debug: false } },
  input: { activePointers: 4 },
  scene: [BootScene, MenuScene, GameScene],
});

// Handy for debugging from the browser console.
(window as unknown as { game: Phaser.Game }).game = game;
