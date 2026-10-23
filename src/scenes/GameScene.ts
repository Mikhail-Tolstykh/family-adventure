import Phaser from 'phaser';
import { AXOLOTL, CHARS, CharId, DASH, Form, GAME_H, GAME_W, ORDER, PHYS, SLOW, SWIM, TILE } from '../config';
import { buildLevel, LEVEL_COUNT, LevelData, Lever, Pt, SOLID_TILES, T, VIEW_TOP } from '../level';
import { TouchControls } from '../controls';
import { saveStars } from '../progress';

type Body = Phaser.Physics.Arcade.Body;
type Sprite = Phaser.Physics.Arcade.Sprite;
type Img = Phaser.GameObjects.Image;

interface Input { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; jumpPressed: boolean; abilityPressed: boolean }
interface Crab { s: Sprite; min: number; max: number; dir: number }
interface Mover { s: Sprite; min: number; max: number; speed: number; dir: number }
interface Rock { shadow: Phaser.GameObjects.Ellipse; x: number; ground: number; phase: number; spawnT: number }
interface RockBit { img: Img; x: number; ground: number }
interface Gull { s: Img; min: number; max: number; homeY: number; dir: number; mode: 'patrol' | 'dive' | 'rise'; tx: number; ty: number; t: number; cd: number }
interface BarrelSpawner { x: number; y: number; min: number; period: number; speed: number; t: number }
interface Shark { s: Img; cx: number; cy: number; r: number; speed: number; a: number }
interface Octo { s: Img; t: number }
interface Jelly { s: Img; x: number; y: number; range: number; a: number }
interface Ink { s: Img; vx: number; vy: number; life: number }

const wx = (p: Pt) => p.x * TILE + TILE / 2;
const groundY = (p: Pt) => (p.y + 1) * TILE;
const mulColor = (a: number, b: number) =>
  [16, 8, 0].reduce((acc, sh) => acc | (Math.round((((a >> sh) & 255) * ((b >> sh) & 255)) / 255) << sh), 0);
const toward = (v: number, target: number, step: number) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

// Feet are drawn this many pixels below the hitbox so they sit in the grass, not on top of it.
const FEET_SINK = 2;
const ROCK_PERIOD = 1.0;
const ROCK_TOP = VIEW_TOP - 30;

export class GameScene extends Phaser.Scene {
  private levelIndex = 0;
  private level!: LevelData;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Sprite;
  private touch!: TouchControls;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private active: CharId = 'dad';
  private axo = false;
  private swimming = false;
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
  private pushT = 0;
  private slowT = 0;
  private slowCd = 0;
  private dashT = 0;
  private dashCd = 0;
  private clock = 0;
  private ended = false;
  private prev = { jump: false, ability: false };
  private prevAbilityRaw = false;

  private crates!: Phaser.Physics.Arcade.Group;
  private barrelGroup!: Phaser.Physics.Arcade.Group;
  private crabs: Crab[] = [];
  private movers: Mover[] = [];
  private levers: { lv: Lever; img: Img; on: boolean }[] = [];
  private rocks: Rock[] = [];
  private rockBits: RockBit[] = [];
  private gulls: Gull[] = [];
  private spawners: BarrelSpawner[] = [];
  private sharks: Shark[] = [];
  private octos: Octo[] = [];
  private jellies: Jelly[] = [];
  private urchins: Img[] = [];
  private inks: Ink[] = [];
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

  init(data: { level?: number }) {
    Object.assign(this, {
      levelIndex: data.level ?? 0,
      active: 'dad', axo: false, swimming: false, hearts: { dad: 3, mom: 3, girl: 3 }, coins: 0, stars: 0,
      coyote: 0, jumpBuffer: 0, jumpHeld: false, knockT: 0, invuln: 0, exitWaterT: 0, pushT: 0,
      slowT: 0, slowCd: 0, dashT: 0, dashCd: 0, clock: 0, ended: false, prev: { jump: false, ability: false },
      crabs: [], movers: [], levers: [], rocks: [], rockBits: [], gulls: [], spawners: [], sharks: [], octos: [], jellies: [], urchins: [], inks: [], bg: [],
    });
  }

