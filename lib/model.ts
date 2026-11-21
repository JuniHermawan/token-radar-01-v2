// Launch Radar's model (radar-3): one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks every rankable pre-token protocol in the snapshot: the 40 on the watchlist (the
// floor, never a ceiling) plus every other pre-token protocol the house's own exclusion rule leaves
// rankable, below or above the floor. A protocol is rankable when its record carries no token (no
// market cap, no CoinGecko id, no symbol) and it is not a wrapped, staked or bridged product of a
// token that already trades: not a CEX, not a Bridge / Canonical Bridge / Liquid Staking / Liquid
// Restaking / Restaked BTC product, and not a versioned pool (a name ending in V2, v2, 2.0 or the
// like). The live-token protocols are kept apart and shown with the market's own values, never
// mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures:
//
//   base       = tvl_usd x BASE_MULTIPLE                         (0.25)
//   growth     = change_7d, in per cent, null counts as 0
//   effective  = growth floored at -90; past +150 the tail is logarithmic,
//                so +150% and +4448% are not scored the same:
//                g_eff = g                       when g <= 150
//                g_eff = 150 + 50 x log10(g/150) when g > 150
//   growthMult = 1 + (g_eff / 100) x GROWTH_WEIGHT              (0.45)
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4         (age unknown: 365)
//   reach      = 1 + REACH_WEIGHT x min(chains - 1, 5)          (0.03)
//   implied    = max(1, round(base x growthMult x maturity x reach))
//
// The constants are the radar-3 model's, stated in the dashboard and changeable in the page's
// model sandbox, which recomputes every row live. No protocol name is ever special-cased: the
// same function scores every row, and the page shows each multiplier beside the row it produced,
// plus a driver tag naming which factor carries the row: Growth-led, Seasoned, Multi-chain or
// Scale-led.

