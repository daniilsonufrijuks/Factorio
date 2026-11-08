import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { Activity, Boxes, Factory, Gauge } from 'lucide-react';
import { LINES, TUTORIAL } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import FactoryScene from '../game/scenes/FactoryScene.js';
import { factoryBridge } from '../game/scenes/bridge.js';
import { getFactoryRates } from '../utils/economy.js';
import { averageCondition, bottleneckFix } from '../utils/growth.js';
import { formatMoney, formatRate } from '../utils/formatter.js';
import { FactoryDocks } from './BottomNavigation.jsx';

const MAX_RESOLUTION = 2.5;

function canvasResolution(quality, dpr) {
  const ratio = Math.max(1, Math.min(dpr || 1, MAX_RESOLUTION));
  if (quality === 'low') return 1;
  if (quality === 'medium') return Math.min(ratio, 1.5);
  return ratio;
}

export default function FactoryView() {
  const hostRef = useRef(null);
  const overviewRef = useRef(null);
  const tapRef = useRef(null);
  const tabRef = useRef(null);
  const { state, registerScene, tap, sellAll, dismissTutorial, setTab } = useGame();
  tapRef.current = tap;
  tabRef.current = setTab;
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  const resolution = canvasResolution(state.settings?.quality, dpr);

  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const update = () => setDpr(window.devicePixelRatio || 1);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [dpr]);

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return undefined;
    factoryBridge.tap = (lineId) => tapRef.current?.(lineId);
    factoryBridge.openTab = (id) => tabRef.current?.(id);
    factoryBridge.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    factoryBridge.ready = (scene) => registerScene(scene);
    factoryBridge.resolution = resolution;
    const phone = window.matchMedia('(max-width: 720px)');
    factoryBridge.edge = phone.matches ? 16 : 74;
    const width = Math.floor(Math.max(320, parent.clientWidth || 640));
    const height = Math.floor(Math.max(220, parent.clientHeight || 360));
    let game;
    const pinStyle = (cssWidth, cssHeight, target = game) => {
      const canvas = target?.canvas;
      if (!canvas) return;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    };
    const fit = () => {
      const nextWidth = Math.floor(parent.clientWidth);
      const nextHeight = Math.floor(parent.clientHeight);
      if (!game || nextWidth < 40 || nextHeight < 40) return;
      factoryBridge.edge = phone.matches ? 16 : 74;
      game.scale.resize(Math.round(nextWidth * resolution), Math.round(nextHeight * resolution));
      pinStyle(nextWidth, nextHeight);
    };
    try {
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent,
        backgroundColor: '#171717',
        banner: false,
        audio: { noAudio: true },
        scale: {
          mode: Phaser.Scale.NONE,
          width: Math.round(width * resolution),
          height: Math.round(height * resolution),
          zoom: 1 / resolution,
        },
        render: { antialias: true, pixelArt: false, roundPixels: false },
        fps: { target: 60 },
        callbacks: { postBoot: (booted) => pinStyle(width, height, booted) },
        scene: FactoryScene,
      });
    } catch (error) {
      console.error(error);
      parent.dataset.failed = 'true';
    }
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    const kick = window.requestAnimationFrame(() => window.requestAnimationFrame(fit));
    document.addEventListener('visibilitychange', fit);
    return () => {
      window.cancelAnimationFrame(kick);
      observer.disconnect();
      document.removeEventListener('visibilitychange', fit);
      factoryBridge.ready = () => {};
      factoryBridge.tap = () => {};
      factoryBridge.openTab = () => {};
      factoryBridge.scene = null;
      registerScene(null);
      game?.destroy(true);
    };
  }, [registerScene, resolution]);

  useEffect(() => {
    const node = overviewRef.current;
    if (!node) return undefined;
    const measure = () => {
      const next = Math.round(node.offsetHeight + 16);
      if (next === factoryBridge.insetBottom) return;
      factoryBridge.insetBottom = next;
      const scene = factoryBridge.scene;
      if (scene?.snapshot) scene.sync(scene.snapshot);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rates = getFactoryRates(state);
  let stockValue = 0;
  let stockCount = 0;
  let freeCount = 0;
  const flagged = { full: [], raw: [], service: [], stocking: [] };
  for (const [lineId, stats] of Object.entries(rates.lines)) {
    stockCount += state.lines[lineId].inventory;
    freeCount += stats.free;
    stockValue += stats.free * stats.price;
    if (stats.bottleneck === 'Crate full') flagged.full.push(lineId);
    else if (stats.bottleneck === 'Need raw') flagged.raw.push(lineId);
    else if (stats.bottleneck === 'Needs service') flagged.service.push(lineId);
    else if (stats.bottleneck === 'Stocking order') flagged.stocking.push(lineId);
  }
  const open = Object.keys(rates.lines).length;
  const efficiency = Math.round(averageCondition(state));
  const dry = (state.materials || 0) <= 0;
  const plural = (count, one, many) => `${count} ${count > 1 ? many : one}`;
  let status = { tone: 'ok', text: 'All lines running', tab: null };
  if (flagged.full.length) {
    status = { tone: 'bad', text: `${plural(flagged.full.length, 'line', 'lines')} full`, tab: bottleneckFix(state, flagged.full[0], 'Crate full') };
  } else if (dry || flagged.raw.length) {
    status = { tone: 'warn', text: 'Raw yard empty', tab: 'logistics' };
  } else if (flagged.service.length) {
    status = { tone: 'warn', text: `${plural(flagged.service.length, 'line needs', 'lines need')} service`, tab: 'robotics' };
  } else if (flagged.stocking.length) {
    status = { tone: 'ok', text: flagged.stocking.length > 1 ? `Stocking ${flagged.stocking.length} lines` : 'Stocking an order', tab: bottleneckFix(state, flagged.stocking[0], 'Stocking order') };
  }
  const StatusTag = status.tab ? 'button' : 'div';
  const tutorial = state.tutorialStep < 3 ? TUTORIAL[state.tutorialStep] : null;

  return (
    <div className="factory-view">
      <div ref={hostRef} className="factory-host" />
      <FactoryDocks />
      {tutorial ? (
        <aside className="tutorial">
          <div>
            <p className="eyebrow">Step {state.tutorialStep + 1} of 3</p>
            <h2>{tutorial.title}</h2>
            <p>{tutorial.body}</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={dismissTutorial}>Got it</button>
        </aside>
      ) : null}
      <section ref={overviewRef} className="overview" aria-label="Production overview">
        <StatusTag
          className={`ov-status tone-${status.tone}`}
          {...(status.tab ? { type: 'button', onClick: () => setTab(status.tab) } : {})}
        >
          <i />
          <div>
            <small>Production</small>
            <strong>{status.text}</strong>
          </div>
        </StatusTag>
        <button type="button" className="ov-stat ov-link" onClick={() => setTab('lines')}>
          <Factory size={15} />
          <div>
            <small>Active lines</small>
            <strong>{open}/{LINES.length}</strong>
          </div>
        </button>
        <div className="ov-stat">
          <Boxes size={15} />
          <div>
            <small>Waiting</small>
            <strong>{stockCount}</strong>
          </div>
        </div>
        <div className="ov-stat">
          <Gauge size={15} />
          <div>
            <small>Output</small>
            <strong>{formatRate(rates.output)}/s</strong>
          </div>
        </div>
        <div className="ov-stat">
          <Activity size={15} />
          <div>
            <small>Efficiency</small>
            <strong className={efficiency < 50 ? 'is-bad' : ''}>{efficiency}%</strong>
          </div>
        </div>
        <button type="button" className={`ov-sell ${freeCount > 0 ? 'is-ready' : ''}`} disabled={freeCount <= 0} onClick={sellAll}>
          <small>{freeCount > 0 ? 'Sell all' : stockCount > 0 ? 'Held for orders' : 'Storage empty'}</small>
          <strong>{freeCount <= 0 && stockCount > 0 ? `${stockCount} units` : formatMoney(stockValue)}</strong>
        </button>
      </section>
    </div>
  );
}