  create() {
    this.level = buildLevel(this.levelIndex);
    const L = this.level;
    const worldW = L.width * TILE;

    this.createBackground();

    // Bottomless pits get a dark chasm so they don't read as water.
    const bottom = L.tiles.length - 1;
    for (let x = 0; x < L.width; x++) {
      if (L.tiles[bottom][x] !== -1) continue;
      let x1 = x;
      while (x1 + 1 < L.width && L.tiles[bottom][x1 + 1] === -1) x1++;
      const side = L.tiles.map((r) => r[Math.max(0, x - 1)]).findIndex((t) => t !== -1);
      const top = (side < 0 ? 16 : side) * TILE + 6;
      const g = this.add.graphics();
      for (let i = 0; i < 6; i++) g.fillStyle(0x0b1530, 0.35 + i * 0.12).fillRect(x * TILE, top + i * 24, (x1 - x + 1) * TILE, i === 5 ? L.height * TILE : 24);
      x = x1;
    }

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

    const cps = this.physics.add.staticGroup();
    for (const c of L.checkpoints) {
      const s = cps.create(wx(c), groundY(c), 'cp_off') as Sprite;
      s.setOrigin(0.5, 1).refreshBody();
    }
    this.respawn = { x: wx(L.start), y: groundY(L.start) };

    for (const lv of L.levers) this.levers.push({ lv, img: this.add.image(wx(lv), groundY(lv), 'lever_off').setOrigin(0.5, 1), on: false });

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

    this.crates = this.physics.add.group();
    for (const c of L.crates) {
      const s = this.crates.create(wx(c), c.y * TILE + TILE / 2, 'crate') as Sprite;
      (s.body as Body).setDragX(1200).setMaxVelocityX(110).setCollideWorldBounds(true);
    }

    for (const c of L.crabs) {
      const s = this.physics.add.sprite(wx(c), groundY(c) - 12, 'crab_a').play('crab_walk');
      (s.body as Body).setSize(s.width - 6, 16).setOffset(3, s.height - 16);
      this.crabs.push({ s, min: c.min * TILE, max: (c.max + 1) * TILE, dir: -1 });
    }

    for (const m of L.movers) {
      const s = this.physics.add.sprite(m.x * TILE + 48, 0, 'mplat');
      s.y = m.y * TILE + s.height / 2;
      (s.body as Body).setAllowGravity(false).setImmovable(true).setSize(s.width, s.height, false).setOffset(0, 0);
      this.movers.push({ s, min: m.min * TILE + 48, max: (m.max + 1) * TILE - 48, speed: m.speed, dir: 1 });
    }

    this.createHazards();

    // Player
    this.player = this.physics.add.sprite(this.respawn.x, this.respawn.y - 30, 'dad_idle');
    this.player.setCollideWorldBounds(true).setDepth(10);
    this.applyForm(CHARS.dad.form);
    this.player.play('dad_idle');

    // Physics wiring
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.crates, this.layer);
    this.physics.add.collider(this.crates, this.crates);
    this.physics.add.collider(this.player, this.crates, (_p, c) => {
      const pb = this.player.body as Body, cb = (c as Sprite).body as Body;
      if (this.active === 'dad' && pb.bottom > cb.top + 6) this.pushT = 0.15;
    });
    this.physics.add.collider(this.player, this.movers.map((m) => m.s));
    for (const c of this.crabs) this.physics.add.collider(c.s, this.layer);
    this.physics.add.collider(this.barrelGroup, this.layer);
    this.physics.add.overlap(this.player, coins, (_p, c) => this.collect(c as Sprite, 'coin'));
    this.physics.add.overlap(this.player, stars, (_p, c) => this.collect(c as Sprite, 'star'));
    this.physics.add.overlap(this.player, cps, (_p, c) => this.checkpoint(c as Sprite));
    this.physics.add.overlap(this.player, goal, () => this.win());
    this.physics.add.overlap(this.player, this.crabs.map((c) => c.s), (_p, c) => this.hitCrab(c as Sprite));
    this.physics.add.overlap(this.player, this.barrelGroup, (_p, s) => this.hurt((s as Sprite).x));

