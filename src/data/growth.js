export const ROOMS = [
  {
    id: 'cutting',
    name: 'Cutting floor',
    department: 'Cutting',
    level: 1,
    cost: 0,
    lines: ['shoes', 'shirts'],
    slotCost: 480,
    blurb: 'Where the first cuts and stitches happen.',
  },
  {
    id: 'assembly',
    name: 'Assembly hall',
    department: 'Assembly',
    level: 4,
    cost: 2200,
    lines: ['watches', 'tools'],
    slotCost: 4200,
    blurb: 'A second room for movements, cases, and hand tools.',
  },
  {
    id: 'packaging',
    name: 'Packaging bay',
    department: 'Packaging',
    level: 9,
    cost: 42000,
    lines: ['accessories', 'electronics'],
    slotCost: 64000,
    blurb: 'Boxing, kits, and the small goods that need a clean finish.',
  },
  {
    id: 'shipping',
    name: 'Shipping dock',
    department: 'Shipping',
    level: 14,
    cost: 680000,
    lines: ['medical'],
    slotCost: 920000,
    blurb: 'The last room. Sealed kits leave from here.',
  },
];

export const RESEARCH = [
  { id: 'sharper-dies', category: 'Machines', name: 'Sharper dies', cost: 6, effect: 'speed', value: 0.08, requires: null, blurb: 'Presses finish a cycle a little sooner.' },
  { id: 'belt-sensors', category: 'Machines', name: 'Belt sensors', cost: 12, effect: 'speed', value: 0.1, requires: 'sharper-dies', blurb: 'Fewer gaps between stations.' },
  { id: 'case-hardening', category: 'Machines', name: 'Case hardening', cost: 14, effect: 'care', value: 0.12, requires: 'sharper-dies', blurb: 'Machines wear down more slowly.' },
  { id: 'pick-arms', category: 'Robotics', name: 'Pick arms', cost: 8, effect: 'speed', value: 0.06, requires: null, blurb: 'A robotic assist on every open line.' },
  { id: 'auto-pack', category: 'Robotics', name: 'Auto pack', cost: 16, effect: 'capacity', value: 0.12, requires: 'pick-arms', blurb: 'Crates hold more before the belt stops.' },
  { id: 'night-robots', category: 'Robotics', name: 'Night robots', cost: 22, effect: 'offline', value: 0.05, requires: 'auto-pack', blurb: 'The night shift recovers a bit more.' },
  { id: 'yard-forks', category: 'Logistics', name: 'Yard forks', cost: 8, effect: 'materials', value: 6, requires: null, blurb: 'Each truck drops a larger raw pallet.' },
  { id: 'dock-schedule', category: 'Logistics', name: 'Dock schedule', cost: 14, effect: 'truck', value: 1, requires: 'yard-forks', blurb: 'Raw deliveries arrive sooner.' },
  { id: 'house-mark', category: 'Automation', name: 'House mark', cost: 10, effect: 'value', value: 0.08, requires: null, blurb: 'Buyers pay more for a Riverton stamp.' },
  { id: 'line-memory', category: 'Automation', name: 'Line memory', cost: 18, effect: 'value', value: 0.1, requires: 'house-mark', blurb: 'Saved setups keep the price premium climbing.' },
];

export const ACHIEVEMENTS = [
  { id: 'first-sale', name: 'First invoice', blurb: 'Sell a finished crate.', money: 25, points: 1, xp: 8 },
  { id: 'hundred', name: 'Hundred made', blurb: 'Manufacture 100 pieces.', money: 80, points: 2, xp: 12 },
  { id: 'thousand', name: 'Thousand made', blurb: 'Manufacture 1,000 pieces.', money: 400, points: 4, xp: 20 },
  { id: 'orders-5', name: 'Regular counter', blurb: 'Deliver 5 customer orders.', money: 120, points: 2, xp: 14 },
  { id: 'room-assembly', name: 'Second room', blurb: 'Open the assembly hall.', money: 150, points: 3, xp: 16 },
  { id: 'scholar', name: 'Shop scholar', blurb: 'Finish 3 research projects.', money: 100, points: 0, xp: 18 },
  { id: 'repaired', name: 'Wrench on the bench', blurb: 'Repair a worn machine.', money: 40, points: 1, xp: 8 },
  { id: 'hauler', name: 'Truck away', blurb: 'Complete a delivery contract.', money: 90, points: 2, xp: 10 },
  { id: 'prestige-once', name: 'The works reborn', blurb: 'Prestige the mill once.', money: 200, points: 4, xp: 24 },
];

export const ROOM_MAP = Object.fromEntries(ROOMS.map((room) => [room.id, room]));
export const RESEARCH_MAP = Object.fromEntries(RESEARCH.map((tech) => [tech.id, tech]));
