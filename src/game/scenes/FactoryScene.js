import Phaser from 'phaser';
import { EMPLOYEE_MAP, LINES, THEMES } from '../../data/content.js';
import { ROOMS } from '../../data/growth.js';
import { getLineStats } from '../../utils/economy.js';
import { formatMoney } from '../../utils/formatter.js';
import { bottleneckFix, materialCap, roomForLine, truckInterval } from '../../utils/growth.js';
import { getLevelInfo } from '../../utils/progression.js';
import { factoryBridge } from './bridge.js';
import { FINISH_ANCHORS, MACHINE_H, MACHINE_W, PRESS_ANCHORS, finisherRoomIndex, paintAll } from './art.js';

const FONT = 'Inter, Segoe UI, sans-serif';
const WALL_H = 110;
const DEPT_H = 30;
const LOCK_H = 104;
const DOCK_H = 180;

const STATUS_COLORS = { ok: 0x3ddc84, warn: 0xffc400, bad: 0xff5a4f, hold: 0x5ac8fa };
const CALM_TONES = new Set(['ok', 'hold']);
const STATUS_SETTLE_MS = 500;

function floorStatus(stats) {
  return { ...floorLook(stats), bottleneck: stats.bottleneck };
}

function floorLook(stats) {
  switch (stats.bottleneck) {
    case 'Crate full': return { key: 'bad', text: 'CRATE FULL', spot: 'crate', tag: 'CRATE FULL', bg: '#ff5a4f', fg: '#ffffff' };
    case 'Needs service': return { key: 'warn', text: 'NEEDS SERVICE', spot: 'press', tag: 'NEEDS SERVICE', bg: '#ff5a4f', fg: '#ffffff' };
    case 'Need raw': return { key: 'warn', text: 'NO RAW', spot: 'press', tag: 'NO RAW', bg: '#ffc400', fg: '#1a1a1a' };
    case 'Intake slow': return { key: 'warn', text: 'INTAKE SLOW', spot: 'press', tag: 'INTAKE SLOW', bg: '#ffc400', fg: '#1a1a1a' };
    case 'Stocking order': return { key: 'hold', text: 'STOCKING ORDER', spot: 'crate', tag: `STOCKING ${stats.held}/${stats.reserved}`, bg: '#5ac8fa', fg: '#0d1a22' };
    case 'Forming': return { key: 'ok', text: 'FORMING', spot: null };
    default: return { key: 'ok', text: stats.autoSell ? 'AUTO SELL' : 'RUNNING', spot: null };
  }
}

function hexNum(color) {
  return Number.parseInt(String(color).replace('#', ''), 16);
}

function label(scene, value, size, color, bold = true) {
  return scene.add.text(0, 0, value, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? 'bold' : 'normal',
    resolution: scene.res || 1,
  });
}

