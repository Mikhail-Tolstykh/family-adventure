import Phaser from 'phaser';
import { AXOLOTL, CHARS, CharId, Form, GAME_H, GAME_W, ORDER, PHYS, SLOW, TILE } from '../config';
import { buildLevel, LevelData, Pt, SOLID_TILES, T, VIEW_TOP } from '../level';
import { TouchControls } from '../controls';

type Body = Phaser.Physics.Arcade.Body;
type Sprite = Phaser.Physics.Arcade.Sprite;

interface Input { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; jumpPressed: boolean; abilityPressed: boolean }
interface Crab { s: Sprite; min: number; max: number; dir: number }
interface Crusher { img: Phaser.GameObjects.Image; phase: number }
interface Mover { s: Sprite; min: number; max: number; speed: number; dir: number }

const wx = (p: Pt) => p.x * TILE + TILE / 2;
const groundY = (p: Pt) => (p.y + 1) * TILE;
const toward = (v: number, target: number, step: number) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

const CRUSHER_UP = 300;
const CRUSHER_DOWN = 16 * TILE;
const CRUSHER_PERIOD = 1.1;

export class GameScene extends Phaser.Scene {
  private level!: LevelData;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Sprite;
  private touch!: TouchControls;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private active: CharId = 'dad';
  private axo = false;
  private hearts: Record<CharId, number> = { dad: 3, mom: 3, girl: 3 };
  private coins = 0;
  private stars = 0;
  private respawn = { x: 0, y: 0 };
  private coyote = 0;
  private jumpBuffer = 0;
  private jumpHeld = false;
  private knockT = 0;
  private invuln = 0;
  private exitWaterT = 0;
  private slowT = 0;
  private slowCd = 0;
  private time01 = 0;
  private leverOn = false;
  private ended = false;
  private prev = { jump: false, ability: false };

  private crates!: Phaser.Physics.Arcade.Group;
  private crabs: Crab[] = [];
  private crushers: Crusher[] = [];
  private movers: Mover[] = [];
  private lever!: Phaser.GameObjects.Image;
  private bg: { s: Phaser.GameObjects.TileSprite; f: number }[] = [];

  private hud!: {
    frames: Phaser.GameObjects.Graphics;
    hearts: Record<CharId, Phaser.GameObjects.Image[]>;
    coins: Phaser.GameObjects.Text;
    stars: Phaser.GameObjects.Text;
    slowTint: Phaser.GameObjects.Rectangle;
  };
  private toastText!: Phaser.GameObjects.Text;

  constructor() { super('game'); }

  init() {
    Object.assign(this, {
      active: 'dad', axo: false, hearts: { dad: 3, mom: 3, girl: 3 }, coins: 0, stars: 0,
      coyote: 0, jumpBuffer: 0, jumpHeld: false, knockT: 0, invuln: 0, exitWaterT: 0,
      slowT: 0, slowCd: 0, time01: 0, leverOn: false, ended: false, prev: { jump: false, ability: false },
      crabs: [], crushers: [], movers: [], bg: [],
    });
  }

