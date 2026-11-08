# Riverton Works

An original idle factory tycoon. Open production lines, sell what they finish, and put the cash back into presses, crew, research, and new rooms. The floor keeps running while the tab is open, and a night shift pays you for time away.

Play it at [daniilsonufrijuks.github.io/Factorio](https://daniilsonufrijuks.github.io/Factorio/) after the Pages workflow has deployed.

## How to play

The first line, Kettlepath Sneakers, finishes goods onto a belt and into storage. Sell the crate for cash, then spend it.

- Tap a press on the floor to hurry its cycle.
- Sell from the bottom bar, a line card, or the warehouse. Orders pay more than the street price.
- Upgrade speed, belts, finish quality, and storage. A full crate stalls the line.
- Auto-sell unlocks at level 2. Hire workers and station them on a line.
- Raw material arrives by truck. An empty yard stops the presses.
- Research, extra rooms, and machine bays are permanent ways to grow. Prestige is optional: it restarts the run and keeps research, achievements, and prestige bonuses.

Progress is saved in this browser under `riverton-works-save-v1`. Clearing site data starts a new mill.

## Run it locally

```powershell
npm install
npm run dev
```

Open http://localhost:5173/. If PowerShell blocks `npm.ps1`, use `npm.cmd` instead.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Write the static site to `dist` |
| `npm run preview` | Serve the production build |
| `npm run balance` | Check early-game income and offline pay |
| `node scripts/expansion-check.mjs` | Check rooms, research, contracts, and prestige |

## On the floor

- **Production.** Seven lines, from sneakers to field kits. Each one pulls raw stock, forms it, then finishes a product.
- **Upgrades and workers.** Per-line ranks, factory-wide racks and reputation, and a crew with line or company-wide bonuses.
- **Orders and shop.** Customer tickets, brand contracts, overtime, and floor paint.
- **Research.** A point tree for machines, robotics, logistics, and pricing. Points survive prestige.
- **Logistics.** A raw yard, forklifts, delivery trucks, and dock contracts.
- **Expansion.** Four departments, extra machine bays, and an optional prestige reset.
- **Goals.** Daily missions, achievements, and a statistics panel.

## Stack

React 18 and Vite 6 for the interface. Phaser 3 draws the factory. There is no server: the simulation, save, and offline payout all run in the browser.

GitHub Actions builds `dist` from `main` and publishes it with Pages. The workflow is `.github/workflows/pages.yml`. In the repo, set **Settings → Pages → Source** to **GitHub Actions**.