function hazardBand(g, x, y, w, h) {
  g.fillStyle(0x161616, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(0xffc400, 1);
  const step = h * 2.2;
  for (let i = x - h; i < x + w; i += step) {
    const a = Math.max(x, i);
    const b = Math.min(x + w, i + step / 2);
    const c = Math.min(x + w, i + step / 2 + h);
    const d = Math.max(x, i + h);
    if (b <= a && c <= d) continue;
    g.fillPoints([
      { x: a, y },
      { x: b, y },
      { x: c, y: y + h },
      { x: d, y: y + h },
    ], true);
  }
}

function machineShare(width) {
  return width < 560 ? 0.265 : 0.215;
}

function label0(scene) {
  return label(scene, 'STORAGE RACKS', 11, '#a0a0a0').setDepth(1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function ease(t) {
  const k = Phaser.Math.Clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
}

function routePoint(route, unit) {
  const u = ((unit % 1) + 1) % 1;
  const from = u < 0.5 ? route.a : route.b;
  const to = u < 0.5 ? route.b : route.c;
  const t = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

export default class FactoryScene extends Phaser.Scene {
  constructor() {
    super('factory');
    this.rows = {};
    this.snapshot = null;
    this.stats = {};
    this.maxScroll = 0;
    this.layoutSig = '';
    this.quality = 'high';
    this.res = 1;
    this.artScale = 1;
    this.pools = {};
    this.truckClock = 0;
    this.dock = null;
  }

  create() {
    this.res = factoryBridge.resolution || 1;
    this.artScale = this.res > 1.25 ? 2 : 1;
    this.floor = this.add.graphics().setDepth(0);
    this.cameras.main.setBackgroundColor('#171717').setOrigin(0, 0).setZoom(this.res);
    try {
      paintAll(this);
    } catch (error) {
      console.error('Mill textures failed', error);
    }
    this.input.on('pointerdown', (pointer) => {
      this.downY = pointer.y;
      this.downScroll = this.cameras.main.scrollY;
      this.dragged = false;
    });
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown || this.downY == null) return;
      const dy = (pointer.y - this.downY) / this.res;
      if (Math.abs(dy) > 12) this.dragged = true;
      if (this.dragged) {
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.downScroll - dy, 0, this.maxScroll);
      }
    });
    this.input.on('pointerup', (pointer) => {
      if (this.dragged) return;
      let hits = [];
      try {
        hits = this.input.hitTestPointer(pointer) || [];
      } catch (error) {
        hits = [];
      }
      const tabZone = hits.find((hit) => hit?.getData?.('tab'));
      if (tabZone) {
        factoryBridge.openTab?.(tabZone.getData('tab'));
        return;
      }
      const lineZone = hits.find((hit) => hit?.getData?.('lineId'));
      if (lineZone) factoryBridge.tap(lineZone.getData('lineId'));
    });
    this.input.on('wheel', (_pointer, _objects, _dx, dy) => {
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + dy * 0.6, 0, this.maxScroll);
    });
    this.scale.on('resize', () => {
      this.layoutSig = '';
      if (this.snapshot) this.layout();
    });
    this.buildStatic();
    factoryBridge.scene = this;
    factoryBridge.ready(this);
  }

  buildStatic() {
    this.lockUi = {
      icon: this.add.image(0, 0, 'lock').setDepth(3).setVisible(false),
      title: label(this, '', 14, '#ffffff').setDepth(3).setVisible(false),
      sub: label(this, '', 12, '#a0a0a0', false).setDepth(3).setVisible(false),
      cta: label(this, '', 11, '#ffc400').setDepth(3).setOrigin(1, 0.5).setVisible(false),
      zone: this.add.zone(0, 0, 10, 10).setDepth(6),
    };
    this.lockUi.zone.disableInteractive();
    const truck = this.add.image(0, 0, 'truck').setOrigin(0, 1).setDepth(4);
    const yardText = label(this, '', 11, '#ffffff').setDepth(4);
    const truckText = label(this, '', 11, '#a0a0a0', false).setDepth(4);
    const dockText = label(this, 'LOADING DOCK', 11, '#ffc400').setDepth(4);
    const forks = [0, 1, 2].map(() => this.add.image(0, 0, 'forklift').setOrigin(0.5, 1).setDepth(4).setVisible(false));
    const fills = [0, 1, 2].map(() => this.add.image(0, 0, 'carton-raw').setOrigin(0.5, 1).setDepth(4).setVisible(false));
    this.dock = { truck, yardText, truckText, dockText, forks, fills, yardSlots: [], y: 0 };
  }

  pool(name, factory, index) {
    if (!this.pools[name]) this.pools[name] = [];
    const list = this.pools[name];
    while (list.length <= index) list.push(factory());
    const item = list[index];
    (Array.isArray(item) ? item : [item]).forEach((part) => part.setVisible(true));
    return item;
  }

  hidePool(name, from) {
    (this.pools[name] || []).slice(from).forEach((item) => {
      (Array.isArray(item) ? item : [item]).forEach((part) => part.setVisible(false));
    });
  }

  sync(snapshot) {
    if (!snapshot || !this.sys) return;
    this.snapshot = snapshot;
    this.quality = snapshot.settings?.quality || 'high';
    this.stats = {};
    for (const def of LINES) {
      if (snapshot.lines[def.id]?.unlocked) this.stats[def.id] = getLineStats(snapshot, def.id);
    }
    this.truckClock = snapshot.materialTimer || 0;
    this.ensureRows();
    const theme = snapshot.shop?.theme || 'dusk';
    const unlocked = LINES.filter((def) => snapshot.lines[def.id]?.unlocked).map((def) => def.id).join(',');
    const locked = this.nextLocked()?.id || '';
    const inset = Math.round(factoryBridge.insetBottom || 0);
    const view = this.viewSize();
    const signature = `${Math.round(view.width)}x${Math.round(view.height)}:${theme}:${unlocked}:${locked}:${inset}:${factoryBridge.edge}:${this.quality}`;
    if (signature !== this.layoutSig) {
      this.layoutSig = signature;
      this.layout();
    }
    this.refreshLabels();
  }

  viewSize() {
    return { width: this.scale.width / this.res, height: this.scale.height / this.res };
  }

  nextLocked() {
    if (!this.snapshot) return null;
    return LINES.find((def) => !this.snapshot.lines[def.id]?.unlocked) || null;
  }

  ensureRows() {
    for (const def of LINES) {
      const on = Boolean(this.snapshot.lines[def.id]?.unlocked);
      if (on && !this.rows[def.id] && this.textures.exists(`press-${def.id}`)) this.buildRow(def);
      const row = this.rows[def.id];
      if (!row) continue;
      row.container.setVisible(on);
      row.zone.setVisible(on);
      if (on) row.zone.setInteractive();
      else {
        row.zone.disableInteractive();
        row.chipZone.disableInteractive();
        row.tagZone.disableInteractive();
      }
    }
  }

  buildRow(def) {
    const index = LINES.indexOf(def);
    const room = roomForLine(def.id);
    const container = this.add.container(0, 0).setDepth(2);
    const chrome = this.add.graphics();
    const chip = this.add.graphics();
    const eyebrow = label(this, `${room.name.toUpperCase()}  ·  LINE ${index + 1}`, 10, def.palette.tag);
    const title = label(this, def.product, 15, '#ffffff');
    const rate = label(this, '', 15, '#ffc400').setOrigin(1, 0);
    const status = label(this, '', 10, '#ffffff').setOrigin(1, 0.5);
    const plaqueA = label(this, 'PRESS', 10, '#a0a0a0').setOrigin(0.5, 0);
    const plaqueB = label(this, 'FINISH', 10, '#a0a0a0').setOrigin(0.5, 0);
    const plaqueC = label(this, 'STORAGE', 10, '#a0a0a0').setOrigin(0.5, 0);
    const beltA = this.add.graphics();
    const beltB = this.add.graphics();
    const items = [0, 1, 2, 3].map(() => this.add.image(0, 0, `product-${def.id}`).setOrigin(0.5, 1));
    const pallet = this.add.image(0, 0, 'pallet').setOrigin(0.5, 1);
    const cartons = [0, 1, 2, 3, 4, 5].map(() => this.add.image(0, 0, `carton-${def.id}`).setOrigin(0.5, 1).setVisible(false));
    const press = this.add.image(0, 0, `press-${def.id}`).setOrigin(0, 0);
    const ram = this.add.image(0, 0, 'ram').setOrigin(0.5, 0);
    const finish = this.add.image(0, 0, `finish-${def.id}`).setOrigin(0, 0);
    const arm = this.add.graphics();
    const beaconA = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD);
    const beaconB = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD);
    const puffs = [0, 1, 2].map(() => this.add.image(0, 0, 'glow').setTint(0x9aa2a7).setAlpha(0));
    const body = this.add.image(0, 0, 'worker').setOrigin(0.5, 1);
    const hand = this.add.image(-6, -48, 'arm').setOrigin(0.5, 0);
    const robot = this.add.image(0, 0, 'robot').setOrigin(0.5, 1).setVisible(false);
    const worker = this.add.container(0, 0, [body, hand, robot]);
    const fullTag = label(this, 'FULL', 10, '#ffffff').setOrigin(0.5).setBackgroundColor('#ff5a4f').setPadding(5, 2, 5, 2).setVisible(false);
    const pressTag = label(this, '', 10, '#ffffff').setOrigin(0.5).setPadding(5, 2, 5, 2).setVisible(false);
    container.add([
      chrome, chip, eyebrow, title, rate, status, plaqueA, plaqueB, plaqueC,
      beltA, beltB, ...items, pallet, ...cartons, worker, press, ram, finish, arm,
      beaconA, beaconB, ...puffs, fullTag, pressTag,
    ]);
    const zone = this.add.zone(0, 0, 10, 10).setDepth(6);
    zone.setData('lineId', def.id);
    const chipZone = this.add.zone(0, 0, 10, 10).setDepth(7);
    const tagZone = this.add.zone(0, 0, 10, 10).setDepth(7);
    chipZone.disableInteractive();
    tagZone.disableInteractive();
    this.rows[def.id] = {
      id: def.id,
      index,
      room,
      container,
      chrome,
      chip,
      eyebrow,
      title,
      rate,
      status,
      statusKey: '',
      plaqueA,
      plaqueB,
      plaqueC,
      beltA,
      beltB,
      beltMeta: [],
      items,
      pallet,
      cartons,
      press,
      ram,
      ramBase: 0,
      finish,
      arm,
      armMeta: null,
      beaconA,
      beaconB,
      puffs,
      body,
      hand,
      robot,
      worker,
      workerBase: 0,
      fullTag,
      pressTag,
      zone,
      chipZone,
      tagZone,
      floor: null,
      floorSeen: '',
      floorSeenAt: 0,
      route: null,
      loopMs: 3200,
      animTime: Math.random() * 2000,
      beltOffset: 0,
      shownProgress: 0,
      phase: Math.random() * Math.PI * 2,
      lastFloat: 0,
      fresh: true,
    };
  }

  layout() {
    const view = this.viewSize();
    const width = Math.max(320, view.width || 360);
    const height = Math.max(220, view.height || 320);
    const theme = THEMES[this.snapshot?.shop?.theme] || THEMES.dusk;
    this.cameras.main.setBackgroundColor(theme.wall);
    const inset = Math.max(0, factoryBridge.insetBottom || 0);
    const visible = LINES.filter((def) => this.rows[def.id] && this.snapshot.lines[def.id]?.unlocked);
    const usable = height - WALL_H - DEPT_H - inset - 24;
    const edge = factoryBridge.edge ?? 74;
    const machineGuess = Phaser.Math.Clamp((width - edge * 2) * machineShare(width), 84, 200);
    const fitH = Math.round(machineGuess * 0.85 + 110);
    const wanted = usable / Math.min(2, Math.max(1, visible.length));
    const rowH = Math.round(Phaser.Math.Clamp(Math.min(wanted, fitH), 178, visible.length <= 1 ? 280 : 250));
    const heads = [];
    let y = WALL_H + 8;
    let lastRoom = null;
    visible.forEach((def) => {
      const row = this.rows[def.id];
      if (row.room.id !== lastRoom) {
        heads.push({ room: row.room, y });
        y += DEPT_H;
        lastRoom = row.room.id;
      }
      row.top = y;
      row.container.setPosition(0, y);
      this.layoutRow(row, width, rowH, edge);
      y += rowH + 8;
    });
    const locked = this.nextLocked();
    this.lockBox = null;
    if (locked) {
      this.lockBox = { def: locked, x: edge - 12, y: y + 4, w: width - edge * 2 + 24, h: LOCK_H - 12 };
      y += LOCK_H;
    }
    this.rackBox = null;
    const floorTop = height - inset - DOCK_H;
    const gap = floorTop - (y + 6);
    if (gap >= 120) {
      const h = Math.min(170, gap - 16);
      this.rackBox = { x: edge - 12, y: y + 4 + (gap - 16 - h) / 2, w: width - edge * 2 + 24, h };
    }
    this.dockTop = Math.max(y + 6, floorTop);
    y = this.dockTop + DOCK_H;
    const contentHeight = Math.max(height, y + inset + 12);
    this.maxScroll = Math.max(0, contentHeight - height);
    this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY || 0, 0, this.maxScroll);
    this.redrawFloor(theme, width, contentHeight, edge, heads);
    this.layoutLock(width, edge);
    this.layoutDock(width, edge);
  }

  layoutRow(row, width, rowH, edge) {
    const def = LINES[row.index];
    const left = edge;
    const right = width - edge;
    const aw = right - left;
    const narrow = width < 560;
    const baseY = rowH - 30;
    const headerH = 66;
    const mw = Math.round(Phaser.Math.Clamp(Math.min(aw * machineShare(width), (baseY - headerH + 34) / 0.85), 84, 200));
    const mh = Math.round(mw * 0.85);
    const sx = mw / MACHINE_W;
    const sy = mh / MACHINE_H;
    const workerSlot = Math.round(mw * 0.3);
    const storeW = Math.round(mw * 0.72);
    const free = Math.max(0, aw - workerSlot - mw * 2 - storeW);
    const pressX = left + workerSlot;
    const finX = Math.round(pressX + mw + free / 2);
    const storeX = Math.round(finX + mw + free / 2);
    const machineY = baseY - mh;

    const g = row.chrome;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(left - 10, 12, aw + 24, rowH - 14, 10);
    g.fillStyle(0x222426, 1);
    g.fillRoundedRect(left - 12, 6, aw + 24, rowH - 14, 10);
    g.lineStyle(1, 0x34373a, 1);
    g.strokeRoundedRect(left - 12, 6, aw + 24, rowH - 14, 10);
    g.lineStyle(1, 0x2a2c2f, 1);
    for (let gx = left + 30; gx < right; gx += 60) g.lineBetween(gx, headerH, gx, rowH - 20);
    g.fillStyle(hexNum(def.palette.tag), 1);
    g.fillRect(left - 12, 18, 3, rowH - 40);
    hazardBand(g, left - 4, rowH - 16, aw + 8, 5);
    g.fillStyle(0x3a3d40, 1);
    [[left - 4, 12], [right + 4, 12], [left - 4, rowH - 22], [right + 4, rowH - 22]].forEach(([bx, by]) => g.fillCircle(bx, by, 2));

    row.title.setFontSize(narrow ? 13 : 15);
    row.eyebrow.setFontSize(narrow ? 9 : 10);
    row.eyebrow.setPosition(left + 10, 16);
    row.title.setPosition(left + 10, 30);
    const panelW = Math.max(row.eyebrow.width, row.title.width) + 22;
    g.fillStyle(0x161718, 0.95);
    g.fillRoundedRect(left, 12, panelW, 40, 6);
    g.fillStyle(hexNum(def.palette.tag), 1);
    g.fillRect(left, 18, 3, 28);
    g.lineStyle(1, 0x2f3134, 1);
    g.strokeRoundedRect(left, 12, panelW, 40, 6);

    row.rateX = right;
    row.rate.setFontSize(narrow ? 13 : 15);
    row.rate.setPosition(right - 10, 15);
    row.chipY = 44;
    row.statusKey = '';

    const plaqueY = baseY + 4;
    row.plaqueA.setPosition(pressX + mw / 2, plaqueY);
    row.plaqueB.setPosition(finX + mw / 2, plaqueY);
    row.plaqueC.setPosition(storeX + storeW / 2, plaqueY);
    [row.plaqueA, row.plaqueB].forEach((plaque) => {
      g.fillStyle(0x161718, 0.9);
      g.fillRoundedRect(plaque.x - plaque.width / 2 - 6, plaqueY - 2, plaque.width + 12, 16, 4);
    });
    row.plaqueBg = { y: plaqueY - 2 };

    this.tweens.killTweensOf(row.press);
    row.pressY = machineY;
    row.press.setPosition(pressX, machineY).setDisplaySize(mw, mh);
    row.finish.setPosition(finX, machineY).setDisplaySize(mw, mh);
    const pa = PRESS_ANCHORS[row.index % PRESS_ANCHORS.length];
    const fa = FINISH_ANCHORS[finisherRoomIndex(row.id) % FINISH_ANCHORS.length];
    row.ramBase = machineY + pa.ram.y * sy;
    row.ram.setPosition(pressX + pa.ram.x * sx, row.ramBase).setScale(sx * 1.1);
    row.beaconA.setPosition(pressX + pa.beacon.x * sx, machineY + pa.beacon.y * sy).setScale(sx * 0.5);
    row.beaconB.setPosition(finX + fa.beacon.x * sx, machineY + fa.beacon.y * sy).setScale(sx * 0.42);
    row.puffBase = { x: pressX + pa.ram.x * sx, y: machineY + pa.ram.y * sy - 10 * sy };

    const sh = Math.max(8, Math.round(mh * 0.12));
    const fh = Math.max(5, Math.round(mh * 0.07));
    const beltY = Math.round(machineY + mh * 0.6);
    const legH = Math.max(4, baseY - 6 - (beltY + sh + fh));
    const beltAX = pressX + mw * 0.7;
    const beltAW = finX + mw * 0.3 - beltAX;
    const beltBX = finX + mw * 0.7;
    const beltBW = storeX + storeW * 0.25 - beltBX;
    row.beltA.setPosition(beltAX, beltY);
    row.beltB.setPosition(beltBX, beltY);
    row.beltMeta = [
      { g: row.beltA, w: beltAW, sh, fh, legH },
      { g: row.beltB, w: beltBW, sh, fh, legH },
    ];
    row.beltMeta.forEach((belt) => this.paintBelt(belt, 0));

    const itemY = beltY + sh * 0.7;
    row.route = {
      a: { x: pressX + mw * 0.55, y: itemY },
      b: { x: finX + mw * 0.5, y: itemY },
      c: { x: storeX + storeW * 0.42, y: itemY },
    };
    row.items.forEach((item) => item.setScale(Phaser.Math.Clamp(mw / 150, 0.6, 1.2)));

    row.armMeta = {
      x: finX + fa.arm.x * sx,
      y: machineY + fa.arm.y * sy,
      s: mw / 180,
    };

    const palletScale = storeW / 120;
    row.pallet.setPosition(storeX + storeW / 2, baseY - 2).setScale(palletScale);
    const cw = storeW * 0.36;
    const cs = cw / 46;
    const slots = [
      [-0.27, 0], [0.02, 0.1], [0.27, -0.02],
      [-0.14, -0.62], [0.14, -0.55], [0, -1.15],
    ];
    row.cartons.forEach((carton, i) => {
      const [ox, oy] = slots[i];
      this.tweens.killTweensOf(carton);
      carton.setScale(cs).setPosition(storeX + storeW / 2 + ox * storeW, baseY - 14 * palletScale + oy * cw * 0.9);
      carton.setData('baseY', carton.y);
    });
    this.tweens.killTweensOf(row.pallet);
    row.pallet.setData('baseY', baseY - 2);
    row.fullTag.setPosition(storeX + storeW / 2, baseY - 14 * palletScale - cw * 2.1 - 8);
    row.pressTag.setPosition(pressX + mw / 2, machineY + mh * 0.24);
    row.floorSeen = '';
    row.floor = null;

    const ws = Phaser.Math.Clamp(mh / 130, 0.7, 1.3);
    row.worker.setScale(ws);
    row.workerBase = baseY - 2;
    row.worker.setPosition(left + workerSlot * 0.48, row.workerBase);

    row.zone.setPosition(pressX + mw / 2, row.top + machineY + mh / 2);
    row.zone.setSize(mw, mh);
    row.zone.setInteractive();

    const conveyor = this.snapshot.lines[row.id].conveyor || 0;
    row.loopMs = Math.max(1400, 3400 - conveyor * 90);
  }

  paintBelt(belt, offset) {
    const { g, w, sh, fh, legH } = belt;
    g.clear();
    if (w <= 4) return;
    g.fillStyle(0x2a2c2e, 1);
    [6, w / 2 - 2, w - 10].forEach((x) => g.fillRect(x, sh + fh, 4, legH));
    g.fillStyle(0x000000, 0.3);
    g.fillRect(2, sh + fh + legH, w - 4, 3);
    g.fillStyle(0x8f979c, 1);
    g.fillRect(0, sh, w, fh);
    g.fillStyle(0x5c656b, 1);
    g.fillRect(0, sh + fh - 2, w, 2);
    g.fillStyle(0x2a2c2e, 1);
    const rollerStep = 16;
    for (let x = 8; x < w - 4; x += rollerStep) g.fillCircle(x, sh + fh / 2, Math.max(1.5, fh * 0.28));
    g.fillStyle(0x1c1d1f, 1);
    g.fillRect(0, 0, w, sh);
    g.fillStyle(0x34373a, 1);
    const step = 14;
    const start = -(offset % step);
    for (let x = start; x < w; x += step) {
      const a = Math.max(0, x);
      const b = Math.min(w, x + 3);
      if (b > a) g.fillRect(a, 2, b - a, sh - 4);
    }
    g.fillStyle(0xc5ccd0, 1);
    g.fillRect(0, -2, w, 2);
    g.fillStyle(0xffc400, 1);
    g.fillRect(0, sh - 1, w, 2);
  }

  redrawFloor(theme, width, height, edge, heads) {
    const g = this.floor;
    g.clear();
    this.themeWall = theme.wall;
    g.fillStyle(theme.wall, 1);
    g.fillRect(0, 0, width, height);
    const hw = 36;
    const hh = 18;
    const rows = Math.ceil((height - WALL_H) / hh) + 2;
    const cols = Math.ceil(width / (hw * 2)) + 2;
    for (let row = 0; row < rows; row += 1) {
      for (let col = -1; col < cols; col += 1) {
        const cx = col * hw * 2 + (row % 2 ? hw : 0);
        const cy = WALL_H + row * hh;
        g.fillStyle(((col + row) % 2 === 0) ? theme.floor : theme.floorAlt, 1);
        g.fillPoints([
          { x: cx, y: cy - hh },
          { x: cx + hw, y: cy },
          { x: cx, y: cy + hh },
          { x: cx - hw, y: cy },
        ], true);
      }
    }
    g.lineStyle(2, 0xffc400, 0.28);
    for (let y = WALL_H + 20; y < height; y += 28) {
      g.lineBetween(edge - 26, y, edge - 26, y + 14);
      g.lineBetween(width - edge + 26, y, width - edge + 26, y + 14);
    }
    this.drawWall(g, width);
    heads.forEach((head, index) => this.drawDeptHead(g, head, index, width, edge));
    this.hidePool('dept', heads.length);
    if (this.lockBox) this.drawLockBay(g, this.lockBox);
    this.drawRacks(g, this.rackBox);
    this.drawDock(g, width, edge);
  }

  drawWall(g, width) {
    g.fillStyle(0x1b1c1e, 1);
    g.fillRect(0, 0, width, WALL_H);
    for (let x = 0, i = 0; x < width; x += 96, i += 1) {
      g.fillStyle(i % 2 ? 0x1f2123 : 0x222427, 1);
      g.fillRect(x + 1, 10, 94, WALL_H - 32);
      g.fillStyle(0x151617, 1);
      g.fillRect(x, 10, 1, WALL_H - 32);
    }
    g.fillStyle(0x2a2c2e, 1);
    g.fillRect(0, 0, width, 10);
    g.fillStyle(0x5c656b, 1);
    g.fillRect(0, 18, width, 11);
    g.fillStyle(0x9aa2a7, 1);
    g.fillRect(0, 19, width, 2);
    g.fillStyle(0x3a3d40, 1);
    g.fillRect(0, 27, width, 2);
    g.fillStyle(0xc79500, 1);
    g.fillRect(0, 36, width, 7);
    g.fillStyle(0xffd23a, 1);
    g.fillRect(0, 37, width, 2);
    for (let x = 60; x < width; x += 150) {
      g.fillStyle(0x34373a, 1);
      g.fillRect(x, 15, 7, 17);
      g.fillRect(x + 40, 34, 5, 11);
    }
    for (let x = 140; x < width; x += 420) {
      g.fillStyle(0x7a1f18, 1);
      g.fillRect(x - 1, 30, 3, 10);
      g.fillStyle(0xd94a3d, 1);
      g.fillCircle(x, 30, 6);
      g.fillStyle(0xff7a6e, 1);
      g.fillCircle(x - 2, 28, 2);
    }
    const railTop = WALL_H - 28;
    g.fillStyle(0xffc400, 1);
    g.fillRect(0, railTop, width, 3);
    g.fillRect(0, railTop + 10, width, 2);
    for (let x = 20; x < width; x += 64) g.fillRect(x, railTop, 3, 20);
    hazardBand(g, 0, WALL_H - 8, width, 8);
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, WALL_H, width, 10);

    let fan = 0;
    let box = 0;
    let light = 0;
    const spacing = width < 560 ? 150 : 210;
    for (let x = 70, i = 0; x < width - 20; x += spacing, i += 1) {
      if (i % 2 === 0) {
        const [housing, blades] = this.pool('fan', () => [
          this.add.image(0, 0, 'fan-housing').setDepth(1),
          this.add.image(0, 0, 'fan-blades').setDepth(1),
        ], fan);
        housing.setPosition(x, 62);
        blades.setPosition(x, 62);
        fan += 1;
      } else {
        const [panel, ledA, ledB] = this.pool('elbox', () => [
          this.add.image(0, 0, 'elbox').setDepth(1),
          this.add.image(0, 0, 'glow').setDepth(1).setScale(0.16).setTint(0x3ddc84).setBlendMode(Phaser.BlendModes.ADD),
          this.add.image(0, 0, 'glow').setDepth(1).setScale(0.16).setTint(0xff5a4f).setBlendMode(Phaser.BlendModes.ADD),
        ], box);
        panel.setPosition(x, 60);
        ledA.setPosition(x - 8, 46);
        ledB.setPosition(x + 8, 46);
        box += 1;
      }
    }
    this.hidePool('fan', fan);
    this.hidePool('elbox', box);
    const lightSpacing = width < 560 ? 220 : 320;
    for (let x = lightSpacing / 2; x < width; x += lightSpacing) {
      g.fillStyle(0x3a3d40, 1);
      g.fillRect(x - 26, 2, 52, 6);
      g.fillStyle(0xfff3c4, 1);
      g.fillRect(x - 22, 7, 44, 2);
      if (this.quality !== 'low') {
        const cone = this.pool('cone', () => this.add.image(0, 0, 'cone').setOrigin(0.5, 0).setDepth(7).setBlendMode(Phaser.BlendModes.ADD), light);
        cone.setPosition(x, 8).setAlpha(0.5).setScale(1.1, 1.4);
        light += 1;
      }
    }
    this.hidePool('cone', light);
  }

  drawDeptHead(g, head, index, width, edge) {
    const roomIndex = ROOMS.findIndex((room) => room.id === head.room.id);
    const y = head.y;
    g.fillStyle(0xffc400, 1);
    g.fillRect(edge - 12, y + 8, 4, 14);
    g.lineStyle(1, 0x34373a, 1);
    g.lineBetween(edge, y + 15, width - edge + 12, y + 15);
    const [name, sub] = this.pool('dept', () => [
      label(this, '', 12, '#ffffff').setDepth(1),
      label(this, '', 10, '#a0a0a0').setDepth(1).setOrigin(1, 0),
    ], index);
    name.setText(head.room.name.toUpperCase()).setPosition(edge - 2, y + 7);
    sub.setText(`DEPT 0${roomIndex + 1}  ·  ${String(head.room.department || '').toUpperCase()}`).setPosition(width - edge + 12, y + 8);
    g.fillStyle(this.themeWall ?? 0x171717, 1);
    g.fillRect(name.x - 4, y + 6, name.width + 10, 18);
    g.fillRect(sub.x - sub.width - 8, y + 6, sub.width + 12, 16);
  }

  drawLockBay(g, box) {
    g.fillStyle(0x1c1d1f, 0.85);
    g.fillRoundedRect(box.x, box.y, box.w, box.h, 10);
    g.lineStyle(2, 0x4a4d50, 1);
    const dash = 12;
    const edges = [
      [box.x, box.y, box.x + box.w, box.y],
      [box.x + box.w, box.y, box.x + box.w, box.y + box.h],
      [box.x + box.w, box.y + box.h, box.x, box.y + box.h],
      [box.x, box.y + box.h, box.x, box.y],
    ];
    edges.forEach(([x1, y1, x2, y2]) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = 0; d < len; d += dash * 2) {
        const t1 = d / len;
        const t2 = Math.min(1, (d + dash) / len);
        g.lineBetween(lerp(x1, x2, t1), lerp(y1, y2, t1), lerp(x1, x2, t2), lerp(y1, y2, t2));
      }
    });
  }

  drawRacks(g, box) {
    if (!box) {
      this.hidePool('rack-carton', 0);
      this.hidePool('rack-label', 0);
      return;
    }
    const rackLabel = this.pool('rack-label', () => label0(this), 0);
    rackLabel.setPosition(box.x + 12, box.y);
    const top = box.y + 22;
    const h = box.h - 22;
    const bayW = 150;
    const levels = Math.max(1, Math.min(3, Math.floor(h / 48)));
    const levelH = h / levels;
    const bays = Math.max(1, Math.floor(box.w / bayW));
    const startX = box.x + (box.w - bays * bayW) / 2;
    const unlocked = LINES.filter((def) => this.snapshot.lines[def.id]?.unlocked);
    g.fillStyle(0x000000, 0.28);
    g.fillRect(box.x, top + h - 4, box.w, 8);
    let carton = 0;
    for (let b = 0; b < bays; b += 1) {
      const x = startX + b * bayW;
      for (let l = 0; l < levels; l += 1) {
        const beamY = top + (l + 1) * levelH - 4;
        g.fillStyle(0xff7a1a, 1);
        g.fillRect(x, beamY, bayW, 5);
        g.fillStyle(0xb85510, 1);
        g.fillRect(x, beamY + 4, bayW, 2);
        const slots = (b * 7 + l * 3) % 4 === 0 ? 2 : 3;
        for (let s = 0; s < slots; s += 1) {
          const def = unlocked.length ? unlocked[(b + l + s) % unlocked.length] : null;
          const key = (b + s + l) % 3 === 0 || !def ? 'carton-raw' : `carton-${def.id}`;
          const image = this.pool('rack-carton', () => this.add.image(0, 0, 'carton-raw').setOrigin(0.5, 1).setDepth(1), carton);
          const size = Math.min(1.05, (levelH - 10) / 40);
          image.setTexture(key).setScale(size).setPosition(x + 30 + s * 44, beamY);
          carton += 1;
        }
      }
      g.fillStyle(0x5c656b, 1);
      g.fillRect(x, top, 5, h);
      g.fillRect(x + bayW - 5, top, 5, h);
      g.fillStyle(0x8f979c, 1);
      g.fillRect(x + 1, top, 2, h);
      g.fillRect(x + bayW - 4, top, 2, h);
    }
    this.hidePool('rack-carton', carton);
    hazardBand(g, box.x, top + h + 4, box.w, 4);
  }

  layoutLock(width, edge) {
    const ui = this.lockUi;
    const box = this.lockBox;
    const on = Boolean(box);
    [ui.icon, ui.title, ui.sub, ui.cta].forEach((item) => item.setVisible(on));
    if (!on) {
      ui.zone.disableInteractive();
      return;
    }
    const cy = box.y + box.h / 2;
    ui.icon.setPosition(box.x + 34, cy);
    ui.title.setPosition(box.x + 60, cy - 18);
    ui.sub.setPosition(box.x + 60, cy + 2);
    ui.cta.setPosition(box.x + box.w - 18, cy);
    ui.cta.setVisible(width >= 560);
    ui.zone.setPosition(box.x + box.w / 2, cy).setSize(box.w, box.h);
    ui.zone.setInteractive();
    this.refreshLock();
    void edge;
  }

  refreshLock() {
    const box = this.lockBox;
    if (!box || !this.snapshot) return;
    const def = box.def;
    const room = roomForLine(def.id);
    const level = getLevelInfo(this.snapshot.totalXp).level;
    const roomOpen = Boolean(this.snapshot.rooms?.[room.id]?.owned);
    let sub = `Ready to unlock · ${formatMoney(def.unlockCost)}`;
    let tab = 'upgrades';
    if (!roomOpen) {
      sub = `Open the ${room.name} to make room`;
      tab = 'expansion';
    } else if (level < def.unlockLevel) {
      sub = `Reach level ${def.unlockLevel} to unlock`;
    }
    this.lockUi.title.setText(`NEXT LINE  ·  ${def.product}`);
    this.lockUi.sub.setText(sub);
    this.lockUi.cta.setText(tab === 'expansion' ? 'OPEN EXPANSION  ›' : 'VIEW UPGRADES  ›');
    this.lockUi.zone.setData('tab', tab);
  }

  drawDock(g, width, edge) {
    const y0 = this.dockTop;
    g.fillStyle(0x1e1f21, 1);
    g.fillRect(0, y0, width, DOCK_H);
    hazardBand(g, 0, y0, width, 7);
    g.lineStyle(1, 0x27292b, 1);
    for (let x = 0; x < width; x += 80) g.lineBetween(x, y0 + 7, x, y0 + DOCK_H);
    g.lineBetween(0, y0 + DOCK_H / 2, width, y0 + DOCK_H / 2);
    g.fillStyle(0xffc400, 0.8);
    for (let x = edge; x < width - edge; x += 34) g.fillRect(x, y0 + DOCK_H - 20, 18, 3);
    const yardW = Math.min(260, (width - edge * 2) * 0.36);
    g.lineStyle(2, 0xffc400, 0.6);
    g.strokeRect(edge, y0 + 44, yardW, DOCK_H - 76);
    const bayX = width - edge - Math.min(250, (width - edge * 2) * 0.42);
    g.fillStyle(0x111111, 1);
    for (let i = 0; i < 2; i += 1) g.fillRect(bayX + 10 + i * 120, y0 + 34, 26, 8);
    const ts = Phaser.Math.Clamp((width - edge * 2) / 1000, 0.5, 0.85);
    this.dock.y = y0;
    this.dock.ts = ts;
    this.dock.yard = { x: edge, y: y0 + 44, w: yardW, h: DOCK_H - 76 };
    this.dock.parkX = bayX;
    this.dock.laneY = y0 + DOCK_H - 26;
    this.dock.edge = edge;
    this.dock.width = width;
    [0, 1, 2].forEach((i) => {
      const barrel = this.pool('barrel', () => this.add.image(0, 0, i % 2 ? 'barrel-b' : 'barrel-y').setOrigin(0.5, 1).setDepth(3), i);
      barrel.setPosition(width - edge - 14 - i * 20, y0 + 40 + (i % 2) * 6);
    });
  }

  layoutDock(width) {
    const dock = this.dock;
    const { yard, ts } = dock;
    dock.truck.setScale(ts);
    dock.dockText.setPosition(dock.parkX, dock.y + 14);
    dock.yardText.setPosition(yard.x, dock.y + 16);
    dock.truckText.setPosition(yard.x, dock.y + DOCK_H - 16);
    const palletScale = Math.min(1, yard.w / 3 / 110);
    dock.yardSlots = [0, 1, 2].map((i) => ({
      x: yard.x + yard.w * (0.2 + i * 0.3),
      y: yard.y + yard.h - 10,
      s: palletScale,
    }));
    dock.yardSlots.forEach((slot, i) => {
      const pallet = this.pool('yard-pallet', () => this.add.image(0, 0, 'pallet').setOrigin(0.5, 1).setDepth(3), i);
      pallet.setPosition(slot.x, slot.y).setScale(slot.s * 0.85);
      dock.fills[i].setPosition(slot.x, slot.y - 6 * slot.s).setScale(slot.s * 1.3);
    });
    dock.forks.forEach((fork) => fork.setScale(Phaser.Math.Clamp(ts * 1.05, 0.55, 0.9)));
    void width;
  }

  refreshDock() {
    const dock = this.dock;
    if (!dock || !this.snapshot) return;
    const cap = materialCap(this.snapshot);
    const materials = Math.floor(this.snapshot.materials || 0);
    const fill = cap > 0 ? materials / cap : 0;
    dock.yardText.setText(`RAW YARD  ${materials}/${cap}`);
    const starved = materials <= 0 || Object.values(this.stats || {}).some((stats) => stats.bottleneck === 'Need raw');
    dock.yardText.setColor(materials <= 0 ? '#ff5a4f' : starved ? '#ffc400' : '#ffffff');
    (this.pools['yard-pallet'] || []).forEach((pallet) => {
      if (starved) pallet.setTint(0xffb04a);
      else pallet.clearTint();
    });
    dock.fills.forEach((carton, i) => carton.setVisible(fill > i / 3 + 0.02));
    const forks = Phaser.Math.Clamp(this.snapshot.logistics?.forklifts || 0, 1, 3);
    dock.forks.forEach((fork, i) => fork.setVisible(i < forks));
  }

  refreshLabels() {
    for (const def of LINES) {
      const row = this.rows[def.id];
      const stats = this.stats[def.id];
      const line = this.snapshot.lines[def.id];
      if (!row || !stats || !line?.unlocked) continue;
      row.rate.setText(`${formatMoney(stats.perSec)}/s`);
      const view = this.settleStatus(row, stats);
      const tab = bottleneckFix(this.snapshot, def.id, view.bottleneck);
      const { key } = view;
      const text = tab ? `${view.text}  ›` : view.text;
      row.statusTone = key;
      const signature = `${key}:${text}`;
      if (row.statusKey !== signature) {
        row.statusKey = signature;
        row.status.setText(text);
        const w = row.status.width + 28;
        const x = row.rateX - w;
        row.chip.clear();
        row.chip.fillStyle(0x111213, 0.95);
        row.chip.fillRoundedRect(x, row.chipY - 9, w, 18, 9);
        row.chip.lineStyle(1, STATUS_COLORS[key], 0.6);
        row.chip.strokeRoundedRect(x, row.chipY - 9, w, 18, 9);
        row.chip.fillStyle(STATUS_COLORS[key], 1);
        row.chip.fillCircle(x + 10, row.chipY, 3.5);
        row.status.setPosition(row.rateX - 9, row.chipY);
        row.chipZone.setPosition(x + w / 2, row.top + row.chipY).setSize(w, 28);
      }
      this.setTabZone(row.chipZone, tab);
      row.plaqueC.setText(`STORAGE ${line.inventory}/${stats.capacity}`);
      row.plaqueC.setColor(stats.stalled ? '#ff5a4f' : stats.stocking ? '#5ac8fa' : '#a0a0a0');
      const fill = stats.capacity > 0 ? line.inventory / stats.capacity : 0;
      const shown = line.inventory <= 0 ? 0 : Math.max(1, Math.ceil(fill * row.cartons.length));
      row.cartons.forEach((carton, i) => carton.setVisible(i < shown));
      this.refreshSpotTags(row, view, tab);
      this.refreshCrew(row);
    }
    this.refreshLock();
    this.refreshDock();
  }

  settleStatus(row, stats) {
    const next = floorStatus(stats);
    const now = this.time?.now || 0;
    if (row.floorSeen !== next.text) {
      row.floorSeen = next.text;
      row.floorSeenAt = now;
    }
    const urgent = next.key === 'bad';
    if (!row.floor || urgent || now - row.floorSeenAt >= STATUS_SETTLE_MS || row.floor.text === next.text) {
      row.floor = next;
    }
    return row.floor;
  }

  setTabZone(zone, tab) {
    zone.setData('tab', tab || null);
    if (tab) zone.setInteractive();
    else zone.disableInteractive();
  }

  refreshSpotTags(row, view, tab) {
    const onCrate = view.spot === 'crate';
    const onPress = view.spot === 'press';
    row.fullTag.setVisible(onCrate);
    row.pressTag.setVisible(onPress);
    row.press.clearTint();
    const tag = onCrate ? row.fullTag : onPress ? row.pressTag : null;
    if (!tag) {
      this.setTabZone(row.tagZone, null);
      return;
    }
    if (tag.text !== view.tag) tag.setText(view.tag);
    tag.setBackgroundColor(view.bg).setColor(view.fg);
    if (view.text === 'NEEDS SERVICE') row.press.setTint(0xffb4ac);
    row.tagZone
      .setPosition(tag.x, row.top + tag.y)
      .setSize(Math.max(64, tag.width + 16), Math.max(28, tag.height + 12));
    this.setTabZone(row.tagZone, tab);
  }

  refreshCrew(row) {
    const line = this.snapshot.lines[row.id];
    const assigned = (this.snapshot.employees || []).filter((employee) => employee.assignedLineId === row.id);
    const robotHired = assigned.some((employee) => EMPLOYEE_MAP[employee.templateId]?.portrait.style === 'robot');
    const human = assigned.find((employee) => EMPLOYEE_MAP[employee.templateId]?.portrait.style !== 'robot');
    const onlyRobot = (robotHired || (line.automation || 0) >= 2) && !human;
    row.robot.setVisible(onlyRobot);
    row.body.setVisible(!onlyRobot);
    row.hand.setVisible(!onlyRobot);
  }

  handleEvent(event) {
    if (!this.sys || !this.snapshot) return;
    if (event.type === 'produce' && event.lineId) {
      this.bumpStorage(this.rows[event.lineId]);
      if (event.money > 0) this.floatMoney(event.lineId, event.money);
    }
    if (event.type === 'sell' && event.lineId) this.floatMoney(event.lineId, event.money);
    if (event.type === 'tap' && event.lineId) this.nudge(event.lineId);
    if (event.type === 'upgrade' && event.lineId) this.flash(event.lineId);
    if (event.type === 'repair' && event.lineId) this.flash(event.lineId);
    if (event.type === 'line-unlock' && event.lineId) this.slideIn(event.lineId);
    if (event.type === 'levelup') this.levelUp(event.level);
    if (event.type === 'room' || event.type === 'research' || event.type === 'prestige') this.glowScreen();
  }

  bumpStorage(row) {
    if (!row?.pallet?.active) return;
    const targets = [row.pallet, ...row.cartons.filter((carton) => carton.visible)];
    targets.forEach((target) => {
      this.tweens.killTweensOf(target);
      const baseY = target.getData('baseY') ?? target.y;
      target.setData('baseY', baseY);
      target.y = baseY;
      this.tweens.add({ targets: target, y: baseY - 3, yoyo: true, duration: 90, onComplete: () => target.setY(baseY) });
    });
  }

  floatMoney(lineId, money) {
    const row = this.rows[lineId];
    if (!row?.route || !money) return;
    const now = this.time.now;
    if (now - row.lastFloat < 500) return;
    row.lastFloat = now;
    const text = this.add.text(row.route.c.x, row.container.y + row.route.c.y - 46, `+${formatMoney(money)}`, {
      fontFamily: FONT,
      fontSize: '17px',
      color: '#ffc400',
      fontStyle: 'bold',
      stroke: '#111111',
      strokeThickness: 4,
      resolution: this.res,
    }).setDepth(12).setOrigin(0.5, 1);
    this.tweens.add({
      targets: text,
      y: text.y - 34,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  nudge(lineId) {
    const row = this.rows[lineId];
    if (!row) return;
    this.tweens.killTweensOf(row.press);
    const origin = row.pressY ?? row.press.y;
    row.pressY = origin;
    this.tweens.add({
      targets: row.press,
      y: origin - 5,
      yoyo: true,
      duration: 80,
      onComplete: () => row.press.setY(origin),
    });
    this.sparks(row.container.y + row.ramBase + 20, row.ram.x, 4);
  }

  sparks(y, x, count) {
    if (this.quality === 'low' || factoryBridge.reduceMotion) return;
    for (let i = 0; i < count; i += 1) {
      const spark = this.add.image(x, y, 'glow').setDepth(11).setScale(0.14).setTint(0xffc400).setBlendMode(Phaser.BlendModes.ADD);
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
      const dist = Phaser.Math.Between(16, 38);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: Phaser.Math.Between(260, 420),
        onComplete: () => spark.destroy(),
      });
    }
  }

  flash(lineId) {
    const row = this.rows[lineId];
    if (!row?.route || this.quality === 'low') return;
    const x = row.press.x + row.press.displayWidth / 2;
    const y = row.container.y + row.press.y + row.press.displayHeight / 2;
    const burst = this.add.image(x, y, 'glow').setDepth(9).setTint(0xffc400).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2).setAlpha(0.8);
    this.tweens.add({ targets: burst, alpha: 0, scale: 3, duration: 420, onComplete: () => burst.destroy() });
    this.sparks(y - 10, x, 8);
  }

  slideIn(lineId) {
    const row = this.rows[lineId];
    if (!row) return;
    row.container.setAlpha(0);
    row.container.x = -40;
    this.tweens.add({ targets: row.container, alpha: 1, x: 0, duration: 520, ease: 'Cubic.easeOut' });
    this.time.delayedCall(200, () => this.flash(lineId));
  }

  levelUp(level) {
    if (!level) return;
    const cam = this.viewSize();
    const cx = cam.width / 2;
    const cy = Math.min(cam.height * 0.4, 260);
    const veil = this.add.rectangle(0, 0, cam.width, cam.height, 0xffc400, 0.12).setOrigin(0).setScrollFactor(0).setDepth(20);
    const band = this.add.rectangle(cx, cy, Math.min(cam.width - 40, 420), 64, 0x111213, 0.92).setScrollFactor(0).setDepth(21).setStrokeStyle(2, 0xffc400);
    const title = this.add.text(cx, cy, `LEVEL ${level}`, {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#ffc400',
      fontStyle: 'bold',
      resolution: this.res,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22).setScale(0.6);
    this.tweens.add({ targets: veil, alpha: 0, duration: 700, onComplete: () => veil.destroy() });
    this.tweens.add({ targets: title, scale: 1, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: [band, title],
      alpha: 0,
      delay: 1200,
      duration: 380,
      onComplete: () => {
        band.destroy();
        title.destroy();
      },
    });
  }

  glowScreen() {
    if (this.quality === 'low') return;
    const cam = this.viewSize();
    const veil = this.add.rectangle(0, 0, cam.width, cam.height, 0xffc400, 0.1).setOrigin(0).setScrollFactor(0).setDepth(20);
    this.tweens.add({ targets: veil, alpha: 0, duration: 600, onComplete: () => veil.destroy() });
  }

  update(time, delta) {
    if (!this.snapshot) return;
    const motion = factoryBridge.reduceMotion ? 0.45 : 1;
    try {
      for (const def of LINES) {
        const row = this.rows[def.id];
        const line = this.snapshot.lines[def.id];
        if (!row?.container.visible || !line?.unlocked || !row.route) continue;
        this.animateRow(row, line, time, delta, motion);
      }
      this.animateAmbient(time, delta, motion);
    } catch (error) {
      console.error(error);
    }
  }

  animateRow(row, line, time, delta, motion) {
    const stats = this.stats[row.id];
    const stalled = Boolean(stats?.stalled);
    const tone = row.statusTone || 'ok';
    const pace = stalled ? 0.62 : 1;
    row.animTime += delta * motion * pace;
    row.beltOffset = (row.beltOffset + delta * 0.05 * (1 + (line.conveyor || 0) * 0.15) * Math.max(pace, 0.75) * motion) % 28;
    for (const belt of row.beltMeta) this.paintBelt(belt, row.beltOffset);
    const target = stats?.progress || 0;
    row.shownProgress += (target - row.shownProgress) * Math.min(1, delta / 120);
    const s = row.press.displayWidth / MACHINE_W;
    const slam = stalled ? 0 : (row.shownProgress > 0.72 ? ((row.shownProgress - 0.72) / 0.28) * 16 * s : 0);
    const idle = stalled ? (3 + Math.sin(time / 260 + row.phase) * 2) * s : 0;
    row.ram.y = row.ramBase + slam + idle;

    const n = row.items.length;
    row.items.forEach((item, index) => {
      const unit = ((row.animTime / row.loopMs) + index / n) % 1;
      const point = routePoint(row.route, unit);
      item.setPosition(point.x, point.y);
      item.setAlpha(unit > 0.94 ? (1 - unit) / 0.06 : 1);
    });

    const meta = row.armMeta;
    if (meta) {
      const k = ((row.animTime / row.loopMs) * n + 0.5) % 1;
      const wave = Math.sin(k * Math.PI * 2);
      const shoulder = -1.15 + wave * (stalled ? 0.08 : 0.32);
      const elbow = 1.95 + Math.cos(k * Math.PI * 2) * (stalled ? 0.05 : 0.3);
      const l1 = 30 * meta.s;
      const l2 = 26 * meta.s;
      const p1 = { x: meta.x + Math.cos(shoulder) * l1, y: meta.y + Math.sin(shoulder) * l1 };
      const p2 = { x: p1.x + Math.cos(shoulder + elbow) * l2, y: p1.y + Math.sin(shoulder + elbow) * l2 };
      const g = row.arm;
      g.clear();
      g.fillStyle(0x2a2c2e, 1);
      g.fillRect(meta.x - 9 * meta.s, meta.y - 2 * meta.s, 18 * meta.s, 8 * meta.s);
      g.fillStyle(0xc79500, 1);
      g.fillRect(meta.x - 7 * meta.s, meta.y - 6 * meta.s, 14 * meta.s, 6 * meta.s);
      g.lineStyle(Math.max(3, 7 * meta.s), 0xffc400, 1);
      g.lineBetween(meta.x, meta.y - 4 * meta.s, p1.x, p1.y);
      g.lineStyle(Math.max(2.5, 5.5 * meta.s), 0xe0a800, 1);
      g.lineBetween(p1.x, p1.y, p2.x, p2.y);
      g.fillStyle(0x2a2c2e, 1);
      g.fillCircle(meta.x, meta.y - 4 * meta.s, 4 * meta.s);
      g.fillCircle(p1.x, p1.y, 3.5 * meta.s);
      g.fillStyle(0x9aa2a7, 1);
      const grip = wave > 0.4 ? 2 : 4;
      g.fillRect(p2.x - grip * meta.s - 2 * meta.s, p2.y, 2 * meta.s, 6 * meta.s);
      g.fillRect(p2.x + grip * meta.s, p2.y, 2 * meta.s, 6 * meta.s);
    }

    const beacon = STATUS_COLORS[tone];
    const calm = CALM_TONES.has(tone);
    const blink = calm ? 0.75 + Math.sin(time / 500 + row.phase) * 0.2 : 0.35 + Math.abs(Math.sin(time / 160)) * 0.65;
    row.beaconA.setTint(beacon).setAlpha(blink);
    row.beaconB.setTint(beacon).setAlpha(calm ? 0.7 : blink);

    if (!factoryBridge.reduceMotion) {
      row.worker.y = row.workerBase + Math.sin(time / 260 + row.phase) * (stalled ? 0.6 : 1.4);
      const swing = stalled ? 0.15 : 0.3 + (slam / Math.max(1, 16 * s)) * 0.6;
      row.hand.rotation = Math.sin(time / (stalled ? 340 : 150) + row.phase) * swing;
      if (this.quality !== 'low' && row.puffBase) {
        row.puffs.forEach((puff, index) => {
          const cycle = ((time / 1100) + index / row.puffs.length) % 1;
          puff.setPosition(row.puffBase.x + Math.sin(cycle * 4 + index) * 4, row.puffBase.y - cycle * 34 * s);
          puff.setAlpha((1 - cycle) * (stalled ? 0.12 : 0.28));
          puff.setScale((0.18 + cycle * 0.35) * s * 1.6);
        });
      } else {
        row.puffs.forEach((puff) => puff.setAlpha(0));
      }
    }
    const pulse = calm ? 1 : 1 + Math.abs(Math.sin(time / 240)) * 0.06;
    if (row.fullTag.visible) row.fullTag.setScale(pulse);
    if (row.pressTag.visible) row.pressTag.setScale(pulse);
  }

  animateAmbient(time, delta, motion) {
    (this.pools.fan || []).forEach(([, blades], i) => {
      if (blades.visible) blades.rotation += (delta / 1000) * (3.2 + (i % 3) * 0.6) * motion;
    });
    (this.pools.elbox || []).forEach(([, ledA, ledB], i) => {
      if (!ledA.visible) return;
      ledA.setAlpha(0.5 + Math.abs(Math.sin(time / 600 + i)) * 0.5);
      ledB.setAlpha(Math.sin(time / 230 + i * 2) > 0.6 ? 1 : 0.15);
    });
    const dock = this.dock;
    if (!dock?.yard || !this.snapshot) return;
    const interval = truckInterval(this.snapshot);
    this.truckClock += (delta / 1000) * motion;
    const p = (this.truckClock % interval) / interval;
    const truckW = 240 * dock.ts;
    const off = dock.width + 20;
    let tx = off;
    if (p >= 0.72) tx = lerp(off, dock.parkX, ease((p - 0.72) / 0.28));
    else if (p < 0.22) tx = dock.parkX;
    else if (p < 0.42) tx = lerp(dock.parkX, off, ease((p - 0.22) / 0.2));
    dock.truck.setPosition(tx, dock.y + DOCK_H - 30);
    dock.truck.setVisible(tx < dock.width);
    const left = Math.max(0, Math.ceil((1 - p) * interval));
    dock.truckText.setText(p < 0.22 ? 'TRUCK UNLOADING' : `NEXT TRUCK  ${left}s`);
    const yardEnd = dock.yard.x + dock.yard.w + 30;
    const bayStart = Math.max(yardEnd + 40, dock.parkX - 10);
    dock.forks.forEach((fork, i) => {
      if (!fork.visible) return;
      const period = 5200 + i * 900;
      const cycle = ((time * motion) / period + i * 0.37) % 1;
      const tri = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
      fork.setPosition(lerp(yardEnd, bayStart, ease(tri)), dock.laneY - i * 14);
      fork.setFlipX(cycle >= 0.5);
    });
    void truckW;
  }
}