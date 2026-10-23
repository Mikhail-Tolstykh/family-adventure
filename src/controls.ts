import Phaser from 'phaser';
import { GAME_W, GAME_H } from './config';

export type Button = 'left' | 'right' | 'jump' | 'ability' | 'down';

interface Btn { name: Button; x: number; y: number; r: number; g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }

// On-screen buttons for phones. Polls every active pointer, so several
// fingers (run + jump) work at once and a finger can slide between buttons.
export class TouchControls {
  private buttons: Btn[] = [];
  private held = new Set<Button>();
  readonly visible: boolean;

  constructor(private scene: Phaser.Scene, visible: boolean) {
    this.visible = visible;
    const y = GAME_H - 62;
    const defs: [Button, number, number, number, string][] = [
      ['left', 50, y, 32, '◀'],
      ['right', 124, y, 32, '▶'],
      ['ability', GAME_W - 128, y + 14, 28, ''],
      ['jump', GAME_W - 52, y - 10, 36, 'ПРЫЖОК'],
      ['down', 87, y - 66, 26, '▼'],
    ];
    for (const [name, x, by, r, text] of defs) {
      const g = scene.add.graphics().setScrollFactor(0).setDepth(1000);
      const label = scene.add.text(x, by, text, { fontFamily: 'monospace', fontSize: name === 'left' || name === 'right' || name === 'down' ? '26px' : '12px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
      g.setVisible(visible); label.setVisible(visible);
      this.buttons.push({ name, x, y: by, r, g, label });
    }
    this.redraw();
  }

  /** The dive button only shows while the axolotl swims. */
  setDownVisible(on: boolean) {
    this.downShown = on;
    const b = this.buttons.find((b) => b.name === 'down')!;
    b.g.setVisible(this.visible && on); b.label.setVisible(this.visible && on);
  }

  private downShown = false;

  setAbilityLabel(text: string, cooldown01 = 0) {
    const b = this.buttons.find((b) => b.name === 'ability')!;
    b.label.setText(text);
    this.cooldown = cooldown01;
    this.redraw();
  }

  private cooldown = 0;

  poll(): Set<Button> {
    const next = new Set<Button>();
    if (this.visible) {
      for (const p of this.scene.input.manager.pointers) {
        if (!p.isDown) continue;
        for (const b of this.buttons) if ((b.name !== 'down' || this.downShown) && Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) < b.r * 1.35) next.add(b.name);
      }
    }
    const changed = next.size !== this.held.size || [...next].some((n) => !this.held.has(n));
    this.held = next;
    if (changed) this.redraw();
    return next;
  }

  private redraw() {
    for (const b of this.buttons) {
      const down = this.held.has(b.name);
      b.g.clear();
      b.g.fillStyle(0x0b1530, down ? 0.7 : 0.4).fillCircle(b.x, b.y, b.r);
      b.g.lineStyle(3, 0xffffff, down ? 0.95 : 0.6).strokeCircle(b.x, b.y, b.r);
      if (b.name === 'ability' && this.cooldown > 0) {
        b.g.lineStyle(4, 0xffc94a, 0.9).beginPath()
          .arc(b.x, b.y, b.r - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.cooldown)).strokePath();
      }
    }
  }
}
