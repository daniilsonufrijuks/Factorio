import { LINES } from '../../data/content.js';
import { roomForLine } from '../../utils/growth.js';
import { ROOMS } from '../../data/growth.js';

export const MACHINE_W = 200;
export const MACHINE_H = 170;

const STEEL = { top: ['#f1f4f5', '#d7dcdf'], left: ['#d0d5d8', '#a5acb1'], right: ['#959da2', '#6e757a'] };
const DARK = { top: ['#55595c', '#45484b'], left: ['#3a3d40', '#2a2c2e'], right: ['#2a2c2e', '#1c1d1f'] };
const YEL = { top: ['#ffe066', '#ffd23a'], left: ['#ffc400', '#dca600'], right: ['#c79500', '#977000'] };
const WHITE = { top: ['#ffffff', '#eef1f2'], left: ['#e7ebed', '#c6ccd0'], right: ['#b6bdc1', '#929a9f'] };
const CARD = { top: ['#dcae6f', '#c9944f'], left: ['#b9844b', '#9a6a37'], right: ['#8e6133', '#704b25'] };
const WOOD = { top: ['#b98a55', '#a37744'], left: ['#8d653a', '#74512d'], right: ['#6d4c2a', '#553a20'] };

export function paintCanvas(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, width, height);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, width, height);
  draw(ctx, width, height);
  texture.refresh();
}

function face(ctx, points, c1, c2, x1, y1, x2, y2) {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(1, c2);
  ctx.beginPath();
  points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

export function box(ctx, cx, cy, hw, hd, h, m) {
  const top = [[cx, cy - h - hd], [cx + hw, cy - h], [cx, cy - h + hd], [cx - hw, cy - h]];
  const left = [[cx - hw, cy - h], [cx, cy - h + hd], [cx, cy + hd], [cx - hw, cy]];
  const right = [[cx + hw, cy - h], [cx, cy - h + hd], [cx, cy + hd], [cx + hw, cy]];
  face(ctx, left, m.left[0], m.left[1], cx - hw, cy - h, cx - hw, cy + hd);
  face(ctx, right, m.right[0], m.right[1], cx + hw, cy - h, cx + hw, cy + hd);
  face(ctx, top, m.top[0], m.top[1], cx - hw, cy - h, cx + hw, cy - h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy - h);
  ctx.lineTo(cx, cy - h + hd);
  ctx.lineTo(cx + hw, cy - h);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h + hd);
  ctx.lineTo(cx, cy + hd);
  ctx.stroke();
}

function onLeft(ctx, cx, cy, hw, hd, h, draw) {
  ctx.save();
  ctx.transform(hw / 100, hd / 100, 0, h / 100, cx - hw, cy - h);
  draw(ctx);
  ctx.restore();
}

function onRight(ctx, cx, cy, hw, hd, h, draw) {
  ctx.save();
  ctx.transform(hw / 100, -hd / 100, 0, h / 100, cx, cy - h + hd);
  draw(ctx);
  ctx.restore();
}

function onTop(ctx, cx, cy, hw, hd, h, draw) {
  ctx.save();
  ctx.transform(hw / 100, hd / 100, hw / 100, -hd / 100, cx - hw, cy - h);
  draw(ctx);
  ctx.restore();
}

function hazard(ctx, x, y, w, h, step = 10) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffc400';
  for (let i = -h; i < w + h; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + step / 2, y);
    ctx.lineTo(x + i + step / 2 + h, y + h);
    ctx.lineTo(x + i + h, y + h);
    ctx.fill();
  }
  ctx.restore();
}