/** One protocol of the snapshot: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string; // DefiLlama's slug, unique in the file
  name: string; // the protocol's name as DefiLlama writes it
  category: string | null; // DefiLlama's category, null when it names none
  chains: string[]; // the chains DefiLlama counts the protocol's TVL on
  tvl_usd: number; // locked value in whole dollars, truncated
  change_7d: number | null; // TVL change over seven days, in per cent, null when unreported
  mcap_usd: number | null; // its token's market cap, null when it records no token
  listed_at: string | null; // the UTC day tracking began, null when unreported
  gecko_id: string | null; // its token's CoinGecko id, null when it records no token
  symbol: string | null; // its token's ticker, null when it records no token
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string; // the UTC date of the fetch
  source: string; // the endpoint and the exact fetch time
  floor_usd: number; // the watchlist's floor in whole dollars
  protocols: SnapshotProtocol[]; // every protocol at or above $5,000,000 of TVL, by slug
  watchlist: string[]; // the slugs the house's rule kept, ascending
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number; // TVL turns into implied value at this rate
  growth_weight: number; // how much seven-day growth moves the multiple
  growth_floor: number; // the lowest seven-day growth the model credits
  growth_linear_cap: number; // growth past this is scored on a log tail, not linearly
  growth_tail: number; // what the log tail adds per tenfold past the linear cap
  maturity_floor: number; // the multiple of a protocol listed yesterday
  maturity_range: number; // what three years of running with no token adds
  maturity_days: number; // the age at which maturity stops growing
  unknown_age_days: number; // the age used when no listing date is recorded
  reach_weight: number; // what each extra chain beyond the first adds
  reach_cap_chains: number; // the most extra chains the model credits
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.45,
  growth_floor: -90,
  growth_linear_cap: 150,
  growth_tail: 50,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  reach_weight: 0.03,
  reach_cap_chains: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string; // the action, in the words a farmer can follow
  cost: string; // what it costs, in dollars of capital and gas
  time: string; // how long it takes
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number; // 1 is the board's most valuable protocol
  slug: string; // the snapshot's slug, once each
  name: string; // the protocol's name
  category: string | null; // DefiLlama's category, null when it names none
  chains: string[]; // the chains the protocol runs on
  tvl_usd: number; // locked value in whole dollars
  change_7d: number | null; // TVL change over seven days, in per cent
  mcap_usd: number | null; // null: the record carries no token
  listed_at: string | null; // the UTC day tracking began
  gecko_id: string | null; // null: the record carries no token
  symbol: string | null; // null: the record carries no token
  token_status: 'pre-token'; // every ranked row records no token
  age_days: number | null; // days since first listed, null when unknown
  implied_value_usd: number; // the model's claim, in whole dollars
  driver: string; // which model factor carries the row: Growth-led, Seasoned, Multi-chain, Scale-led
  model: {
    base_multiple: number; // the TVL rate this row was scored with
    growth_pct: number; // the seven-day growth, in per cent
    growth_effective_pct: number; // the growth after the floor and the log tail, in per cent
    growth_multiplier: number; // the growth multiple, to four places
    maturity_multiplier: number; // the maturity multiple, to four places
    reach_multiplier: number; // the reach multiple, to four places
    age_days: number | null; // the age the model used
  };
  farm_steps: string[]; // eight steps, each an action with a cost and a time
}

/** The dashboard's compact view of one row, with the farm plan carried in full. */
export interface RadarRow {
  rank: number; // the submitted rank
  slug: string; // the snapshot's slug
  name: string; // the protocol's name
  category: string | null; // DefiLlama's category
  chains: string[]; // the chains the protocol runs on
  tvl_usd: number; // locked value in whole dollars
  change_7d: number | null; // TVL change over seven days, in per cent
  mcap_usd: number | null; // null for every board row
  listed_at: string | null; // the UTC day tracking began
  age_days: number | null; // days since first listed
  implied_value_usd: number; // the model's claim, in whole dollars
  driver: string; // Growth-led, Seasoned, Multi-chain or Scale-led
  growth_multiplier: number; // the growth multiple, to four places
  maturity_multiplier: number; // the maturity multiple, to four places
  reach_multiplier: number; // the reach multiple, to four places
  on_watchlist: boolean; // whether the snapshot's watchlist names this slug
  farm_steps: string[]; // the eight-step farm plan
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string; // the snapshot's slug
  name: string; // the protocol's name
  category: string | null; // DefiLlama's category
  chains: string[]; // the chains the protocol runs on
  tvl_usd: number; // locked value in whole dollars
  mcap_usd: number | null; // the market's own value
  change_7d: number | null; // TVL change over seven days, in per cent
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string; // the snapshot's date
  source: string; // the snapshot's source
  floor_usd: number; // the watchlist's floor
  model: ModelConstants; // the radar-3 constants
  model_version: string; // 'radar-3'
  watchlist_size: number; // 40 in this snapshot
  board_size: number; // the board's row count
  early_size: number; // rows beyond the watchlist
  live_size: number; // live-token protocols set aside
  median_tvl_usd: number; // the board's median TVL, for the detail view's comparison
  median_implied_usd: number; // the board's median implied value
  surging: number; // rows growing more than 20% in seven days
  rows: RadarRow[]; // the board, compact
  live: LiveRow[]; // the live-token set, by market cap
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** The value when it is a finite number, else `fallback`. */
function numOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

/**
 * Seven-day growth after the floor and the log tail: growth past the linear cap is scored
 * logarithmically, so a protocol up 4,448% is not scored the same as one up 150% — the tail
 * still credits the surge, at 50 points of effective growth per tenfold past the cap.
 */
export function effectiveGrowth(growthPct: number, model: ModelConstants): number {
  if (growthPct <= model.growth_linear_cap) return Math.max(model.growth_floor, growthPct);
  return model.growth_linear_cap + model.growth_tail * Math.log10(growthPct / model.growth_linear_cap);
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; growthPct: number; growthEffective: number; growthMult: number; maturityMult: number; reachMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = numOr(protocol.change_7d, 0);
  const growthEffective = effectiveGrowth(growthPct, model);
  const growthMult = 1 + (growthEffective / 100) * model.growth_weight;
  const ageUsed = age ?? model.unknown_age_days;
  const ageCapped = Math.min(Math.max(ageUsed, 0), model.maturity_days);
  const maturityMult = model.maturity_floor + (ageCapped / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.reach_cap_chains);
  const reachMult = 1 + model.reach_weight * extraChains;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * model.base_multiple * growthMult * maturityMult * reachMult));
  return { implied, growthPct, growthEffective, growthMult, maturityMult, reachMult, age };
}

