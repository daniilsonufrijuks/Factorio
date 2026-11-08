import { Container, Forklift, Package, PackageCheck, Truck } from 'lucide-react';
import { LINE_MAP } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { getLineStats } from '../utils/economy.js';
import { forkliftCost, materialCap, palletCost, truckCost, truckDrop, truckInterval } from '../utils/growth.js';
import { formatMoney, formatNumber } from '../utils/formatter.js';
import UpgradeCard, { PanelHeader, SectionTitle, cashStatus } from './ui/UpgradeCard.jsx';

export default function LogisticsPanel() {
  const { state, buyForklifts, buyTrucks, buyPallet, loadContract } = useGame();
  const cap = materialCap(state);
  const materials = Math.floor(state.materials || 0);
  const forks = state.logistics?.forklifts || 0;
  const trucks = state.logistics?.trucks || 0;
  const pallet = palletCost(state);
  const forkPrice = forkliftCost(forks);
  const truckPrice = truckCost(trucks);

  return (
    <div className="stack">
      <PanelHeader
        icon={Truck}
        eyebrow="Logistics"
        title="Keep raw stock moving"
        text="Trucks drop raw pallets in the yard. Every line pulls from the yard, so an empty yard stops the presses."
        stats={[
          { label: 'Raw yard', value: `${materials}/${cap}`, tone: materials <= 0 ? 'bad' : '' },
          { label: 'Truck every', value: `${truckInterval(state).toFixed(1)}s` },
          { label: 'Per drop', value: formatNumber(truckDrop(state)) },
        ]}
      />

      <section className="stack">
        <SectionTitle aside={`${formatNumber(materials)} on the floor`}>Raw yard</SectionTitle>
        <UpgradeCard
          icon={Package}
          eyebrow="Emergency stock"
          title="Buy a raw pallet"
          description="Adds 15 raw units straight to the yard, up to its cap."
          status={materials >= cap ? 'maxed' : cashStatus(state.money, pallet)}
          statusText={materials >= cap ? 'Yard full' : undefined}
          progress={cap > 0 ? materials / cap : 0}
          progressLabel={`${materials} / ${cap}`}
          actionLabel={materials >= cap ? 'Yard full' : 'Order pallet'}
          cost={materials >= cap ? null : formatMoney(pallet)}
          onAction={buyPallet}
        />
      </section>

      <section className="stack">
        <SectionTitle aside="Fleet">Vehicles</SectionTitle>
        <div className="card-grid">
          <UpgradeCard
            icon={Forklift}
            eyebrow={`Rank ${forks} / 8`}
            title="Forklift crew"
            description="Bigger raw drops and a larger yard."
            detail={`+4 per drop · +10 yard space`}
            status={forks >= 8 ? 'maxed' : cashStatus(state.money, forkPrice)}
            progress={forks / 8}
            actionLabel={forks >= 8 ? 'Fleet full' : 'Add forklift'}
            cost={forks >= 8 ? null : formatMoney(forkPrice)}
            onAction={buyForklifts}
          />
          <UpgradeCard
            icon={Truck}
            eyebrow={`Rank ${trucks} / 6`}
            title="Delivery trucks"
            description="Raw deliveries arrive more often, and contracts pay more."
            detail={`Every ${truckInterval(state).toFixed(1)}s`}
            status={trucks >= 6 ? 'maxed' : cashStatus(state.money, truckPrice)}
            progress={trucks / 6}
            actionLabel={trucks >= 6 ? 'Fleet full' : 'Add truck'}
            cost={trucks >= 6 ? null : formatMoney(truckPrice)}
            onAction={buyTrucks}
          />
        </div>
      </section>

      <section className="stack">
        <SectionTitle aside={`${state.contractsCompleted || 0} delivered`}>Delivery contracts</SectionTitle>
        {state.contracts.length === 0 ? (
          <div className="empty-card">
            <Container size={20} />
            <p>The dock is clear. A contract will pull in on its own.</p>
          </div>
        ) : null}
        {state.contracts.map((contract) => {
          const def = LINE_MAP[contract.lineId];
          const line = state.lines[contract.lineId];
          const stock = line?.inventory || 0;
          const left = contract.qty - contract.loaded;
          const stocking = stock <= 0 && Boolean(line?.unlocked) && getLineStats(state, contract.lineId).autoSell;
          const statusText = stock > 0 ? 'Can load' : stocking ? 'Stocking' : 'Need stock';
          const description = stocking
            ? `Auto-sell is holding output for this truck · ${left} still to load`
            : `${stock} in storage · ${left} still to load`;
          return (
            <UpgradeCard
              key={contract.id}
              icon={PackageCheck}
              tone={def?.palette.tag}
              eyebrow={contract.customer}
              title={`${contract.qty} × ${def?.product || contract.lineId}`}
              description={description}
              status={stock > 0 ? 'ready' : 'idle'}
              statusText={statusText}
              progress={contract.loaded / contract.qty}
              progressLabel={`${contract.loaded} / ${contract.qty} loaded`}
              actionLabel="Load truck"
              cost={`Pays ${formatMoney(contract.reward)}`}
              disabled={false}
              onAction={() => loadContract(contract.id)}
            />
          );
        })}
      </section>
    </div>
  );
}