  create() {
    this.level = buildLevel();
    const L = this.level;
    const worldW = L.width * TILE;

    this.createBackground();

    const map = this.make.tilemap({ data: L.tiles, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.layer = map.createLayer(0, tileset, 0, 0)!;
    this.layer.setCollision(SOLID_TILES);

    this.physics.world.setBounds(0, -400, worldW, L.height * TILE + 800);

    for (const s of L.signs) {
      this.add.text(wx(s), s.y * TILE, s.text, {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#ffffff', align: 'center',
        backgroundColor: '#0b1530aa', padding: { x: 6, y: 4 },
      }).setOrigin(0.5);
    }

    // Checkpoints
    const cps = this.physics.add.staticGroup();
    for (const c of L.checkpoints) {
      const s = cps.create(wx(c), groundY(c), 'cp_off') as Phaser.Physics.Arcade.Sprite;
      s.setOrigin(0.5, 1).refreshBody();
    }
    this.respawn = { x: wx(L.start), y: groundY(L.start) };

    // Lever + hidden bridge
    this.lever = this.add.image(wx(L.lever), groundY(L.lever), 'lever_off').setOrigin(0.5, 1);

    // Collectibles
    const coins = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const c of L.coins) {
      const s = coins.create(wx(c), c.y * TILE + TILE / 2, 'coin') as Sprite;
      s.play({ key: 'coin_spin', startFrame: c.x % 4 });
    }
    const stars = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const c of L.stars) {
      const s = stars.create(wx(c), c.y * TILE + TILE / 2, 'star') as Sprite;
      this.tweens.add({ targets: s, y: s.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const goal = this.physics.add.staticImage(wx(L.goal), groundY(L.goal), 'goal').setOrigin(0.5, 1).refreshBody();

    // Crates (only dad can push)
    this.crates = this.physics.add.group();
    for (const c of L.crates) {
      const s = this.crates.create(wx(c), c.y * TILE + TILE / 2, 'crate') as Sprite;
      (s.body as Body).setDragX(1200).setMaxVelocityX(110).setCollideWorldBounds(true);
    }

    // Crabs
    for (const c of L.crabs) {
      const s = this.physics.add.sprite(wx(c), groundY(c) - 12, 'crab_a').play('crab_walk');
      (s.body as Body).setSize(s.width - 6, 16).setOffset(3, s.height - 16);
      this.crabs.push({ s, min: c.min * TILE, max: (c.max + 1) * TILE, dir: -1 });
    }

    // Crushers (visual only, hits are checked manually)
    for (const c of L.crushers) {
      this.crushers.push({ img: this.add.image(c.x * TILE, CRUSHER_UP, 'crusher').setOrigin(0.5, 1), phase: c.phase });
    }

    // Moving platforms
    for (const m of L.movers) {
      const s = this.physics.add.sprite(m.x * TILE + 48, 0, 'mplat');
      s.y = m.y * TILE + s.height / 2;
      (s.body as Body).setAllowGravity(false).setImmovable(true).setSize(s.width, 16, false).setOffset(0, 0);
      this.movers.push({ s, min: m.min * TILE + 48, max: (m.max + 1) * TILE - 48, speed: m.speed, dir: 1 });
    }

    // Player
    this.player = this.physics.add.sprite(this.respawn.x, this.respawn.y - 30, 'dad_idle');
    this.player.setCollideWorldBounds(true).setDepth(10);
    this.applyForm(CHARS.dad.form);
    this.player.play('dad_idle');

    // Physics wiring
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.crates, this.layer);
    this.physics.add.collider(this.crates, this.crates);
    this.physics.add.collider(this.player, this.crates);
    this.physics.add.collider(this.player, this.movers.map((m) => m.s));
    for (const c of this.crabs) this.physics.add.collider(c.s, this.layer);
    this.physics.add.overlap(this.player, coins, (_p, c) => this.collect(c as Sprite, 'coin'));
    this.physics.add.overlap(this.player, stars, (_p, c) => this.collect(c as Sprite, 'star'));
    this.physics.add.overlap(this.player, cps, (_p, c) => this.checkpoint(c as Sprite));
    this.physics.add.overlap(this.player, goal, () => this.win());
    this.physics.add.overlap(this.player, this.crabs.map((c) => c.s), (_p, c) => this.hitCrab(c as Sprite));

    const cam = this.cameras.main;
    cam.setBounds(0, VIEW_TOP, worldW, GAME_H);
    cam.startFollow(this.player, true, 0.15, 0.15, -30, 0);

    // Input
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,Z,X,E,SHIFT,Q,ONE,TWO,THREE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    const isTouch = this.sys.game.device.input.touch;
    this.touch = new TouchControls(this, isTouch);

    this.createHud();
    this.refreshAbilityButton();

    this.toast('Уровень 1: Побережье');
    if (!isTouch) {
      const help = this.add.text(GAME_W / 2, GAME_H - 30, '←→ бег  Пробел прыжок\nE способность  1/2/3 или Q герой', {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', align: 'center', backgroundColor: '#0b1530aa', padding: { x: 6, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
      this.tweens.add({ targets: help, alpha: 0, delay: 9000, duration: 800 });
    }
  }

  // ---------- frame ----------

  update(_t: number, deltaMs: number) {
    if (this.ended) return;
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    const input = this.readInput();

    this.updateSlow(dt, input);
    this.updateHazards(dt);
    this.updatePlayer(dt, input);
    this.updateParallax();
    this.prev = { jump: input.jump, ability: this.prevAbilityRaw };
  }

  private prevAbilityRaw = false;

  private readInput(): Input {
    const k = this.keys;
    const t = this.touch.poll();
    const jump = k.SPACE.isDown || k.UP.isDown || k.W.isDown || k.Z.isDown || t.has('jump');
    const ability = k.E.isDown || k.X.isDown || k.SHIFT.isDown || t.has('ability');
    const abilityPressed = ability && !this.prev.ability;
    this.prevAbilityRaw = ability;

    const J = Phaser.Input.Keyboard.JustDown;
    if (J(k.ONE)) this.trySwitch('dad');
    if (J(k.TWO)) this.trySwitch('mom');
    if (J(k.THREE)) this.trySwitch('girl');
    if (J(k.Q)) this.trySwitch(ORDER[(ORDER.indexOf(this.active) + 1) % ORDER.length]);

    return {
      left: k.LEFT.isDown || k.A.isDown || t.has('left'),
      right: k.RIGHT.isDown || k.D.isDown || t.has('right'),
      up: k.UP.isDown || k.W.isDown,
      down: k.DOWN.isDown || k.S.isDown,
      jump,
      jumpPressed: jump && !this.prev.jump,
      abilityPressed,
    };
  }

  private get slow() { return this.slowT > 0 ? SLOW.factor : 1; }

  private updateSlow(dt: number, input: Input) {
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) { this.slowCd = SLOW.cooldown; this.hud.slowTint.setVisible(false); }
    } else if (this.slowCd > 0) {
      this.slowCd = Math.max(0, this.slowCd - dt);
    }
    if (input.abilityPressed) this.useAbility();
    if (this.active === 'mom') {
      const cd = this.slowT > 0 ? 1 - this.slowT / SLOW.duration : this.slowCd / SLOW.cooldown;
      this.touch.setAbilityLabel(CHARS.mom.ability, cd);
    }
  }

  private updateHazards(dt: number) {
    const s = this.slow;
    this.time01 += (dt * s) / CRUSHER_PERIOD;
    const pb = (this.player.body as Body);

    for (const c of this.crushers) {
      const ph = (this.time01 + c.phase) % 1;
      let k: number;
      if (ph < 0.35) k = 0;
      else if (ph < 0.45) k = Phaser.Math.Easing.Quadratic.In((ph - 0.35) / 0.1);
      else if (ph < 0.75) k = 1;
      else k = 1 - (ph - 0.75) / 0.25;
      c.img.y = Phaser.Math.Linear(CRUSHER_UP, CRUSHER_DOWN, k);
      const left = c.img.x - 32, right = c.img.x + 32;
      if (pb.right > left + 2 && pb.left < right - 2 && pb.top < c.img.y - 4) {
        // Always thrown back to the entry side, so the crushers can't be tanked through.
        pb.reset(left - pb.halfWidth - 2, this.player.y);
        this.hurt(c.img.x + 64);
      }
    }

    for (const m of this.movers) {
      const b = m.s.body as Body;
      if (m.s.x >= m.max) m.dir = -1;
      if (m.s.x <= m.min) m.dir = 1;
      b.setVelocityX(m.dir * m.speed * s);
    }

    for (const c of this.crabs) {
      if (!c.s.active) continue;
      const b = c.s.body as Body;
      if (c.s.x < c.min || b.blocked.left) c.dir = 1;
      if (c.s.x > c.max || b.blocked.right) c.dir = -1;
      b.setVelocityX(c.dir * 45 * s);
      c.s.anims.timeScale = s;
    }

    // Only dad pushes crates; nobody shoves a crate by landing on it.
    this.crates.children.each((obj) => {
      const cb = (obj as Sprite).body as Body;
      cb.pushable = this.active === 'dad' && pb.bottom > cb.top + 6;
      return true;
    });
  }

  private updatePlayer(dt: number, input: Input) {
    const p = this.player;
    const b = p.body as Body;

    if (this.invuln > 0) {
      this.invuln -= dt;
      p.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 12) % 2 ? 0.35 : 1);
    }
    if (this.exitWaterT > 0) this.exitWaterT -= dt;

    if (p.y > this.level.height * TILE + 40) { this.hurt(undefined, true); return; }

    const inWater = this.isWater(p.x, b.center.y);
    if (this.active === 'girl') {
      if (inWater && !this.axo && this.exitWaterT <= 0) this.setAxo(true);
      else if (!inWater && this.axo) this.setAxo(false);
    } else if (inWater) {
      this.splash(p.x, b.center.y);
      this.hurt(undefined, true);
      return;
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) p.setFlipX(dir < 0);

    if (this.axo) {
      b.setVelocityX(toward(b.velocity.x, dir * 140, 900 * dt));
      const atSurface = !this.isWater(p.x, b.top - 6);
      if (input.jump && atSurface) {
        this.setAxo(false);
        this.exitWaterT = 0.4;
        b.setVelocityY(-PHYS.jump * 1.1);
        this.splash(p.x, b.top);
        return;
      }
      const targetVy = input.jump || input.up ? -150 : input.down ? 150 : 35;
      let vy = toward(b.velocity.y, targetVy, 700 * dt);
      if (atSurface && vy < 0) vy = 0;
      b.setVelocityY(vy);
      return;
    }

    const onGround = b.blocked.down || b.touching.down;
    this.coyote = onGround ? PHYS.coyote : this.coyote - dt;
    this.jumpBuffer = input.jumpPressed ? PHYS.jumpBuffer : this.jumpBuffer - dt;

    if (this.knockT > 0) this.knockT -= dt;
    else b.setVelocityX(toward(b.velocity.x, dir * PHYS.run, (onGround ? 2000 : 1300) * dt));

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      b.setVelocityY(-PHYS.jump);
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumpHeld = true;
    }
    if (this.jumpHeld && !input.jump && b.velocity.y < -200) { b.setVelocityY(b.velocity.y * 0.5); this.jumpHeld = false; }
    if (b.velocity.y >= 0) this.jumpHeld = false;