/** Which model factor carries a row: the strongest multiplier above its neutral value. */
export function driverFor(growthMult: number, maturityMult: number, reachMult: number): string {
  if (growthMult >= 1.25) return 'Growth-led';
  if (maturityMult >= 0.92) return 'Seasoned';
  if (reachMult >= 1.09) return 'Multi-chain';
  return 'Scale-led';
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const WRAPPED_PRODUCT = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not a wrapped/staked/bridged product of a
 * token that already trades, and not a versioned pool. This is the house watchlist's own exclusion
 * rule, applied to the whole snapshot instead of only the protocols above the floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && (p.category === null || !WRAPPED_PRODUCT.has(p.category)) && !VERSIONED.test(p.name);
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it, ranked like any other row.
  for (const slug of snapshot.watchlist) {
    const found = index.get(slug);
    if (found !== undefined) chosen.set(slug, found);
  }
  // The early radar: every other rankable pre-token protocol in the snapshot, above or below the
  // floor. The board ranks the whole rankable universe, not a TVL-capped sample of it.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    driver: driverFor(s.growthMult, s.maturityMult, s.reachMult),
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_effective_pct: Math.round(s.growthEffective * 100) / 100,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      reach_multiplier: round4(s.reachMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  const joined = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (joined.length > 600) return `${joined.slice(0, 596)}...`;
  if (joined.length < 20) return `${joined} Hold the position and check the protocol's own page.`;
  return joined;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains[0] ?? 'its main chain';
}

/** The other chains a protocol runs on, for the plan's reach note, or an empty string. */
function otherChains(p: SnapshotProtocol): string {
  if (p.chains.length <= 1) return '';
  const rest = p.chains.slice(1, 3).join(' and ');
  const more = p.chains.length > 3 ? ` and ${p.chains.length - 3} more` : '';
  return ` It also runs on ${rest}${more}.`;
}

/** [TVL at or above, capital] pairs, strongest first; below them all, $50. */
const CAPITAL_TIERS: Array<[number, number]> = [
  [1_000_000_000, 250],
  [100_000_000, 150],
  [10_000_000, 75],
];

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  for (const [floor, capital] of CAPITAL_TIERS) if (p.tvl_usd >= floor) return capital;
  return 50;
}

/** [age below, hold days] pairs, youngest first; older than a year, 30 days. */
const HOLD_TIERS: Array<[number, number]> = [
  [180, 60],
  [365, 45],
];

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  for (const [below, hold] of HOLD_TIERS) if (age < below) return hold;
  return 30;
}

/** What one transaction costs on each chain, in dollars of gas, from the chain's own fees. */
const GAS_USD: Record<string, string> = {
  Ethereum: 'about $6',
  Base: 'about $0.10',
  Arbitrum: 'about $0.30',
  Optimism: 'about $0.20',
  BSC: 'about $0.25',
  Solana: 'about $0.02',
  Polygon: 'about $0.05',
  Avalanche: 'about $0.50',
  Ink: 'about $0.10',
  Monad: 'about $0.05',
  Unichain: 'about $0.10',
  Katana: 'about $0.10',
  Corn: 'about $0.10',
  Tron: 'about $1',
  Sui: 'about $0.05',
  Aptos: 'about $0.05',
  Berachain: 'about $0.10',
  Hyperliquid: 'about $0.10',
  Sonic: 'about $0.05',
  Linea: 'about $0.20',
  Scroll: 'about $0.20',
  zkSync: 'about $0.20',
  Starknet: 'about $0.30',
  Mantle: 'about $0.10',
  Blast: 'about $0.10',
  Mode: 'about $0.10',
  Fraxtal: 'about $0.10',
};

/** The gas one transaction costs on the protocol's first chain. */
function gasFor(chain: string): string {
  return GAS_USD[chain] ?? 'about $1';
}

/** One category rule: the substrings that select it, and the action it writes. */
interface ActionRule {
  needles: string[];
  make: (name: string, capital: number, chain: string) => string;
  second: (name: string, capital: number, chain: string) => string;
  risk: (name: string, capital: number) => string;
}

