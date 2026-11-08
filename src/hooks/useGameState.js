import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInitialState } from '../game/state.js';
import {
  doAssign,
  doBuyGlobalUpgrade,
  doBuyLineUpgrade,
  doBuyStack,
  doBuyTheme,
  doCollectOffline,
  doCompleteOrder,
  doDismissTutorial,
  doEquipTheme,
  doHire,
  doSellAll,
  doSellLine,
  doSetAutoSell,
  doSettings,
  doSurge,
  doTap,
  doTrain,
  doUnlockLine,
  doWhistle,
  doBuyRoom,
  doBuySlot,
  doResearch,
  doForklifts,
  doTrucks,
  doCrew,
  doPallet,
  doRepair,
  doLoadContract,
  doClaimMission,
  doPrestigeUpgrade,
  doPrestige,
  tick,
} from '../game/engine.js';
import { playSound, setMusicEnabled } from '../utils/audio.js';
import { clearGame, loadGame, sanitize, saveGame } from '../utils/storage.js';
import { useAutoSave } from './useAutoSave.js';

function takeBoot() {
  const loaded = sanitize(loadGame() ?? createInitialState(Date.now()));
  const booted = tick(loaded, Date.now());
  return { state: sanitize(booted.state), events: booted.events || [] };
}

export function useGameState() {
  const bootRef = useRef(null);
  if (!bootRef.current) bootRef.current = takeBoot();
  const [state, setState] = useState(bootRef.current.state);
  const engineRef = useRef(state);
  const sceneRef = useRef(null);
  const queueRef = useRef([]);
  const toastSerial = useRef(1);
  const hiddenRef = useRef(typeof document !== 'undefined' && document.hidden);
  const [toasts, setToasts] = useState([]);
  const [offlineOpen, setOfflineOpen] = useState(() => Boolean(bootRef.current.state.pendingOffline));
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('factory');
  const [focusLine, setFocusLine] = useState(null);

  const pushToast = useCallback((toast) => {
    const id = toastSerial.current;
    toastSerial.current += 1;
    setToasts((list) => [...list.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  const reactTo = useCallback((event) => {
    const soundOn = engineRef.current?.settings?.sound !== false;
    if ((event.type === 'sell' && event.manual) || event.type === 'surge' || event.type === 'offline-collect') {
      playSound('coin', soundOn);
    } else if (event.type === 'upgrade' || event.type === 'hire') {
      playSound('upgrade', soundOn);
    } else if (event.type === 'order') {
      playSound('order', soundOn);
    } else if (event.type === 'levelup') {
      playSound('level', soundOn);
    } else if (event.type === 'line-unlock' || event.type === 'unlock' || event.type === 'line-available') {
      playSound('unlock', soundOn);
    } else if (event.type === 'deny') {
      playSound('deny', soundOn);
    } else if (event.type === 'tap') {
      playSound('tap', soundOn);
    }

    if (event.type === 'levelup') {
      const extra = event.gained > 1 ? ` · jumped ${event.gained}` : '';
      pushToast({
        tone: 'gold',
        title: `Level ${event.level}`,
        body: `The mill's name is traveling${extra}.`,
      });
    } else if (event.type === 'line-available') {
      pushToast({ tone: 'gold', title: 'New line available', body: event.product });
    } else if (event.type === 'line-unlock') {
      pushToast({ tone: 'mint', title: 'Line open', body: event.message });
    } else if (event.type === 'order') {
      pushToast({ tone: 'mint', title: 'Order delivered', body: event.message });
    } else if (event.type === 'order-expired') {
      pushToast({ tone: 'coral', title: 'Order expired', body: event.title });
    } else if (event.type === 'order-new') {
      pushToast({ tone: 'gold', title: event.orderType === 'timed' ? 'Rush order' : 'Premium order', body: event.title });
    } else if (event.type === 'hire' || event.type === 'upgrade' || event.type === 'unlock') {
      if (event.message) pushToast({ tone: 'mint', title: 'Floor updated', body: event.message });
    } else if (event.type === 'deny' && event.message) {
      pushToast({ tone: 'coral', title: 'Not yet', body: event.message });
    } else if (event.type === 'offline-collect') {
      pushToast({ tone: 'gold', title: 'Night shift collected', body: 'The crates and cash are on the books.' });
    } else if (event.type === 'maintenance') {
      pushToast({ tone: 'coral', title: 'Maintenance', body: event.message });
    } else if (event.type === 'research' || event.type === 'room' || event.type === 'mission' || event.type === 'contract' || event.type === 'achievement' || event.type === 'prestige') {
      pushToast({ tone: 'gold', title: event.type === 'achievement' ? 'Achievement' : 'Floor updated', body: event.message });
    }
  }, [pushToast]);

  const applyResult = useCallback((result) => {
    if (!result?.state) return;
    const safe = sanitize(result.state);
    engineRef.current = safe;
    setState(safe);
    setOfflineOpen(Boolean(safe.pendingOffline));
    for (const event of result.events || []) {
      reactTo(event);
      const scene = sceneRef.current;
      if (scene?.handleEvent) {
        try {
          scene.handleEvent(event);
        } catch (error) {
          console.error(error);
        }
      } else {
        queueRef.current.push(event);
        if (queueRef.current.length > 24) queueRef.current.shift();
      }
    }
  }, [reactTo]);

  useEffect(() => {
    const onTick = () => {
      const now = Date.now();
      const current = engineRef.current;
      if (!current) return;
      const gap = (now - (current.lastTick || now)) / 1000;
      if (hiddenRef.current && !current.pendingOffline) return;
      if (current.pendingOffline && gap <= 20) {
        if (!hiddenRef.current) engineRef.current = { ...current, lastTick: now };
        return;
      }
      applyResult(tick(current, now));
    };
    const timer = window.setInterval(onTick, 100);
    const onVis = () => {
      hiddenRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [applyResult]);

  useEffect(() => {
    setMusicEnabled(Boolean(state.settings.music));
  }, [state.settings.music]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !engineRef.current?.pendingOffline) setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene?.sync) return;
    try {
      scene.sync(state);
    } catch (error) {
      console.error(error);
    }
  }, [state]);

  useEffect(() => {
    const events = bootRef.current?.events || [];
    if (bootRef.current) bootRef.current.events = [];
    for (const event of events) {
      reactTo(event);
      const scene = sceneRef.current;
      if (scene?.handleEvent) {
        try {
          scene.handleEvent(event);
        } catch (error) {
          console.error(error);
        }
      } else {
        queueRef.current.push(event);
      }
    }
  }, [reactTo]);

  useAutoSave(engineRef);

  const registerScene = useCallback((scene) => {
    sceneRef.current = scene;
    if (!scene) return;
    if (scene.sync) scene.sync(engineRef.current);
    const queued = queueRef.current.splice(0, queueRef.current.length);
    for (const event of queued) {
      try {
        scene.handleEvent?.(event);
      } catch (error) {
        console.error(error);
      }
    }
  }, []);

  const actions = useMemo(() => ({
    sellLine: (lineId) => applyResult(doSellLine(engineRef.current, lineId)),
    sellAll: () => applyResult(doSellAll(engineRef.current)),
    setAutoSell: (lineId, enabled) => applyResult(doSetAutoSell(engineRef.current, lineId, enabled)),
    tap: (lineId) => applyResult(doTap(engineRef.current, lineId, Date.now())),
    buyLineUpgrade: (lineId, key) => applyResult(doBuyLineUpgrade(engineRef.current, lineId, key)),
    buyGlobalUpgrade: (id) => applyResult(doBuyGlobalUpgrade(engineRef.current, id)),
    unlockLine: (lineId) => applyResult(doUnlockLine(engineRef.current, lineId)),
    hire: (templateId) => applyResult(doHire(engineRef.current, templateId)),
    train: (templateId) => applyResult(doTrain(engineRef.current, templateId)),
    assign: (templateId, lineId) => applyResult(doAssign(engineRef.current, templateId, lineId)),
    completeOrder: (orderId) => applyResult(doCompleteOrder(engineRef.current, orderId)),
    buyStack: (itemId) => applyResult(doBuyStack(engineRef.current, itemId)),
    buyTheme: (themeId) => applyResult(doBuyTheme(engineRef.current, themeId)),
    equipTheme: (themeId) => applyResult(doEquipTheme(engineRef.current, themeId)),
    whistle: () => applyResult(doWhistle(engineRef.current, Date.now())),
    surge: () => applyResult(doSurge(engineRef.current, Date.now())),
    collectOffline: () => applyResult(doCollectOffline(engineRef.current)),
    dismissTutorial: () => applyResult(doDismissTutorial(engineRef.current)),
    updateSettings: (partial) => applyResult(doSettings(engineRef.current, partial)),
    buyRoom: (roomId) => applyResult(doBuyRoom(engineRef.current, roomId)),
    buySlot: (roomId) => applyResult(doBuySlot(engineRef.current, roomId)),
    research: (techId) => applyResult(doResearch(engineRef.current, techId)),
    buyForklifts: () => applyResult(doForklifts(engineRef.current)),
    buyTrucks: () => applyResult(doTrucks(engineRef.current)),
    buyCrew: () => applyResult(doCrew(engineRef.current)),
    buyPallet: () => applyResult(doPallet(engineRef.current)),
    repairLine: (lineId) => applyResult(doRepair(engineRef.current, lineId)),
    loadContract: (contractId) => applyResult(doLoadContract(engineRef.current, contractId)),
    claimMission: (missionId) => applyResult(doClaimMission(engineRef.current, missionId)),
    buyPrestigeUpgrade: (key) => applyResult(doPrestigeUpgrade(engineRef.current, key)),
    prestige: () => applyResult(doPrestige(engineRef.current)),
    openUpgrades: (lineId) => {
      setFocusLine(lineId || null);
      setTab('upgrades');
    },
    resetGame: () => {
      clearGame();
      const fresh = createInitialState(Date.now());
      engineRef.current = fresh;
      setState(fresh);
      setOfflineOpen(false);
      setModal(null);
      setTab('factory');
      setFocusLine(null);
      setToasts([]);
      saveGame(fresh);
    },
  }), [applyResult]);

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  return {
    state,
    toasts,
    dismissToast,
    offlineOpen,
    modal,
    setModal,
    tab,
    setTab,
    focusLine,
    registerScene,
    ...actions,
  };
}
