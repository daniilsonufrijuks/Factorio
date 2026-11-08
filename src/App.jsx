import { X } from 'lucide-react';
import { GameProvider, useGame } from './context/GameContext.jsx';
import TopBar from './components/TopBar.jsx';
import MobileNavigation, { MorePanel, SECTION_MAP } from './components/BottomNavigation.jsx';
import FactoryView from './components/FactoryView.jsx';
import { FactorySummary } from './components/ProductionLine.jsx';
import UpgradePanel from './components/UpgradePanel.jsx';
import RoboticsPanel from './components/RoboticsPanel.jsx';
import EmployeePanel from './components/EmployeePanel.jsx';
import ResearchPanel from './components/ResearchPanel.jsx';
import LogisticsPanel from './components/LogisticsPanel.jsx';
import ExpansionPanel from './components/ExpansionPanel.jsx';
import GoalsPanel from './components/GoalsPanel.jsx';
import WarehousePanel from './components/WarehousePanel.jsx';
import OrdersPanel from './components/OrdersPanel.jsx';
import ShopPanel from './components/ShopPanel.jsx';
import OfflineReward from './components/OfflineReward.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import StatsModal from './components/StatsModal.jsx';
import { formatDuration } from './utils/formatter.js';

const PANELS = {
  factory: FactorySummary,
  lines: FactorySummary,
  upgrades: UpgradePanel,
  robotics: RoboticsPanel,
  employees: EmployeePanel,
  research: ResearchPanel,
  logistics: LogisticsPanel,
  expansion: ExpansionPanel,
  goals: GoalsPanel,
  warehouse: WarehousePanel,
  orders: OrdersPanel,
  shop: ShopPanel,
  more: MorePanel,
};

function Shell() {
  const { state, tab, setTab, toasts, dismissToast } = useGame();
  const boostLeft = Math.max(0, ((state.shop.boostUntil || 0) - Date.now()) / 1000);
  const Panel = PANELS[tab] || FactorySummary;
  const title = tab === 'more' ? 'All sections' : SECTION_MAP[tab]?.label || 'Factory';
  const sheetOpen = tab !== 'factory';

  return (
    <div className="app-shell" data-theme={state.shop.theme || 'dusk'}>
      <TopBar />
      {boostLeft > 0 ? <div className="boost-banner">Overtime is running · {formatDuration(boostLeft)} left</div> : null}
      <main className={`workspace ${sheetOpen ? 'sheet-open' : ''}`}>
        <section className="stage-column">
          <FactoryView />
        </section>
        <aside className="panel-column" aria-label={title}>
          <div className="sheet-head">
            <span className="sheet-grip" aria-hidden="true" />
            <strong>{title}</strong>
            <button type="button" className="icon-btn sm" onClick={() => setTab('factory')} aria-label="Close panel">
              <X size={16} />
            </button>
          </div>
          <div className="panel-scroll" key={tab}>
            <Panel />
          </div>
        </aside>
        {sheetOpen ? <button type="button" className="sheet-scrim" aria-label="Close panel" onClick={() => setTab('factory')} /> : null}
      </main>
      <MobileNavigation />
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <button key={toast.id} type="button" className={`toast tone-${toast.tone || 'mint'}`} onClick={() => dismissToast(toast.id)}>
            <strong>{toast.title}</strong>
            {toast.body ? <span>{toast.body}</span> : null}
          </button>
        ))}
      </div>
      <OfflineReward />
      <SettingsModal />
      <StatsModal />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