/** The category's two actions and its risk, in the words a farmer can follow. The first rule that matches wins. */
const ACTION_RULES: ActionRule[] = [
  {
    needles: ['risk curator', 'curator', 'allocator'],
    make: (name, capital, chain) => `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares in your wallet.`,
    second: (name, capital, chain) => `Move half the position into a second ${name} vault on ${chain} with a different curator, so the farm reads as two vaults, not one deposit.`,
    risk: (name, capital) => `A vault's curator sets its own strategy, so a bad curator can lose money the protocol never touches: split the $${capital} across two vaults and check each vault's holdings before you deposit.`,
  },
  {
    needles: ['lend', 'cdp', 'collateral'],
    make: (name, capital, chain) => `Supply $${capital} of USDC to ${name} on ${chain}, borrow a small amount against it, and keep both legs open.`,
    second: (name, capital, chain) => `Repay part of the borrow and re-borrow once, so the position shows a borrow cycle instead of a single deposit.`,
    risk: (name, capital) => `A borrow can be liquidated if the collateral falls: keep the loan under half the supplied $${capital} and watch the health factor weekly.`,
  },
  {
    needles: ['dex', 'leveraged farm'],
    make: (name, capital, chain) => `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in the pair the pool page highlights, and keep the position open.`,
    second: (name, capital, chain) => `Add a small swap through ${name} on ${chain} once a week, so the farm shows trading as well as liquidity.`,
    risk: (name, capital) => `Liquidity loses value when the pair moves apart (impermanent loss): keep the $${capital} in the pair the pool page highlights and do not chase the highest-fee pool.`,
  },
  {
    needles: ['yield aggregator', 'yield'],
    make: (name, capital, chain) => `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and keep the vault token.`,
    second: (name, capital, chain) => `Harvest the vault's yield once and redeposit it, so the farm shows a compounding cycle instead of one deposit.`,
    risk: (name, capital) => `A vault's yield can fall when its strategy rotates: read the vault's strategy page before you deposit the $${capital}, and do not move it to a new vault every week.`,
  },
  {
    needles: ['derivative', 'perpetual', 'basis trad'],
    make: (name, capital, chain) => `Deposit $${capital} of USDC as margin on ${name} on ${chain}, open one small hedge, and leave the margin in place.`,
    second: (name, capital, chain) => `Close the hedge and open a fresh one at a smaller size, so the farm shows repeated use instead of one trade.`,
    risk: (name, capital) => `Leverage can wipe margin fast: keep the $${capital} as margin with no more than 2x leverage and set a stop before you open the hedge.`,
  },
  {
    needles: ['rwa'],
    make: (name, capital, chain) => `Mint $${capital} of the protocol's yield-bearing asset through ${name} on ${chain} and hold it in your wallet.`,
    second: (name, capital, chain) => `Use the minted asset once as collateral in a lending pool on ${chain}, then return it to your wallet.`,
    risk: (name, capital) => `A yield-bearing asset depends on its issuer's reserves: read the attestation the protocol publishes before you mint the $${capital}.`,
  },
  {
    needles: ['stable'],
    make: (name, capital, chain) => `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it for the full window.`,
    second: (name, capital, chain) => `Swap a small part of the stable asset through ${name} on ${chain} and back, so the farm shows use as well as holding.`,
    risk: (name, capital) => `A stable asset can depeg: hold the $${capital} in the asset the protocol itself issues and check its peg weekly.`,
  },
  {
    needles: ['staking', 'staking pool'],
    make: (name, capital, chain) => `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`,
    second: (name, capital, chain) => `Use the receipt token once in a lending pool on ${chain}, then return it to your wallet.`,
    risk: (name, capital) => `A receipt token can trade below the staked asset: keep the $${capital} staked and check the receipt's price before you use it elsewhere.`,
  },
  {
    needles: ['prediction'],
    make: (name, capital, chain) => `Fund $${capital} and place one market position on ${name} on ${chain}, then leave the position to settle.`,
    second: (name, capital, chain) => `Place a second, smaller position on a different market on ${name}, so the farm shows two markets, not one bet.`,
    risk: (name, capital) => `A prediction market pays nothing when the position is wrong: keep each position under $${Math.round(capital / 2)} and never chase a loss with a bigger one.`,
  },
  {
    needles: ['insurance'],
    make: (name, capital, chain) => `Buy $${capital} of cover from ${name} on ${chain} and keep the policy until it expires.`,
    second: (name, capital, chain) => `File one test claim inquiry through ${name}'s own page, so the farm shows a policyholder who uses the cover.`,
    risk: (name, capital) => `Cover pays only when the policy's terms are met: read what the $${capital} policy actually covers before you buy it.`,
  },
  {
    needles: ['chain'],
    make: (name, capital, chain) => `Bridge $${capital} of USDC to ${name}'s chain and use it once in an app built on that chain.`,
    second: (name, capital, chain) => `Bridge a smaller amount back and use it again on ${chain}, so the farm shows two-way use of the chain.`,
    risk: (name, capital) => `A bridge can delay or fail: bridge the $${capital} in two halves and wait for the first to arrive before you send the second.`,
  },
  {
    needles: ['restak'],
    make: (name, capital, chain) => `Restake $${capital} of the staking receipt through ${name} on ${chain} and keep the restaked position.`,
    second: (name, capital, chain) => `Delegate the restaked position to a second operator through ${name}, so the farm shows two operators, not one.`,
    risk: (name, capital) => `Restaking can be slashed when an operator misbehaves: split the $${capital} across two operators and check their slashing history first.`,
  },
  {
    needles: ['liquid'],
    make: (name, capital, chain) => `Mint $${capital} of the liquid receipt through ${name} on ${chain} and use it once in a lending pool.`,
    second: (name, capital, chain) => `Swap a small part of the receipt through a pool on ${chain} and back, so the farm shows use as well as minting.`,
    risk: (name, capital) => `A liquid receipt can depeg from the asset it represents: mint the $${capital} only when the receipt trades at par, and check it weekly.`,
  },
];

