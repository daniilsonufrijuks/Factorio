import {
  Bot,
  Building2,
  ClipboardList,
  Factory,
  FlaskConical,
  Gauge,
  LayoutGrid,
  ListChecks,
  ShoppingBag,
  Target,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import { EMPLOYEES, GLOBAL_UPGRADES, LINES, UPGRADE_KEYS } from '../data/content.js';
import { RESEARCH, ROOMS } from '../data/growth.js';
import { useGame } from '../context/GameContext.jsx';
import {
  automationGateOpen,
  employeeTrainCost,
  getSlots,
  globalUpgradeCost,
  lineUpgradeCost,
  upgradeMax,
} from '../utils/economy.js';
import { freeStock, techReady } from '../utils/growth.js';
import { getLevelInfo } from '../utils/progression.js';

export const SECTIONS = [
  { id: 'factory', label: 'Factory', icon: Factory, dock: 'left' },
  { id: 'orders', label: 'Orders', icon: ClipboardList, dock: 'left' },
  { id: 'warehouse', label: 'Warehouse', icon: Warehouse, dock: 'left' },
  { id: 'shop', label: 'Shop', icon: ShoppingBag, dock: 'left' },
  { id: 'goals', label: 'Goals', icon: Target, dock: 'left' },
  { id: 'upgrades', label: 'Upgrades', icon: Gauge, dock: 'right' },
  { id: 'robotics', label: 'Robotics', icon: Bot, dock: 'right' },
  { id: 'employees', label: 'Workers', icon: Users, dock: 'right' },
  { id: 'research', label: 'Research', icon: FlaskConical, dock: 'right' },
  { id: 'logistics', label: 'Logistics', icon: Truck, dock: 'right' },
  { id: 'expansion', label: 'Expansion', icon: Building2, dock: 'right' },
  { id: 'lines', label: 'Lines', icon: ListChecks, dock: 'none' },
];

export const SECTION_MAP = Object.fromEntries(SECTIONS.map((item) => [item.id, item]));
const MOBILE_PRIMARY = ['factory', 'upgrades', 'employees', 'orders'];

function DockButton({ item, active, badge, onClick, tipSide }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`tab ${active ? 'is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      onClick={onClick}
    >
      <span className="tab-icon">
        <Icon size={19} />
        {badge ? <i className="dot" /> : null}
      </span>
      <span className={`tab-tip tip-${tipSide}`}>{item.label}</span>
    </button>
  );
}

export function FactoryDocks() {
  const { state, tab, setTab } = useGame();
  const badges = badgeMap(state);
  const render = (side) => SECTIONS.filter((item) => item.dock === side).map((item) => (
    <DockButton
      key={item.id}
      item={item}
      active={tab === item.id}
      badge={badges[item.id]}
      tipSide={side === 'left' ? 'right' : 'left'}
      onClick={() => setTab(item.id)}
    />
  ));
  return (
    <nav className="docks" aria-label="Factory sections">
      <div className="dock dock-left">{render('left')}</div>
      <div className="dock dock-right">{render('right')}</div>
    </nav>
  );
}

export default function MobileNavigation() {
  const { state, tab, setTab } = useGame();
  const badges = badgeMap(state);
  const moreActive = !MOBILE_PRIMARY.includes(tab);
  const moreBadge = SECTIONS.some((item) => !MOBILE_PRIMARY.includes(item.id) && badges[item.id]);
  return (
    <nav className="mobile-nav" aria-label="Sections">
      {MOBILE_PRIMARY.map((id) => {
        const item = SECTION_MAP[id];
        const Icon = item.icon;
        return (
          <button key={id} type="button" className={`mnav ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>
            <span className="tab-icon"><Icon size={19} />{badges[id] ? <i className="dot" /> : null}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
      <button type="button" className={`mnav ${moreActive ? 'is-active' : ''}`} onClick={() => setTab('more')}>
        <span className="tab-icon"><LayoutGrid size={19} />{moreBadge ? <i className="dot" /> : null}</span>
        <span>More</span>
      </button>
    </nav>
  );
}

export function MorePanel() {
  const { state, setTab } = useGame();
  const badges = badgeMap(state);
  return (
    <div className="menu-grid">
      {SECTIONS.filter((item) => !MOBILE_PRIMARY.includes(item.id)).map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} type="button" className="menu-tile" onClick={() => setTab(item.id)}>
            <span className="tab-icon"><Icon size={22} />{badges[item.id] ? <i className="dot" /> : null}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function badgeMap(state) {
  const level = getLevelInfo(state.totalXp).level;
  let upgrades = false;
  let robotics = false;
  for (const def of LINES) {
    const line = state.lines[def.id];
    if (!line.unlocked) {
      const index = LINES.findIndex((entry) => entry.id === def.id);
      const previousOpen = index === 0 || state.lines[LINES[index - 1].id].unlocked;
      if (previousOpen && level >= def.unlockLevel && state.money >= def.unlockCost) upgrades = true;
      continue;
    }
    for (const { id: key } of UPGRADE_KEYS) {
      const rank = line[key] || 0;
      if (rank >= upgradeMax(key)) continue;
      if (key === 'automation') {
        if (rank === 0 && automationGateOpen(state) && state.money >= lineUpgradeCost(def, key, rank)) robotics = true;
        continue;
      }
      if (state.money >= lineUpgradeCost(def, key, rank)) upgrades = true;
    }
    if ((line.condition ?? 100) < 40) robotics = true;
  }
  for (const def of GLOBAL_UPGRADES) {
    const rank = state.upgrades[def.id] || 0;
    if (rank < def.max && state.money >= globalUpgradeCost(def.id, rank)) upgrades = true;
  }

  const slots = getSlots(state);
  const employees = EMPLOYEES.some((template) => {
    const hired = state.employees.some((employee) => employee.templateId === template.id);
    return !hired && state.employees.length < slots && level >= template.unlockLevel && state.money >= template.hireCost;
  }) || state.employees.some((employee) => {
    const template = EMPLOYEES.find((entry) => entry.id === employee.templateId);
    return template && employee.level < 20 && state.money >= employeeTrainCost(template, employee.level);
  });

  const warehouse = Object.entries(state.lines).some(([id, line]) => line.unlocked && freeStock(state, id) > 0);
  const orders = state.orders.some((order) => (state.lines[order.lineId]?.inventory || 0) >= order.qty);
  const research = RESEARCH.some((tech) => techReady(state, tech));
  const goals = (state.daily?.missions || []).some((mission) => !mission.claimed && mission.progress >= mission.goal);
  const logistics = (state.contracts || []).some((contract) => (state.lines[contract.lineId]?.inventory || 0) > 0) || (state.materials || 0) <= 0;
  const expansion = ROOMS.some((room) => !state.rooms[room.id]?.owned && level >= room.level && state.money >= room.cost);

  return {
    factory: false,
    upgrades,
    robotics,
    employees,
    warehouse,
    orders,
    shop: false,
    research,
    logistics,
    expansion,
    goals,
    lines: false,
  };
}