function controlPanel(ctx, tag) {
  ctx.fillStyle = '#16181a';
  ctx.fillRect(12, 14, 56, 34);
  ctx.fillStyle = '#0d2a1c';
  ctx.fillRect(16, 18, 30, 22);
  ctx.fillStyle = '#5dffa8';
  ctx.fillRect(19, 30, 5, 8);
  ctx.fillRect(26, 25, 5, 13);
  ctx.fillRect(33, 21, 5, 17);
  ctx.fillStyle = tag;
  ctx.fillRect(40, 27, 4, 11);
  ctx.fillStyle = '#ff4a3d';
  ctx.beginPath();
  ctx.arc(56, 24, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3ddc84';
  ctx.beginPath();
  ctx.arc(56, 36, 4, 0, Math.PI * 2);
  ctx.fill();
}

function vents(ctx, x, y, w, rows) {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  for (let i = 0; i < rows; i += 1) ctx.fillRect(x, y + i * 8, w, 3);
}

function shadow(ctx, cx, cy, rx, ry) {
  const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
  gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.scale(1, ry / rx);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy * (rx / ry), rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function cylinder(ctx, cx, cy, r, ry, h, side, top) {
  const gradient = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  gradient.addColorStop(0, side[0]);
  gradient.addColorStop(0.45, side[1]);
  gradient.addColorStop(1, side[2]);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - h);
  ctx.lineTo(cx - r, cy);
  ctx.ellipse(cx, cy, r, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + r, cy - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(cx, cy - h, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function tagMaterial(tag) {
  return {
    top: [tint(tag, 0.25), tag],
    left: [tag, tint(tag, -0.2)],
    right: [tint(tag, -0.3), tint(tag, -0.48)],
  };
}

export function tint(hex, amount) {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amount >= 0) {
    r += (255 - r) * amount;
    g += (255 - g) * amount;
    b += (255 - b) * amount;
  } else {
    r *= 1 + amount;
    g *= 1 + amount;
    b *= 1 + amount;
  }
  const to = (value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function plinth(ctx) {
  shadow(ctx, 100, 146, 96, 34);
  box(ctx, 100, 140, 82, 40, 8, DARK);
  onLeft(ctx, 100, 140, 82, 40, 8, (c) => hazard(c, 0, 20, 100, 60, 14));
}

export const PRESS_ANCHORS = [
  { ram: { x: 100, y: 52 }, beacon: { x: 64, y: 38 }, out: { x: 146, y: 112 } },
  { ram: { x: 128, y: 62 }, beacon: { x: 70, y: 70 }, out: { x: 150, y: 114 } },
  { ram: { x: 84, y: 80 }, beacon: { x: 100, y: 22 }, out: { x: 146, y: 112 } },
  { ram: { x: 96, y: 58 }, beacon: { x: 132, y: 36 }, out: { x: 148, y: 112 } },
  { ram: { x: 112, y: 70 }, beacon: { x: 82, y: 46 }, out: { x: 150, y: 114 } },
  { ram: { x: 100, y: 64 }, beacon: { x: 140, y: 52 }, out: { x: 150, y: 116 } },
  { ram: { x: 100, y: 66 }, beacon: { x: 132, y: 62 }, out: { x: 146, y: 112 } },
];

export const FINISH_ANCHORS = [
  { arm: { x: 132, y: 88 }, beacon: { x: 70, y: 82 } },
  { arm: { x: 136, y: 78 }, beacon: { x: 72, y: 72 } },
  { arm: { x: 134, y: 84 }, beacon: { x: 70, y: 76 } },
  { arm: { x: 132, y: 80 }, beacon: { x: 70, y: 74 } },
];

function drawPress(ctx, index, tag) {
  plinth(ctx);
  if (index === 0) {
    box(ctx, 100, 130, 58, 28, 40, STEEL);
    onRight(ctx, 100, 130, 58, 28, 40, (c) => controlPanel(c, tag));
    onLeft(ctx, 100, 130, 58, 28, 40, (c) => vents(c, 18, 20, 60, 5));
    box(ctx, 66, 92, 7, 4, 54, YEL);
    box(ctx, 134, 92, 7, 4, 54, YEL);
    box(ctx, 100, 44, 44, 9, 8, YEL);
    ctx.fillStyle = '#2a2c2e';
    ctx.beginPath();
    ctx.moveTo(110, 30);
    ctx.lineTo(136, 30);
    ctx.lineTo(128, 46);
    ctx.lineTo(118, 46);
    ctx.fill();
    ctx.fillStyle = tag;
    ctx.fillRect(110, 28, 26, 4);
  } else if (index === 1) {
    box(ctx, 100, 128, 68, 28, 32, STEEL);
    onRight(ctx, 100, 128, 68, 28, 32, (c) => controlPanel(c, tag));
    cylinder(ctx, 74, 92, 13, 6, 24, [tint(tag, -0.3), tag, tint(tag, -0.4)], tint(tag, 0.3));
    cylinder(ctx, 102, 82, 13, 6, 24, [tint(tag, -0.3), tag, tint(tag, -0.4)], tint(tag, 0.3));
    box(ctx, 130, 92, 9, 6, 34, YEL);
    box(ctx, 128, 58, 22, 6, 6, YEL);
  } else if (index === 2) {
    box(ctx, 100, 128, 52, 28, 70, STEEL);
    onLeft(ctx, 100, 128, 52, 28, 70, (c) => {
      const glass = c.createLinearGradient(0, 10, 0, 80);
      glass.addColorStop(0, '#2c4a5e');
      glass.addColorStop(1, '#0f1c26');
      c.fillStyle = glass;
      c.fillRect(14, 12, 72, 58);
      c.fillStyle = 'rgba(180,230,255,0.25)';
      c.fillRect(18, 14, 18, 54);
      hazard(c, 0, 80, 100, 12, 12);
    });
    onRight(ctx, 100, 128, 52, 28, 70, (c) => controlPanel(c, tag));
    box(ctx, 100, 58, 30, 14, 4, YEL);
  } else if (index === 3) {
    box(ctx, 100, 128, 58, 30, 44, DARK);
    onLeft(ctx, 100, 128, 58, 30, 44, (c) => {
      const fire = c.createRadialGradient(50, 55, 4, 50, 55, 40);
      fire.addColorStop(0, '#ffe08a');
      fire.addColorStop(0.4, '#ff7a1a');
      fire.addColorStop(1, '#3a1406');
      c.fillStyle = fire;
      c.fillRect(22, 30, 56, 40);
    });
    onRight(ctx, 100, 128, 58, 30, 44, (c) => controlPanel(c, tag));
    cylinder(ctx, 126, 78, 9, 4, 44, ['#2a2c2e', '#4a4e52', '#1c1d1f'], '#111');
    box(ctx, 70, 100, 4, 3, 28, YEL);
    box(ctx, 100, 112, 4, 3, 28, YEL);
  } else if (index === 4) {
    box(ctx, 100, 128, 64, 26, 34, STEEL);
    onRight(ctx, 100, 128, 64, 26, 34, (c) => controlPanel(c, tag));
    onLeft(ctx, 100, 128, 64, 26, 34, (c) => vents(c, 14, 24, 70, 4));
    ctx.fillStyle = '#ffc400';
    ctx.beginPath();
    ctx.moveTo(70, 52);
    ctx.lineTo(100, 52);
    ctx.lineTo(92, 82);
    ctx.lineTo(78, 82);
    ctx.fill();
    ctx.fillStyle = '#c79500';
    ctx.fillRect(78, 82, 14, 10);
    cylinder(ctx, 122, 92, 10, 5, 14, ['#6e757a', '#c5ccd0', '#5c656b'], '#e4e7e8');
  } else if (index === 5) {
    box(ctx, 100, 132, 68, 32, 22, STEEL);
    onRight(ctx, 100, 132, 68, 32, 22, (c) => controlPanel(c, tag));
    onTop(ctx, 100, 132, 68, 32, 22, (c) => {
      c.fillStyle = '#0f3d2a';
      c.fillRect(24, 24, 52, 52);
      c.fillStyle = tag;
      for (let i = 0; i < 4; i += 1) c.fillRect(30 + i * 12, 30, 4, 40);
    });
    box(ctx, 62, 110, 5, 4, 46, YEL);
    box(ctx, 138, 110, 5, 4, 46, YEL);
    box(ctx, 100, 66, 42, 8, 6, YEL);
  } else {
    box(ctx, 100, 128, 56, 28, 40, WHITE);
    onRight(ctx, 100, 128, 56, 28, 40, (c) => {
      c.fillStyle = tag;
      c.fillRect(40, 20, 20, 60);
      c.fillRect(20, 40, 60, 20);
    });
    onLeft(ctx, 100, 128, 56, 28, 40, (c) => vents(c, 16, 24, 64, 5));
    ctx.fillStyle = 'rgba(190,235,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(100, 84, 40, 26, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawFinisher(ctx, room, tag) {
  plinth(ctx);
  if (room === 0) {
    box(ctx, 100, 130, 66, 30, 26, STEEL);
    onRight(ctx, 100, 130, 66, 30, 26, (c) => controlPanel(c, tag));
    onTop(ctx, 100, 130, 66, 30, 26, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(10, 30, 80, 40);
      c.fillStyle = tag;
      c.fillRect(10, 46, 80, 6);
    });
    box(ctx, 70, 98, 4, 3, 26, YEL);
  } else if (room === 1) {
    box(ctx, 100, 128, 62, 28, 42, STEEL);
    onLeft(ctx, 100, 128, 62, 28, 42, (c) => {
      c.fillStyle = '#0d0e0f';
      c.fillRect(20, 30, 60, 70);
      c.fillStyle = tag;
      c.fillRect(20, 26, 60, 4);
    });
    onRight(ctx, 100, 128, 62, 28, 42, (c) => controlPanel(c, tag));
    box(ctx, 100, 86, 34, 10, 4, YEL);
  } else if (room === 2) {
    box(ctx, 100, 128, 60, 30, 34, STEEL);
    onRight(ctx, 100, 128, 60, 30, 34, (c) => controlPanel(c, tag));
    for (let i = 0; i < 3; i += 1) box(ctx, 84, 94 - i * 5, 18, 10, 4, CARD);
    hazardOnBox(ctx, 100, 128, 60, 30, 34);
  } else {
    box(ctx, 100, 128, 58, 28, 36, WHITE);
    onRight(ctx, 100, 128, 58, 28, 36, (c) => controlPanel(c, tag));
    ctx.fillStyle = 'rgba(190,235,255,0.3)';
    ctx.fillRect(66, 60, 50, 34);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(66, 60, 50, 34);
  }
}

function hazardOnBox(ctx, cx, cy, hw, hd, h) {
  onLeft(ctx, cx, cy, hw, hd, h, (c) => hazard(c, 0, 82, 100, 18, 14));
}

function drawProduct(ctx, tag) {
  box(ctx, 16, 24, 11, 6, 11, CARD);
  onTop(ctx, 16, 24, 11, 6, 11, (c) => {
    c.fillStyle = tag;
    c.fillRect(40, 0, 20, 100);
  });
}

function drawCarton(ctx, tag) {
  box(ctx, 23, 34, 19, 10, 17, CARD);
  onTop(ctx, 23, 34, 19, 10, 17, (c) => {
    c.fillStyle = tag;
    c.fillRect(42, 0, 16, 100);
  });
  onLeft(ctx, 23, 34, 19, 10, 17, (c) => {
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fillRect(20, 30, 40, 30);
    c.fillStyle = '#222';
    c.fillRect(26, 38, 28, 4);
    c.fillRect(26, 48, 18, 4);
  });
}

function drawWorker(ctx) {
  shadow(ctx, 20, 72, 16, 5);
  ctx.fillStyle = '#23272b';
  ctx.fillRect(12, 50, 7, 20);
  ctx.fillRect(21, 50, 7, 20);
  ctx.fillStyle = '#111';
  ctx.fillRect(11, 68, 9, 4);
  ctx.fillRect(20, 68, 9, 4);
  const vest = ctx.createLinearGradient(8, 0, 32, 0);
  vest.addColorStop(0, '#ff8f2e');
  vest.addColorStop(1, '#d9600c');
  ctx.fillStyle = vest;
  ctx.beginPath();
  ctx.moveTo(9, 26);
  ctx.lineTo(31, 26);
  ctx.lineTo(30, 52);
  ctx.lineTo(10, 52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8edf0';
  ctx.fillRect(10, 38, 20, 3);
  ctx.fillRect(10, 45, 20, 3);
  ctx.fillStyle = '#e8b896';
  ctx.beginPath();
  ctx.arc(20, 18, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffc400';
  ctx.beginPath();
  ctx.ellipse(20, 13, 10, 7, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(9, 12, 22, 3);
}

function drawArm(ctx) {
  ctx.fillStyle = '#d9600c';
  ctx.fillRect(1, 0, 6, 14);
  ctx.fillStyle = '#e8b896';
  ctx.fillRect(1, 14, 6, 6);
}

function drawRobot(ctx) {
  shadow(ctx, 22, 60, 20, 5);
  box(ctx, 22, 56, 18, 9, 14, DARK);
  onLeft(ctx, 22, 56, 18, 9, 14, (c) => hazard(c, 0, 40, 100, 30, 16));
  box(ctx, 22, 40, 8, 4, 18, STEEL);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(22, 20, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5dffa8';
  ctx.fillRect(19, 18, 6, 3);
}

function drawForklift(ctx) {
  shadow(ctx, 46, 66, 42, 7);
  ctx.fillStyle = '#2a2c2e';
  ctx.fillRect(66, 8, 5, 54);
  ctx.fillRect(74, 8, 3, 54);
  ctx.fillStyle = '#9aa2a7';
  ctx.fillRect(70, 56, 24, 4);
  ctx.fillRect(70, 48, 3, 12);
  const body = ctx.createLinearGradient(0, 30, 0, 62);
  body.addColorStop(0, '#ffd23a');
  body.addColorStop(1, '#c79500');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(8, 40);
  ctx.lineTo(62, 40);
  ctx.lineTo(66, 58);
  ctx.lineTo(8, 58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a3d40';
  ctx.fillRect(4, 36, 14, 22);
  ctx.strokeStyle = '#2a2c2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(22, 40);
  ctx.lineTo(24, 12);
  ctx.lineTo(56, 12);
  ctx.lineTo(60, 40);
  ctx.stroke();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(30, 28, 14, 12);
  [[20, 60], [54, 60]].forEach(([x, y]) => {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6e757a';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(38, 8, 6, 4);
}

function drawTruck(ctx) {
  shadow(ctx, 120, 100, 116, 8);
  const trailer = ctx.createLinearGradient(0, 10, 0, 80);
  trailer.addColorStop(0, '#f4f6f7');
  trailer.addColorStop(1, '#c6ccd0');
  ctx.fillStyle = trailer;
  ctx.fillRect(66, 10, 168, 72);
  ctx.fillStyle = '#ffc400';
  ctx.fillRect(66, 62, 168, 8);
  ctx.fillStyle = '#2a2c2e';
  ctx.font = 'bold 13px Inter, Segoe UI, sans-serif';
  ctx.fillText('RIVERTON WORKS', 92, 44);
  ctx.fillStyle = '#9aa2a7';
  ctx.fillRect(66, 82, 168, 6);
  const cab = ctx.createLinearGradient(0, 30, 0, 90);
  cab.addColorStop(0, '#3a3d40');
  cab.addColorStop(1, '#1f2123');
  ctx.fillStyle = cab;
  ctx.beginPath();
  ctx.moveTo(8, 88);
  ctx.lineTo(8, 52);
  ctx.lineTo(20, 30);
  ctx.lineTo(62, 30);
  ctx.lineTo(62, 88);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7fb6d6';
  ctx.beginPath();
  ctx.moveTo(14, 54);
  ctx.lineTo(24, 36);
  ctx.lineTo(44, 36);
  ctx.lineTo(44, 54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffc400';
  ctx.fillRect(8, 72, 54, 4);
  [[30, 92], [140, 92], [210, 92]].forEach(([x, y]) => {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6e757a';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(6, 64, 4, 6);
}

function drawFanHousing(ctx) {
  ctx.fillStyle = '#2a2c2e';
  ctx.beginPath();
  ctx.arc(23, 23, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6e757a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(23, 23, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(23, 23, 17, 0, Math.PI * 2);
  ctx.fill();
}

function drawFanBlades(ctx) {
  ctx.translate(23, 23);
  ctx.fillStyle = '#9aa2a7';
  for (let i = 0; i < 5; i += 1) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -9, 4, 8, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d5d9da';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlow(ctx) {
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
}

function drawCone(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(255,240,200,0.22)');
  gradient.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(92, 0);
  ctx.lineTo(128, 0);
  ctx.lineTo(220, 300);
  ctx.lineTo(0, 300);
  ctx.closePath();
  ctx.fill();
}

function drawElbox(ctx) {
  const body = ctx.createLinearGradient(0, 0, 36, 0);
  body.addColorStop(0, '#8f979c');
  body.addColorStop(1, '#5c656b');
  ctx.fillStyle = body;
  ctx.fillRect(2, 2, 32, 44);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(17, 4, 1, 40);
  ctx.fillStyle = '#ffc400';
  ctx.beginPath();
  ctx.moveTo(10, 30);
  ctx.lineTo(18, 16);
  ctx.lineTo(26, 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(17, 21, 2, 6);
}

function drawBarrel(ctx, color) {
  shadow(ctx, 14, 38, 13, 4);
  cylinder(ctx, 14, 36, 11, 4, 30, [tint(color, -0.35), color, tint(color, -0.5)], tint(color, 0.2));
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(3, 14, 22, 3);
  ctx.fillRect(3, 26, 22, 3);
}

function drawPallet(ctx) {
  box(ctx, 60, 38, 54, 18, 6, WOOD);
  onTop(ctx, 60, 38, 54, 18, 6, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 1; i < 5; i += 1) c.fillRect(i * 20, 0, 3, 100);
  });
}

function drawLock(ctx) {
  ctx.strokeStyle = '#a0a0a0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(13, 12, 7, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(3, 12, 20, 16);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(12, 17, 2, 6);
}

function drawRam(ctx) {
  ctx.fillStyle = '#6e757a';
  ctx.fillRect(8, 0, 6, 26);
  const head = ctx.createLinearGradient(0, 0, 22, 0);
  head.addColorStop(0, '#d0d5d8');
  head.addColorStop(1, '#8f979c');
  ctx.fillStyle = head;
  ctx.fillRect(1, 24, 20, 10);
  ctx.fillStyle = '#ffc400';
  ctx.fillRect(1, 32, 20, 3);
}

export function paintAll(scene) {
  paintCanvas(scene, 'glow', 64, 64, drawGlow);
  paintCanvas(scene, 'cone', 220, 300, drawCone);
  paintCanvas(scene, 'fan-housing', 46, 46, drawFanHousing);
  paintCanvas(scene, 'fan-blades', 46, 46, drawFanBlades);
  paintCanvas(scene, 'elbox', 36, 48, drawElbox);
  paintCanvas(scene, 'barrel-y', 28, 42, (ctx) => drawBarrel(ctx, '#ffc400'));
  paintCanvas(scene, 'barrel-b', 28, 42, (ctx) => drawBarrel(ctx, '#3d6f9e'));
  paintCanvas(scene, 'pallet', 120, 50, drawPallet);
  paintCanvas(scene, 'worker', 40, 76, drawWorker);
  paintCanvas(scene, 'arm', 8, 20, drawArm);
  paintCanvas(scene, 'robot', 44, 64, drawRobot);
  paintCanvas(scene, 'forklift', 96, 72, drawForklift);
  paintCanvas(scene, 'truck', 240, 110, drawTruck);
  paintCanvas(scene, 'lock', 26, 30, drawLock);
  paintCanvas(scene, 'ram', 22, 36, drawRam);
  paintCanvas(scene, 'carton-raw', 46, 46, (ctx) => drawCarton(ctx, '#8e9599'));
  LINES.forEach((def, index) => {
    const tag = def.palette.tag;
    const roomIndex = Math.max(0, ROOMS.findIndex((room) => room.id === roomForLine(def.id).id));
    paintCanvas(scene, `press-${def.id}`, MACHINE_W, MACHINE_H, (ctx) => drawPress(ctx, index, tag));
    paintCanvas(scene, `finish-${def.id}`, MACHINE_W, MACHINE_H, (ctx) => drawFinisher(ctx, roomIndex, tag));
    paintCanvas(scene, `product-${def.id}`, 32, 32, (ctx) => drawProduct(ctx, tag));
    paintCanvas(scene, `carton-${def.id}`, 46, 46, (ctx) => drawCarton(ctx, tag));
  });
}

export function finisherRoomIndex(lineId) {
  return Math.max(0, ROOMS.findIndex((room) => room.id === roomForLine(lineId).id));
}

export { tagMaterial };