    const anim = !onGround ? 'jump' : dir !== 0 ? 'run' : 'idle';
    p.play(`${this.active}_${anim}`, true);
  }

  private updateParallax() {
    const x = this.cameras.main.scrollX;
    for (const l of this.bg) l.s.tilePositionX = x * l.f;
  }

  // ---------- characters ----------

  private applyForm(f: Form) {
    const p = this.player;
    const b = p.body as Body;
    const bottom = b.bottom, cx = b.center.x, vx = b.velocity.x, vy = b.velocity.y;
    p.setTexture(f.tex);
    const [w, h, ox, oy] = f.body;
    b.setSize(w, h, false).setOffset(ox, oy);
    b.reset(cx, bottom - h - oy + p.height * p.originY);
    b.setVelocity(vx, vy);
  }

  private setAxo(on: boolean) {
    this.axo = on;
    const b = this.player.body as Body;
    b.setAllowGravity(!on);
    if (on) {
      this.applyForm(AXOLOTL);
      this.player.play('axo_swim');
      b.setVelocityY(b.velocity.y * 0.3);
    } else {
      this.applyForm(CHARS.girl.form);
      this.player.play('girl_jump');
    }
  }

  private trySwitch(id: CharId) {
    if (this.ended || id === this.active) return;
    if (this.axo || this.isWater(this.player.x, (this.player.body as Body).center.y)) {
      this.toast('Сначала выберись из воды');
      return;
    }
    this.active = id;
    this.applyForm(CHARS[id].form);
    this.player.play(`${id}_idle`);
    this.puff(this.player.x, this.player.y);
    this.refreshAbilityButton();
    this.drawPortraitFrames();
  }

  private useAbility() {
    if (this.active === 'mom') {
      if (this.slowT > 0) return;
      if (this.slowCd > 0) { this.toast('Маме нужно отдохнуть'); return; }
      this.slowT = SLOW.duration;
      this.hud.slowTint.setVisible(true);
      this.toast('Мама поёт... время замедлилось');
      return;
    }
    const nearLever = Math.abs(this.player.x - this.lever.x) < 48 && Math.abs(this.player.y - this.lever.y) < 64;
    if (nearLever && !this.leverOn) {
      if (this.active !== 'dad') { this.toast('Рычаг слишком тугой. Нужен папа!'); return; }
      this.pullLever();
      return;
    }
    if (this.active === 'dad') this.toast('Папа толкает ящики и запускает механизмы');
    else this.toast('В воде дочка превращается в аксолотля');
  }

  private pullLever() {
    this.leverOn = true;
    this.lever.setTexture('lever_on');
    this.toast('Мост опускается!');
    this.level.bridge.forEach((t, i) => {
      this.time.delayedCall(90 * i, () => {
        const tile = this.layer.putTileAt(T.PLANK, t.x, t.y);
        tile.setCollision(true, true, true, true);
        this.puff(t.x * TILE + 16, t.y * TILE + 8, 0.5);
      });
    });
  }

  private refreshAbilityButton() {
    this.touch.setAbilityLabel(CHARS[this.active].ability, 0);
  }

  // ---------- events ----------

  private collect(s: Sprite, kind: 'coin' | 'star') {
    if (!s.body?.enable) return;
    s.disableBody(false, false);
    this.tweens.killTweensOf(s);
    this.tweens.add({ targets: s, y: s.y - 30, alpha: 0, scale: 1.6, duration: 300, onComplete: () => s.destroy() });
    if (kind === 'coin') { this.coins++; this.hud.coins.setText(`× ${String(this.coins).padStart(3, '0')}`); }
    else { this.stars++; this.hud.stars.setText(`× ${this.stars}/3`); this.toast(`Звезда ${this.stars}/3!`); }
  }

  private checkpoint(s: Sprite) {
    if (s.texture.key === 'cp_on') return;
    s.setTexture('cp_on');
    this.respawn = { x: s.x, y: s.y };
    this.puff(s.x, s.y - 20, 0.6);
  }

  private hitCrab(s: Sprite) {
    const pb = this.player.body as Body;
    if (!s.active) return;
    if (pb.velocity.y > 0 && pb.bottom < s.y + 4) {
      s.disableBody(false, false);
      s.anims.stop();
      this.tweens.add({ targets: s, scaleY: 0.2, alpha: 0, y: s.y + 8, duration: 250, onComplete: () => s.destroy() });
      pb.setVelocityY(-PHYS.jump * 0.75);
      return;
    }
    this.hurt(s.x);
  }

  private hurt(fromX?: number, respawn = false) {
    if (this.ended) return;
    if (this.invuln <= 0 || respawn) {
      if (this.invuln <= 0) {
        this.hearts[this.active]--;
        this.invuln = 1.2;
        this.cameras.main.shake(140, 0.008);
        this.updateHearts();
      }
      if (this.hearts[this.active] <= 0) { this.gameOver(); return; }
    } else return;

    const b = this.player.body as Body;
    if (respawn) {
      if (this.axo) this.setAxo(false);
      const h = b.height + b.offset.y;
      b.reset(this.respawn.x, this.respawn.y - h + this.player.height * this.player.originY - 1);
      this.cameras.main.flash(150, 255, 255, 255);
    } else if (fromX !== undefined) {
      b.setVelocity(this.player.x < fromX ? -220 : 220, -300);
      this.knockT = 0.25;
    }
  }

  private isWater(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && (t.index === T.WATER || t.index === T.WATER_TOP);
  }

  // ---------- end screens ----------

  private win() {
    if (this.ended) return;
    this.ended = true;
    this.physics.pause();
    this.player.play(`${this.active}_idle`);
    this.endScreen('Уровень пройден!', true);
  }

  private gameOver() {
    this.ended = true;
    this.physics.pause();
    this.endScreen(`У ${CHARS[this.active].name === 'Дочка' ? 'дочки' : CHARS[this.active].name === 'Мама' ? 'мамы' : 'папы'}\nкончились сердечки`, false);
  }

  private endScreen(title: string, won: boolean) {
    const d = 2000;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b1530, 0.75).setOrigin(0).setScrollFactor(0).setDepth(d);
    this.add.text(GAME_W / 2, 210, title, { fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(d);
    if (won) {
      for (let i = 0; i < 3; i++) {
        const s = this.add.image(GAME_W / 2 + (i - 1) * 56, 290, 'star').setScale(2.6).setScrollFactor(0).setDepth(d);
        if (i >= this.stars) s.setTint(0x555555).setAlpha(0.45);
      }
      this.add.text(GAME_W / 2, 350, `Монеты: ${this.coins}`, { fontFamily: 'monospace', fontSize: '18px', color: '#ffd83a' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(d);
    }
    const btn = this.add.text(GAME_W / 2, 430, 'Играть снова', {
      fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color: '#0b1530', backgroundColor: '#ffd83a', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.restart());
    this.keys.ENTER.once('down', () => this.scene.restart());
    this.keys.SPACE.once('down', () => this.scene.restart());
  }

  // ---------- visuals ----------

  private createBackground() {
    this.add.image(0, 0, 'bg_sky').setOrigin(0).setScrollFactor(0);
    const layer = (key: string, y: number, h: number, f: number) => {
      const s = this.add.tileSprite(0, y, GAME_W, h, key).setOrigin(0).setScrollFactor(0);
      this.bg.push({ s, f });
    };
    if (this.textures.get('bg_sea').getSourceImage().height > 200) {
      // Painted art: 384px tall layers.
      layer('bg_mountains', -25, 384, 0.12);
      layer('bg_sea', 60, 384, 0.25);
      this.add.rectangle(0, 440, GAME_W, 200, 0x279fed).setOrigin(0).setScrollFactor(0);
      if (this.textures.exists('bg_trees')) {
        const h = this.textures.get('bg_trees').getSourceImage().height;
        layer('bg_trees', 422 - h, h, 0.5);
      }
    } else {
      layer('bg_clouds', 90, 120, 0.08);
      layer('bg_mountains', 154, 180, 0.2);
      layer('bg_sea', 294, 140, 0.35);
      this.add.rectangle(0, 434, GAME_W, 206, 0x2e8be6).setOrigin(0).setScrollFactor(0);
    }
  }

  private createHud() {
    const d = 1500;
    const frames = this.add.graphics().setScrollFactor(0).setDepth(d);
    const hearts = {} as Record<CharId, Phaser.GameObjects.Image[]>;
    ORDER.forEach((id, i) => {
      const y = 12 + i * 54;
      const img = this.add.image(34, y + 22, `portrait_${id}`).setScrollFactor(0).setDepth(d + 1)
        .setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => this.trySwitch(id));
      hearts[id] = [0, 1, 2].map((j) => this.add.image(78 + j * 20, y + 22, 'heart').setScrollFactor(0).setDepth(d + 1));
    });
    const panel = (y: number) => this.add.graphics().setScrollFactor(0).setDepth(d)
      .fillStyle(0x14234a, 0.9).fillRoundedRect(GAME_W - 122, y, 110, 40, 8)
      .lineStyle(2, 0xcfe3ff, 0.9).strokeRoundedRect(GAME_W - 122, y, 110, 40, 8);
    panel(12); panel(60);
    this.add.image(GAME_W - 100, 32, 'coin').setScale(1.4).setScrollFactor(0).setDepth(d + 1);
    this.add.image(GAME_W - 100, 80, 'star').setScale(1.2).setScrollFactor(0).setDepth(d + 1);
    const style = { fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#ffffff' };
    const coins = this.add.text(GAME_W - 82, 32, '× 000', style).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d + 1);
    const stars = this.add.text(GAME_W - 82, 80, '× 0/3', style).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d + 1);
    const slowTint = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x7a5cff, 0.28).setOrigin(0).setScrollFactor(0).setDepth(900).setVisible(false);
    this.hud = { frames, hearts, coins, stars, slowTint };
    this.toastText = this.add.text(GAME_W / 2, 186, '', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffffff', align: 'center',
      backgroundColor: '#0b1530cc', padding: { x: 10, y: 6 }, wordWrap: { width: GAME_W - 40 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2).setAlpha(0);
    this.drawPortraitFrames();
  }

  private drawPortraitFrames() {
    const g = this.hud.frames.clear();
    ORDER.forEach((id, i) => {
      const y = 12 + i * 54, on = id === this.active;
      g.fillStyle(0x14234a, 0.9).fillRoundedRect(10, y, 48, 48, 6);
      g.lineStyle(on ? 4 : 2, on ? 0xffd83a : 0xcfe3ff, 1).strokeRoundedRect(10, y, 48, 48, 6);
    });
  }

  private updateHearts() {
    for (const id of ORDER) this.hud.hearts[id].forEach((h, j) => h.setTexture(j < this.hearts[id] ? 'heart' : 'heart_empty'));
  }

  private toast(msg: string) {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1800, duration: 400 });
  }

  private puff(x: number, y: number, scale = 1) {
    const c = this.add.circle(x, y, 18 * scale, 0xffffff, 0.8).setDepth(20);
    this.tweens.add({ targets: c, scale: 2, alpha: 0, duration: 300, onComplete: () => c.destroy() });
  }

  private splash(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const c = this.add.circle(x, y, 3, 0xbfe8ff).setDepth(20);
      this.tweens.add({ targets: c, x: x + Phaser.Math.Between(-24, 24), y: y - Phaser.Math.Between(10, 40), alpha: 0, duration: 400, onComplete: () => c.destroy() });
    }
  }
}