function ruleFor(p: SnapshotProtocol): ActionRule | null {
  const category = (p.category ?? '').toLowerCase();
  for (const rule of ACTION_RULES) {
    if (rule.needles.some((n) => category.includes(n))) return rule;
  }
  return null;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names: the primary and second actions and the risk note come from the category rule, the gas
 * from the chain, the capital from the TVL tier, and the hold from the age.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const rule = ruleFor(p);
  const primary = rule ? rule.make(p.name, capital, chain) : `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
  const second = rule ? rule.second(p.name, capital, chain) : `Use $${Math.round(capital / 2)} of the position once in a second feature of ${p.name} on ${chain}, so the farm shows two uses, not one deposit.`;
  const risk = rule ? rule.risk(p.name, capital) : `A new protocol can change its rules without warning: keep the position at $${capital}, check the protocol's own page weekly, and never deposit more than you can lose.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.${otherChains(p)}`,
      cost: `${gas} of gas for the first transaction`,
      time: '5 minutes',
    },
    { text: primary, cost: `$${capital} of capital and ${gas} of gas`, time: '15 minutes to set up' },
    { text: second, cost: `no new capital, ${gas} of gas`, time: '15 minutes' },
    {
      text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and vary the action so the activity reads as real use.',
      cost: `${gas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    { text: risk, cost: 'nothing to read, and it can save the position', time: '10 minutes' },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: 'Write the wallet, the dates and every transaction in a farm log, then unwind in reverse: claim first, close the second action, then withdraw the main position.',
      cost: 'nothing but the log',
      time: '5 minutes to log, 15 minutes to unwind',
    },
  ];
}

/** The live-token protocols, by market cap, strongest first. */
export function liveRows(snapshot: Snapshot, limit: number = LIVE_ROWS): LiveRow[] {
  return [...snapshot.protocols]
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, limit)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d }));
}

/** One board row, as the dashboard reads it. */
function toRadarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    driver: row.driver,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    reach_multiplier: row.model.reach_multiplier,
    on_watchlist: onWatchlist,
    farm_steps: row.farm_steps,
  };
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** The dashboard's payload: the board, the live set, and the model that scored it. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): RadarData {
  const board = buildBoard(snapshot, model);
  const watchlist = new Set(snapshot.watchlist);
  const rows = board.map((row) => toRadarRow(row, watchlist.has(row.slug)));
  const tvls = board.map((row) => row.tvl_usd);
  const implied = board.map((row) => row.implied_value_usd);
  return {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.length - snapshot.watchlist.length,
    live_size: liveRows(snapshot).length,
    median_tvl_usd: median(tvls),
    median_implied_usd: median(implied),
    surging: board.filter((row) => (row.change_7d ?? 0) > 20).length,
    rows,
    live: liveRows(snapshot),
  };
}

/** The sealed input, checked before any row is scored. */
export function parseSnapshot(data: unknown): Snapshot {
  const source = data as Snapshot;
  const errors: string[] = [];
  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!isPlainObject(data)) throw new SnapshotError('snapshot root must be an object');
  if (typeof source.as_of !== 'string') errors.push('snapshot.as_of must be a string');
  if (typeof source.source !== 'string') errors.push('snapshot.source must be a string');
  if (typeof source.floor_usd !== 'number') errors.push('snapshot.floor_usd must be a number');
  if (!Array.isArray(source.protocols)) errors.push('snapshot.protocols must be an array');
  if (!Array.isArray(source.watchlist)) errors.push('snapshot.watchlist must be an array');
  if (errors.length > 0) throw new SnapshotError(errors.join('; '));
  for (const protocol of source.protocols) {
    if (!isPlainObject(protocol)) throw new SnapshotError('snapshot.protocols rows must be objects');
    if (typeof protocol.slug !== 'string' || protocol.slug === '') throw new SnapshotError('protocol.slug must be a non-empty string');
    if (typeof protocol.name !== 'string' || protocol.name === '') throw new SnapshotError('protocol.name must be a non-empty string');
    if (protocol.category !== null && typeof protocol.category !== 'string') throw new SnapshotError('protocol.category must be a string or null');
    if (!Array.isArray(protocol.chains)) throw new SnapshotError('protocol.chains must be an array');
    for (const chain of protocol.chains) {
      if (typeof chain !== 'string' || chain === '') throw new SnapshotError('protocol.chains rows must be non-empty strings');
    }
    if (typeof protocol.tvl_usd !== 'number' || !Number.isFinite(protocol.tvl_usd)) throw new SnapshotError('protocol.tvl_usd must be a finite number');
    if (protocol.change_7d !== null && typeof protocol.change_7d !== 'number') throw new SnapshotError('protocol.change_7d must be a number or null');
    if (protocol.mcap_usd !== null && typeof protocol.mcap_usd !== 'number') throw new SnapshotError('protocol.mcap_usd must be a number or null');
    if (protocol.listed_at !== null && typeof protocol.listed_at !== 'string') throw new SnapshotError('protocol.listed_at must be a string or null');
    if (protocol.gecko_id !== null && typeof protocol.gecko_id !== 'string') throw new SnapshotError('protocol.gecko_id must be a string or null');
    if (protocol.symbol !== null && typeof protocol.symbol !== 'string') throw new SnapshotError('protocol.symbol must be a string or null');
  }
  const slugs = new Set<string>();
  for (const protocol of source.protocols) {
    if (slugs.has(protocol.slug)) throw new SnapshotError(`duplicate slug ${protocol.slug}`);
    slugs.add(protocol.slug);
  }
  for (const slug of source.watchlist) {
    if (typeof slug !== 'string') throw new SnapshotError('watchlist rows must be strings');
    if (!slugs.has(slug)) throw new SnapshotError(`watchlist slug ${slug} is not in snapshot.protocols`);
  }
  return source;
}

/** Any breach of the board rules the gate itself checks. */
export function boardIssue(snapshot: Snapshot, board: BoardRow[]): string | null {
  const watchlist = new Set(snapshot.watchlist);
  for (const slug of watchlist) {
    if (!board.some((row) => row.slug === slug)) return `watchlist slug ${slug} missing from board`;
  }
  for (let i = 0; i < board.length; i++) {
    const row = board[i];
    if (row.rank !== i + 1) return `row ${row.slug} has rank ${row.rank} at position ${i + 1}`;
    if (i > 0 && row.implied_value_usd > board[i - 1].implied_value_usd) return `board not non-increasing at ${row.slug}`;
    if (row.mcap_usd !== null || row.gecko_id !== null || row.symbol !== null) return `ranked row ${row.slug} carries a token`;
    if (row.implied_value_usd > 100_000_000_000_000) return `row ${row.slug} implied value above cap`;
    if (row.implied_value_usd <= 0) return `row ${row.slug} implied value not positive`;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `row ${row.slug} has ${row.farm_steps.length} farm steps`;
    for (const step of row.farm_steps) {
      if (step.length < 20 || step.length > 600) return `row ${row.slug} farm step of ${step.length} characters`;
    }
    if (row.tvl_usd <= 0) return `row ${row.slug} TVL not positive`;
    if (row.chains.length === 0) return `row ${row.slug} lists no chains`;
  }
  if (board.length < 100) return `board has ${board.length} rows, needs at least 100`;
  if (board.length > 4000) return `board has ${board.length} rows, over the 4000 cap`;
  return null;
}

/** The dashboard's payload as one script tag: `window.LAUNCH_RADAR = {...}`. */
export function dataScript(radar: RadarData): string {
  return `window.LAUNCH_RADAR = ${JSON.stringify(radar)};\n`;
}
