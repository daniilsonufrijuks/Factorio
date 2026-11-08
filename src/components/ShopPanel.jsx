import { SHOP_STACKS, THEME_SHOP } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { stackCost, surgeReward, whistleCost } from '../utils/economy.js';
import { formatDuration, formatMoney } from '../utils/formatter.js';
import { ShoppingBag } from 'lucide-react';
import { PanelHeader, SectionTitle } from './ui/UpgradeCard.jsx';

export default function ShopPanel() {
  const { state, buyStack, buyTheme, equipTheme, whistle, surge } = useGame();
  const now = Date.now();
  const boostLeft = Math.max(0, ((state.shop.boostUntil || 0) - now) / 1000);
  const surgeLeft = Math.max(0, ((state.shop.surgeAt || 0) + 300000 - now) / 1000);
  const whistlePrice = whistleCost(state);
  const surgePay = surgeReward(state);

  return (
    <div className="stack">
      <PanelHeader
        icon={ShoppingBag}
        eyebrow="Shop"
        title="Contracts, permits, and paint"
        text="These sit on top of the machines. A surge buyer and an overtime whistle are there when you want a push."
      />

      <article className="card shop-feature">
        <div>
          <h3>Market surge</h3>
          <p>A buyer clears about a minute of current output. Ready every 5 minutes.</p>
          <p className="good">Pays {formatMoney(surgePay)}</p>
        </div>
        <button type="button" className="btn btn-gold" disabled={surgeLeft > 0} onClick={surge}>
          {surgeLeft > 0 ? formatDuration(surgeLeft) : 'Claim'}
        </button>
      </article>

      <article className="card shop-feature">
        <div>
          <h3>Overtime whistle</h3>
          <p>Double production speed for 3 minutes. {boostLeft > 0 ? `${formatDuration(boostLeft)} left on the clock.` : 'The floor is at a normal pace.'}</p>
        </div>
        <button type="button" className="btn btn-gold" disabled={state.money < whistlePrice} onClick={whistle}>
          {formatMoney(whistlePrice)}
        </button>
      </article>

      {SHOP_STACKS.map((item) => {
        const owned = state.shop[item.id] || 0;
        const maxed = owned >= item.max;
        const cost = stackCost(item, owned);
        return (
          <article key={item.id} className="card shop-feature">
            <div>
              <h3>{item.name}</h3>
              <p>{item.blurb}</p>
              <p className="muted">{item.stat} · owned {owned}/{item.max}</p>
            </div>
            <button type="button" className="btn btn-gold" disabled={maxed || state.money < cost} onClick={() => buyStack(item.id)}>
              {maxed ? 'Maxed' : formatMoney(cost)}
            </button>
          </article>
        );
      })}

      <SectionTitle>Floor enamel</SectionTitle>
      <article className="card shop-feature">
        <div>
          <h3>Dusk kiln</h3>
          <p>The original navy and amber floor. It comes with the building.</p>
        </div>
        <button type="button" className="btn btn-ghost" disabled={state.shop.theme === 'dusk'} onClick={() => equipTheme('dusk')}>
          {state.shop.theme === 'dusk' ? 'In use' : 'Use'}
        </button>
      </article>
      {THEME_SHOP.map((theme) => {
        const owned = state.shop.ownedThemes.includes(theme.id);
        const active = state.shop.theme === theme.id;
        return (
          <article key={theme.id} className="card shop-feature">
            <div>
              <h3>{theme.name}</h3>
              <p>{theme.blurb}</p>
            </div>
            <button
              type="button"
              className="btn btn-gold"
              disabled={!owned && state.money < theme.cost}
              onClick={() => (owned ? equipTheme(theme.id) : buyTheme(theme.id))}
            >
              {active ? 'In use' : owned ? 'Use' : formatMoney(theme.cost)}
            </button>
          </article>
        );
      })}
    </div>
  );
}