    const cam = this.cameras.main;
    cam.setBounds(0, VIEW_TOP, worldW, GAME_H);
    cam.startFollow(this.player, true, 0.15, 0.15, -30, 0);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,Z,X,E,SHIFT,Q,ONE,TWO,THREE,ENTER,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    const isTouch = this.sys.game.device.input.touch;
    this.touch = new TouchControls(this, isTouch);

    this.createHud();
    this.refreshAbilityButton();

    this.toast(`Уровень ${this.levelIndex + 1}: ${L.name}`);
    if (!isTouch && this.levelIndex === 0) {
      const help = this.add.text(GAME_W / 2, GAME_H - 30, '←→ бег  Пробел прыжок  ↓ нырнуть\nE способность  1/2/3 или Q герой', {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', align: 'center', backgroundColor: '#0b1530aa', padding: { x: 6, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
      this.tweens.add({ targets: help, alpha: 0, delay: 9000, duration: 800 });
    }
  }

  private createHazards() {
    const L = this.level;
    for (const r of L.rockfalls) {
      const x = r.x * TILE;
      const shadow = this.add.ellipse(x, r.ground * TILE + 2, 40, 10, 0x000000, 0.35).setDepth(5);
      this.rocks.push({ shadow, x, ground: r.ground * TILE, phase: r.phase, spawnT: 0 });
    }
    for (const g of L.gulls) {
      const s = this.add.image(wx(g), g.y * TILE, 'gull_a').setDepth(12);
      this.gulls.push({ s, min: g.min * TILE, max: (g.max + 1) * TILE, homeY: g.y * TILE, dir: -1, mode: 'patrol', tx: 0, ty: 0, t: 0, cd: 1 });
    }
    this.barrelGroup = this.physics.add.group();
    for (const b of L.barrels) this.spawners.push({ x: wx(b), y: groundY(b) - 14, min: b.min * TILE, period: b.period, speed: b.speed, t: 0 });
    for (const s of L.sharks) {
      this.sharks.push({ s: this.add.image(0, 0, 'shark').setDepth(12), cx: wx(s), cy: s.y * TILE + TILE / 2, r: s.r * TILE, speed: s.speed, a: s.phase });
    }
    for (const o of L.octopuses) this.octos.push({ s: this.add.image(wx(o), groundY(o), 'octo').setOrigin(0.5, 1).setDepth(11), t: Math.random() });
    for (const j of L.jellies) this.jellies.push({ s: this.add.image(wx(j), j.y * TILE, 'jelly').setDepth(11), x: wx(j), y: j.y * TILE + TILE / 2, range: j.range * TILE, a: Math.random() * 6 });
    for (const u of L.urchins) this.urchins.push(this.add.image(wx(u), groundY(u), 'urchin').setOrigin(0.5, 1).setDepth(11));
    // Streaks drifting with each current.
    for (const c of L.currents) {
      this.time.addEvent({
        delay: 120, loop: true, callback: () => {
          const x = (c.force < 0 ? c.x1 + 1 : c.x0) * TILE, y = Phaser.Math.Between(c.y0 * TILE + 4, (c.y1 + 1) * TILE - 4);
          const line = this.add.rectangle(x, y, 10, 2, 0xd8f3ff, 0.7).setDepth(9);
          this.tweens.add({ targets: line, x: x + Math.sign(c.force) * (c.x1 - c.x0 + 1) * TILE, alpha: 0.2, duration: 900, onComplete: () => line.destroy() });
        },
      });
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
    if (J(k.ESC)) this.scene.start('menu');

    return {
      left: k.LEFT.isDown || k.A.isDown || t.has('left'),
      right: k.RIGHT.isDown || k.D.isDown || t.has('right'),
      up: k.UP.isDown || k.W.isDown,
      down: k.DOWN.isDown || k.S.isDown || t.has('down'),
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
    if (this.dashCd > 0) this.dashCd -= dt;
    if (input.abilityPressed) this.useAbility(input);
    if (this.active === 'mom') {
      const cd = this.slowT > 0 ? 1 - this.slowT / SLOW.duration : this.slowCd / SLOW.cooldown;
      this.touch.setAbilityLabel(CHARS.mom.ability, cd);
    } else if (this.axo) {
      this.touch.setAbilityLabel('РЫВОК', Math.max(0, this.dashCd) / DASH.cooldown);
    }
  }

  private updateHazards(dt: number) {
    const s = this.slow;
    const sdt = dt * s;
    this.clock += sdt;
    const pb = this.player.body as Body;
    const hits = (x: number, y: number, w: number, h: number) =>
      pb.right > x - w / 2 && pb.left < x + w / 2 && pb.bottom > y - h / 2 && pb.top < y + h / 2;

    // Rockfall: a shadow grows, then a stream of stones pours down the column for a while.
    // Getting hit throws you back to where you came from, so a fast pour has to be waited out or slowed by mom.
    for (const r of this.rocks) {
      const ph = (this.clock / ROCK_PERIOD + r.phase) % 1;
      r.shadow.setScale(ph < 0.2 ? 0.3 : Math.min(1, 0.3 + (ph - 0.2) * 3)).setAlpha(ph >= 0.2 && ph < 0.85 ? 0.4 : 0.12);
      if (ph >= 0.45 && ph < 0.8) {
        r.spawnT -= sdt;
        if (r.spawnT <= 0) {
          r.spawnT = 0.06;
          const img = this.add.image(r.x + Phaser.Math.Between(-8, 8), ROCK_TOP, 'rock').setDepth(12).setScale(Phaser.Math.FloatBetween(0.6, 1));
          this.rockBits.push({ img, x: r.x, ground: r.ground });
        }
      }
    }
    this.rockBits = this.rockBits.filter((bit) => {
      bit.img.y += 560 * sdt;
      bit.img.angle += 500 * sdt;
      if (hits(bit.img.x, bit.img.y, 22, 20)) {
        pb.reset(bit.x - 40 - pb.halfWidth, this.player.y);
        this.hurt(bit.x + 64);
      }
      if (bit.img.y < bit.ground - 8) return true;
      if (Math.random() < 0.3) this.puff(bit.img.x, bit.ground - 4, 0.35, 0x9a9da8);
      bit.img.destroy();
      return false;
    });

    // Seagulls patrol, then swoop at the player.
    for (const g of this.gulls) {
      g.t += sdt;
      g.s.setTexture(Math.floor(g.t * 6) % 2 ? 'gull_b' : 'gull_a');
      if (g.mode === 'patrol') {
        g.s.x += g.dir * 70 * sdt;
        g.s.y = g.homeY + Math.sin(g.t * 3) * 6;
        if (g.s.x < g.min) g.dir = 1;
        if (g.s.x > g.max) g.dir = -1;
        g.cd -= sdt;
        const dx = this.player.x - g.s.x;
        if (g.cd <= 0 && Math.abs(dx) < 140 && this.player.y > g.s.y + 40) {
          g.mode = 'dive'; g.tx = this.player.x + dx * 0.3; g.ty = pb.center.y; g.t = 0;
        }
      } else if (g.mode === 'dive') {
        const a = Phaser.Math.Angle.Between(g.s.x, g.s.y, g.tx, g.ty);
        g.s.x += Math.cos(a) * 240 * sdt; g.s.y += Math.sin(a) * 240 * sdt;
        g.dir = Math.cos(a) < 0 ? -1 : 1;
        if (Phaser.Math.Distance.Between(g.s.x, g.s.y, g.tx, g.ty) < 8 || g.t > 1.2) { g.mode = 'rise'; g.t = 0; }
      } else {
        g.s.x += g.dir * 90 * sdt;
        g.s.y = toward(g.s.y, g.homeY, 130 * sdt);
        if (g.s.y === g.homeY) { g.mode = 'patrol'; g.cd = 2.2; }
      }
      g.s.setFlipX(g.dir > 0);
      if (hits(g.s.x, g.s.y + 4, 24, 12)) this.hurt(g.s.x);
    }

    // Barrels roll left from their spawner.
    for (const sp of this.spawners) {
      sp.t -= sdt;
      if (sp.t <= 0 && Math.abs(this.player.x - sp.x) < GAME_W * 1.2) {
        sp.t = sp.period;
        const b = this.barrelGroup.create(sp.x, sp.y, 'barrel') as Sprite;
        (b.body as Body).setCircle(11, 1, 1);
        b.setData('sp', sp);
      }
    }
    this.barrelGroup.children.each((o) => {
      const b = o as Sprite, sp = b.getData('sp') as BarrelSpawner, body = b.body as Body;
      body.setVelocityX(-sp.speed * s);
      b.angle -= sp.speed * sdt * 2.4;
      if (b.x < sp.min || b.y > this.level.height * TILE) b.destroy();
      return true;
    });

    // Sharks swim in circles.
    for (const sh of this.sharks) {
      sh.a += sh.speed * sdt;
      sh.s.setPosition(sh.cx + Math.cos(sh.a) * sh.r, sh.cy + Math.sin(sh.a) * sh.r);
      sh.s.setFlipX(-Math.sin(sh.a) * sh.speed < 0);
      if (hits(sh.s.x, sh.s.y, 46, 14)) this.hurt(sh.s.x);
    }

    // Octopuses shoot ink at whoever is in the water nearby.
    for (const o of this.octos) {
      o.t -= sdt;
      const d = Phaser.Math.Distance.Between(o.s.x, o.s.y - 14, this.player.x, pb.center.y);
      if (o.t <= 0 && d < 240 && this.isWater(this.player.x, pb.center.y)) {
        o.t = 2.4;
        const a = Phaser.Math.Angle.Between(o.s.x, o.s.y - 16, this.player.x, pb.center.y);
        this.inks.push({ s: this.add.image(o.s.x, o.s.y - 16, 'ink').setDepth(12), vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 3 });
        this.tweens.add({ targets: o.s, scaleY: 0.8, duration: 120, yoyo: true });
      }
      if (hits(o.s.x, o.s.y - 12, 26, 20)) this.hurt(o.s.x);
    }
    this.inks = this.inks.filter((ink) => {
      ink.life -= sdt;
      ink.s.x += ink.vx * sdt; ink.s.y += ink.vy * sdt;
      const gone = ink.life <= 0 || !this.isWater(ink.s.x, ink.s.y);
      const hit = !gone && hits(ink.s.x, ink.s.y, 10, 10);
      if (hit) { this.hurt(ink.s.x); this.puff(ink.s.x, ink.s.y, 0.8, 0x24123a); }
      if (gone || hit) { ink.s.destroy(); return false; }
      return true;
    });

    for (const j of this.jellies) {
      j.a += sdt * 1.4;
      j.s.setPosition(j.x + Math.sin(j.a * 0.7) * 4, j.y + ((Math.sin(j.a) + 1) / 2) * j.range);
      if (hits(j.s.x, j.s.y, 18, 22)) this.hurt(j.s.x);
    }
    for (const u of this.urchins) if (hits(u.x, u.y - 7, 20, 12)) this.hurt(u.x);

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
    if (this.knockT > 0) this.knockT -= dt;

    if (p.y > this.level.height * TILE + 40) { this.hurt(undefined, true); return; }

    const inWater = this.isWater(p.x, b.center.y);
    if (this.active === 'girl') {
      if (inWater && !this.axo && this.exitWaterT <= 0) this.setAxo(true);
      else if (!inWater && this.axo) this.setAxo(false);
    } else if (inWater && !this.swimming && this.exitWaterT <= 0) {
      this.setSwimming(true);
    } else if (!inWater && this.swimming) {
      this.setSwimming(false);
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) p.setFlipX(dir < 0);

    if (this.axo) { this.updateAxo(dt, input, dir); return; }
    if (this.swimming) { this.updateSwim(dt, input, dir); return; }

    const onGround = b.blocked.down || b.touching.down;
    this.coyote = onGround ? PHYS.coyote : this.coyote - dt;
    this.jumpBuffer = input.jumpPressed ? PHYS.jumpBuffer : this.jumpBuffer - dt;

    if (this.knockT <= 0) b.setVelocityX(toward(b.velocity.x, dir * PHYS.run, (onGround ? 2000 : 1300) * dt));

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      b.setVelocityY(-PHYS.jump);
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumpHeld = true;
    }
    if (this.jumpHeld && !input.jump && b.velocity.y < -200) { b.setVelocityY(b.velocity.y * 0.5); this.jumpHeld = false; }
    if (b.velocity.y >= 0) this.jumpHeld = false;

    if (this.pushT > 0) this.pushT -= dt;
    const anim = !onGround ? (b.velocity.y < 0 ? 'jump' : 'fall') : dir !== 0 ? (this.pushT > 0 ? 'push' : 'run') : 'idle';
    p.anims.timeScale = 1;
    p.play(`${this.active}_${anim}`, true);
  }

  /** The axolotl swims freely underwater; the ability button is a dash. */
  private updateAxo(dt: number, input: Input, dir: number) {
    const p = this.player, b = p.body as Body;
    if (this.dashT > 0) {
      this.dashT -= dt;
      if (Math.random() < 0.6) this.bubble(p.x - Math.sign(b.velocity.x) * 14, b.center.y);
      return;
    }
    const cur = this.currentAt(p.x, b.center.y);
    if (this.knockT <= 0) b.setVelocityX(toward(b.velocity.x, dir * SWIM.axoSpeed + cur, 900 * dt));
    // Open air right above (not rock): the axolotl can jump out here.
    const above = this.layer.getTileAtWorldXY(p.x, b.top - 6);
    const atSurface = !this.isWater(p.x, b.top - 6) && !(above && above.collides);
    if (input.jump && atSurface && this.knockT <= 0) {
      this.setAxo(false);
      this.exitWaterT = 0.4;
      b.setVelocityY(-PHYS.jump * 1.1);
      this.splash(p.x, b.top);
      return;
    }
    const targetVy = input.jump || input.up ? -150 : input.down ? 160 : 40;
    let vy = toward(b.velocity.y, targetVy, 700 * dt);
    if (atSurface && vy < 0) vy = 0;
    b.setVelocityY(vy);
  }

  /** Dad and mom float with their heads above water and can jump out. */
  private updateSwim(dt: number, input: Input, dir: number) {
    const p = this.player, b = p.body as Body;
    const target = this.surfaceY(p.x, b.center.y) + 6;
    const near = Math.abs(b.center.y - target) < 14;
    if (input.jumpPressed && near) {
      this.setSwimming(false);
      this.exitWaterT = 0.3;
      b.setVelocityY(-PHYS.jump);
      this.splash(p.x, target - 6);
      p.play(`${this.active}_jump`, true);
      return;
    }
    if (this.knockT <= 0) b.setVelocityX(toward(b.velocity.x, dir * SWIM.speed, 900 * dt));
    const want = Phaser.Math.Clamp((target - b.center.y) * 6, -180, 260);
    b.setVelocityY(toward(b.velocity.y, want, 1400 * dt));
    p.anims.timeScale = 0.6;
    p.play(`${this.active}_${dir !== 0 ? 'run' : 'idle'}`, true);
    if (dir !== 0 && Math.random() < 0.15) this.bubble(p.x - dir * 12, target - 4);
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
    // Body is centered on the frame and stands on its bottom edge, whatever the frame size.
    const [w, h] = f.body;
    const ox = (p.width - w) / 2, oy = p.height - h - FEET_SINK;
    b.setSize(w, h, false).setOffset(ox, oy);
    b.reset(cx, bottom - h - oy + p.height * p.originY);
    b.setVelocity(vx, vy);
  }

  private setAxo(on: boolean) {
    this.axo = on;
    const b = this.player.body as Body;
    b.setAllowGravity(!on);
    this.dashT = 0;
    if (on) {
      this.applyForm(AXOLOTL);
      this.player.anims.timeScale = 1;
      this.player.play('axo_swim');
      b.setVelocityY(b.velocity.y * 0.3);
      this.splash(this.player.x, b.top);
    } else {
      this.applyForm(CHARS.girl.form);
      this.player.play('girl_jump');
    }
    this.refreshAbilityButton();
  }

  private setSwimming(on: boolean) {
    this.swimming = on;
    const b = this.player.body as Body;
    b.setAllowGravity(!on);
    if (on) { b.setVelocityY(b.velocity.y * 0.3); this.splash(this.player.x, b.center.y); }
  }

  private trySwitch(id: CharId) {
    if (this.ended || id === this.active) return;
    if (this.axo || this.swimming || this.isWater(this.player.x, (this.player.body as Body).center.y)) {
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

  private useAbility(input: Input) {
    if (this.axo) { this.dash(input); return; }
    if (this.active === 'mom') {
      if (this.slowT > 0) return;
      if (this.slowCd > 0) { this.toast('Маме нужно отдохнуть'); return; }
      this.slowT = SLOW.duration;
      this.hud.slowTint.setVisible(true);
      this.toast('Мама поёт... время замедлилось');
      return;
    }
    const near = this.levers.find((l) => !l.on && Math.abs(this.player.x - l.img.x) < 48 && Math.abs(this.player.y - l.img.y) < 64);
    if (near) {
      if (this.active !== 'dad') { this.toast('Рычаг слишком тугой. Нужен папа!'); return; }
      this.pullLever(near);
      return;
    }
    if (this.active === 'dad') this.toast('Папа толкает ящики и тянет рычаги');
    else this.toast('В воде дочка становится аксолотлем и делает рывок');
  }

  private dash(input: Input) {
    if (this.dashCd > 0 || this.dashT > 0) return;
    const p = this.player, b = p.body as Body;
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up || input.jump ? 1 : 0);
    if (dx === 0 && dy === 0) dx = p.flipX ? -1 : 1;
    const len = Math.hypot(dx, dy);
    b.setVelocity((dx / len) * DASH.speed, (dy / len) * DASH.speed);
    this.dashT = DASH.time;
    this.dashCd = DASH.cooldown;
    for (let i = 0; i < 5; i++) this.bubble(p.x, b.center.y);
  }

  private pullLever(l: { lv: Lever; img: Img; on: boolean }) {
    l.on = true;
    l.img.setTexture('lever_on');
    this.toast('Мост опускается!');
    l.lv.bridge.forEach((t, i) => {
      this.time.delayedCall(90 * i, () => {
        const tile = this.layer.putTileAt(T.PLANK, t.x, t.y);
        tile.setCollision(true, true, true, true);
        this.puff(t.x * TILE + 16, t.y * TILE + 8, 0.5);
      });
    });
  }

  private refreshAbilityButton() {
    this.touch.setAbilityLabel(this.axo ? 'РЫВОК' : CHARS[this.active].ability, 0);
    this.touch.setDownVisible(this.axo);
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
      if (this.swimming) this.setSwimming(false);
      const h = b.height + b.offset.y;
      b.reset(this.respawn.x, this.respawn.y - h + this.player.height * this.player.originY - 1);
      this.cameras.main.flash(150, 255, 255, 255);
    } else if (fromX !== undefined) {
      const away = this.player.x < fromX ? -1 : 1;
      const inWater = this.axo || this.swimming;
      b.setVelocity(away * (inWater ? 200 : 220), inWater ? 0 : -300);
      this.dashT = 0;
      this.knockT = 0.25;
    }
  }

  private isWater(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && (t.index === T.WATER || t.index === T.WATER_TOP);
  }

  /** Top of the water column the point is in. */
  private surfaceY(x: number, y: number) {
    let row = Math.floor(y / TILE);
    while (row > 0 && this.isWater(x, (row - 1) * TILE + 4)) row--;
    return row * TILE;
  }

  private currentAt(x: number, y: number) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const c = this.level.currents.find((c) => tx >= c.x0 && tx <= c.x1 && ty >= c.y0 && ty <= c.y1);
    return c ? c.force : 0;
  }

  // ---------- end screens ----------

  private win() {
    if (this.ended) return;
    this.ended = true;
    this.physics.pause();
    this.player.play(`${this.active}_idle`);
    saveStars(this.levelIndex, this.stars);
    this.endScreen('Уровень пройден!', true);
  }

  private gameOver() {
    this.ended = true;
    this.physics.pause();
    const who = { dad: 'папы', mom: 'мамы', girl: 'дочки' }[this.active];
    this.endScreen(`У ${who}\nкончились сердечки`, false);
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
    const hasNext = won && this.levelIndex + 1 < LEVEL_COUNT;
    const main = hasNext ? { text: 'Дальше', go: () => this.scene.restart({ level: this.levelIndex + 1 }) }
      : won ? { text: 'В меню', go: () => this.scene.start('menu') }
        : { text: 'Заново', go: () => this.scene.restart({ level: this.levelIndex }) };
    const button = (y: number, text: string, bg: string, go: () => void) => {
      const btn = this.add.text(GAME_W / 2, y, text, {
        fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color: '#0b1530', backgroundColor: bg, padding: { x: 18, y: 10 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(d).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', go);
    };
    button(430, main.text, '#ffd83a', main.go);
    if (main.text !== 'В меню') button(495, 'Меню', '#cfe3ff', () => this.scene.start('menu'));
    this.keys.ENTER.once('down', main.go);
    this.keys.SPACE.once('down', main.go);
  }

  // ---------- visuals ----------

  private createBackground() {
    const tint = this.level.tint;
    this.add.image(0, 0, 'bg_sky').setOrigin(0).setScrollFactor(0).setTint(tint);
    const layer = (key: string, y: number, h: number, f: number) => {
      const s = this.add.tileSprite(0, y, GAME_W, h, key).setOrigin(0).setScrollFactor(0).setTint(tint);
      this.bg.push({ s, f });
    };
    if (this.textures.get('bg_sea').getSourceImage().height > 200) {
      // Painted art: 384px tall layers.
      layer('bg_mountains', -25, 384, 0.12);
      // Coast strip: horizon at 216px from its top, kept at screen y 306.
      const seaH = this.textures.get('bg_sea').getSourceImage().height;
      layer('bg_sea', 90, seaH, 0.25);
      this.add.rectangle(0, 90 + seaH - 2, GAME_W, GAME_H, mulColor(0x129be9, tint)).setOrigin(0).setScrollFactor(0);
      if (this.textures.exists('bg_trees')) {
        // The strip is trees standing on a thin band of shore (TREE_BASE px from its bottom).
        const h = this.textures.get('bg_trees').getSourceImage().height, TREE_BASE = 8;
        layer('bg_trees', 432 - (h - TREE_BASE), h, 0.5);
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
    const menu = this.add.text(GAME_W - 67, 122, `Ур. ${this.levelIndex + 1}  ☰`, {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#14234ae6', padding: { x: 8, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 1).setInteractive({ useHandCursor: true });
    menu.on('pointerdown', () => this.scene.start('menu'));
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

  private puff(x: number, y: number, scale = 1, color = 0xffffff) {
    const c = this.add.circle(x, y, 18 * scale, color, 0.8).setDepth(20);
    this.tweens.add({ targets: c, scale: 2, alpha: 0, duration: 300, onComplete: () => c.destroy() });
  }

  private bubble(x: number, y: number) {
    const c = this.add.circle(x + Phaser.Math.Between(-4, 4), y, Phaser.Math.Between(2, 4), 0xd8f3ff, 0.8).setDepth(9);
    this.tweens.add({ targets: c, y: y - Phaser.Math.Between(20, 40), alpha: 0, duration: 600, onComplete: () => c.destroy() });
  }

  private splash(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const c = this.add.circle(x, y, 3, 0xbfe8ff).setDepth(20);
      this.tweens.add({ targets: c, x: x + Phaser.Math.Between(-24, 24), y: y - Phaser.Math.Between(10, 40), alpha: 0, duration: 400, onComplete: () => c.destroy() });
    }
  }
}
