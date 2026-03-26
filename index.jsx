import { useState, useCallback } from "react";

const DEFAULT_OUR = `sadistic 92180
cypoba 270000
Johns0n 280894
par4dox 282000
zzz 282053
zigi 288141
staje 302554
yuzik 311000
m4thelix 329951
napalm 345694
sheever 380000
ghostly 403000
gatito 471519
dlzhnik 472578
raggen 480842
sapphire 493000
psi 521000
toto 594421
rhio 675000
steelgopher 724157
maljo 774841
overlord 865000
ghillie 1118140
odi 1134000`;

const DEFAULT_ENEMY_DETAILED = [
`ильдар 295408
такашима 363618
анастасия 369393
тамерлан 387841
chka 439641
kudman16 457768
buba31185 526307
хозяин 552233
victory 574892
roma_brd 644756`,
`osya 380861
dobrui 429377
asol_93 434534
coin 439861
oracul 442942
max_lavr 456504
nikarom97 510194
vzna4itvaleriya 559932
cill 579932
eybob01 722981`,
`danbka 156906
сказочная_тварь 294196
palmira 331493
драконпапа 387710
цыпа 492289
flintdoc 496466
maoo 497421
i_rex 498798
talljyh 543332
severodvinets 690745`
];

const LN = ["ВЛ", "СЛ", "НЛ"];
const RISK = 0.05;

function parse(text) {
  return text.trim().split("\n").filter(Boolean).map(line => {
    const m = line.trim().match(/^(\d+)\s+(.+)$/) || line.trim().match(/^(.+?)\s+(\d+)$/);
    if (!m) return null;
    const a = parseInt(m[1]), b = m[2];
    if (!isNaN(a) && isNaN(parseInt(b))) return { name: b.trim(), power: a };
    return { name: m[1].trim(), power: parseInt(m[2]) };
  }).filter(Boolean);
}

// Generate estimated enemy lineup from total power and count
function generateEstimatedEnemies(totalPower, count, label) {
  // Model: exponential-ish distribution (top player ~2x average, bottom ~0.5x)
  // This mirrors typical guild distributions
  const avg = totalPower / count;
  const players = [];
  const weights = [];
  for (let i = 0; i < count; i++) {
    // Linear spread: weakest = 0.5*avg, strongest = 1.5*avg
    const w = 0.5 + (i / (count - 1));
    weights.push(w);
  }
  const wSum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i++) {
    const power = Math.round(totalPower * weights[i] / wSum);
    players.push({ name: `${label}_${i + 1}`, power });
  }
  return players;
}

// Generate multiple enemy scenarios from total power
function generateScenarios(totalPower, count, label) {
  const avg = totalPower / count;
  const scenarios = [];
  // Scenario 1: uniform (all equal)
  scenarios.push({ name: "равномерная", players: Array.from({ length: count }, (_, i) => ({ name: `${label}_${i + 1}`, power: Math.round(avg) })) });
  // Scenario 2: linear spread (0.5x - 1.5x)
  const lin = []; const lw = [];
  for (let i = 0; i < count; i++) { lw.push(0.5 + i / (count - 1)); }
  const lwS = lw.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i++) lin.push({ name: `${label}_${i + 1}`, power: Math.round(totalPower * lw[i] / lwS) });
  scenarios.push({ name: "линейная", players: lin });
  // Scenario 3: top-heavy (one strong, rest average)
  const th = [];
  const topPower = avg * 1.8;
  const restPower = (totalPower - topPower) / (count - 1);
  for (let i = 0; i < count - 1; i++) th.push({ name: `${label}_${i + 1}`, power: Math.round(restPower) });
  th.push({ name: `${label}_boss`, power: Math.round(topPower) });
  scenarios.push({ name: "один сильный", players: th });
  // Scenario 4: two strong
  const ts = [];
  const t1 = avg * 1.6, t2 = avg * 1.4;
  const restP2 = (totalPower - t1 - t2) / (count - 2);
  for (let i = 0; i < count - 2; i++) ts.push({ name: `${label}_${i + 1}`, power: Math.round(restP2) });
  ts.push({ name: `${label}_sub`, power: Math.round(t2) });
  ts.push({ name: `${label}_boss`, power: Math.round(t1) });
  scenarios.push({ name: "два сильных", players: ts });
  return scenarios;
}

function simDetail(team, enemy) {
  const our = [...team].sort((a, b) => a.power - b.power);
  const es = [...enemy].sort((a, b) => a.power - b.power);
  let oi = 0, ei = 0, of2 = 0, ef = 0, ow = 0, ew = 0, last = null;
  const fights = [];
  let minMW = Infinity, risky = 0;
  while (oi < our.length && ei < es.length) {
    of2++; ef++;
    const margin = our[oi].power - es[ei].power;
    const pct = Math.abs(margin) / Math.max(our[oi].power, es[ei].power);
    if (our[oi].power > es[ei].power) {
      ow++; last = "us";
      if (margin < minMW) minMW = margin;
      if (pct < RISK) risky++;
      fights.push({ our: our[oi], enemy: es[ei], winner: "us", margin, pct });
      ei++; ef = 0;
      if (of2 >= 2) { oi++; of2 = 0; }
    } else {
      ew++; last = "them";
      fights.push({ our: our[oi], enemy: es[ei], winner: "them", margin, pct });
      oi++; of2 = 0;
      if (ef >= 2) { ei++; ef = 0; }
    }
  }
  while (oi < our.length) { of2++; ow++; last = "us"; fights.push({ our: our[oi], enemy: null, winner: "us", margin: 0, pct: 0 }); if (of2 >= 2) { oi++; of2 = 0; } }
  while (ei < es.length) { ef++; ew++; last = "them"; fights.push({ our: null, enemy: es[ei], winner: "them", margin: 0, pct: 0 }); if (ef >= 2) { ei++; ef = 0; } }
  return { won: last === "us", ow, ew, fights, minMW, risky };
}

function evaluate(lanes, enemies) {
  let flags = 0, wins = 0, risk = 0, details = [];
  for (let i = 0; i < 3; i++) {
    const r = simDetail(lanes[i], enemies[i]);
    if (r.won) flags++;
    wins += r.ow;
    risk += r.risky;
    details.push(r);
  }
  return { flags, wins, risk, details };
}

function calcProb(detail) {
  if (!detail.won) return 0;
  let p = 1;
  for (const f of detail.fights) {
    if (!f.our || !f.enemy) continue;
    if (f.winner === "us" && f.pct < RISK) p *= 0.5 + (f.pct / RISK) * 0.5;
  }
  return p;
}

// Priority: flags > wins > less risk
function isBetter(f, w, r, bf, bw, br) {
  if (f > bf) return true;
  if (f === bf && w > bw) return true;
  if (f === bf && w === bw && r < br) return true;
  return false;
}

function optimizeCore(ourPool, enemies) {
  const n = ourPool.length;
  const pool = [...ourPool].sort((a, b) => b.power - a.power);
  const poolAsc = [...ourPool].sort((a, b) => a.power - b.power);
  let bF = 0, bW = 0, bR = 999, bL = null, bD = null;

  const tryC = (lanes) => {
    const r = evaluate(lanes, enemies);
    if (isBetter(r.flags, r.wins, r.risk, bF, bW, bR)) {
      bF = r.flags; bW = r.wins; bR = r.risk;
      bL = lanes.map(l => [...l]); bD = r.details;
    }
  };

  // Phase 1: heuristic splits
  for (let sac = 0; sac < 3; sac++) {
    const wl = [0, 1, 2].filter(i => i !== sac);
    for (let ns = Math.max(4, n - 20); ns < Math.min(n - 10, 11); ns++) {
      const nr = n - ns;
      for (let n1 = Math.max(5, nr - 10); n1 <= Math.min(10, nr - 5); n1++) {
        const n2 = nr - n1;
        if (n2 < 5 || n2 > 10) continue;
        const sacT = poolAsc.slice(0, ns);
        const rem = pool.slice(0, n - ns);
        const makeSplit = (fn) => { let t1 = [], t2 = []; fn(rem, t1, t2, n1, n2); return [t1, t2]; };
        const splits = [
          makeSplit((r, a, b, na, nb) => r.forEach((p, i) => { if (a.length < na && b.length < nb) (i % 2 === 0 ? a : b).push(p); else if (a.length < na) a.push(p); else b.push(p); })),
          makeSplit((r, a, b, na, nb) => r.forEach((p, i) => { if (a.length < na && b.length < nb) (i % 2 === 1 ? a : b).push(p); else if (a.length < na) a.push(p); else b.push(p); })),
          [rem.slice(0, n1), rem.slice(n1)],
          [rem.slice(n2), rem.slice(0, n2)],
          makeSplit((r, a, b, na, nb) => r.forEach((p, i) => { if (a.length < na && b.length < nb) ((i >> 1) % 2 === 0 ? a : b).push(p); else if (a.length < na) a.push(p); else b.push(p); })),
          makeSplit((r, a, b, na, nb) => { const e1 = [...enemies[wl[0]]].sort((x, y) => x.power - y.power); const e2 = [...enemies[wl[1]]].sort((x, y) => x.power - y.power); r.forEach(p => { if (a.length >= na) b.push(p); else if (b.length >= nb) a.push(p); else { const b1 = e1.filter(e => p.power > e.power).length; const b2 = e2.filter(e => p.power > e.power).length; (b1 >= b2 ? a : b).push(p); } }); }),
        ];
        for (const [g1, g2] of splits) {
          let la = [null, null, null]; la[sac] = [...sacT]; la[wl[0]] = [...g1]; la[wl[1]] = [...g2]; tryC(la);
          la = [null, null, null]; la[sac] = [...sacT]; la[wl[0]] = [...g2]; la[wl[1]] = [...g1]; tryC(la);
        }
      }
    }
  }

  if (!bL) return null;

  // Phase 2: 1-on-1 swaps
  const lanes = bL.map(l => [...l]);
  const updateBest = () => { const r = evaluate(lanes, enemies); bF = r.flags; bW = r.wins; bR = r.risk; bD = r.details; bL = lanes.map(l => [...l]); };
  for (let round = 0; round < 10; round++) {
    let imp = false;
    for (let la = 0; la < 3; la++) for (let lb = la + 1; lb < 3; lb++)
      for (let i = 0; i < lanes[la].length; i++) for (let j = 0; j < lanes[lb].length; j++) {
        [lanes[la][i], lanes[lb][j]] = [lanes[lb][j], lanes[la][i]];
        const r = evaluate(lanes, enemies);
        if (isBetter(r.flags, r.wins, r.risk, bF, bW, bR)) { bF = r.flags; bW = r.wins; bR = r.risk; bD = r.details; imp = true; }
        else { [lanes[la][i], lanes[lb][j]] = [lanes[lb][j], lanes[la][i]]; }
      }
    if (!imp) break;
  }

  // Phase 3: 2-on-2 swaps
  for (let round = 0; round < 3; round++) {
    let imp = false;
    for (let la = 0; la < 3; la++) for (let lb = la + 1; lb < 3; lb++)
      for (let i1 = 0; i1 < lanes[la].length; i1++) for (let i2 = i1 + 1; i2 < lanes[la].length; i2++)
        for (let j1 = 0; j1 < lanes[lb].length; j1++) for (let j2 = j1 + 1; j2 < lanes[lb].length; j2++) {
          [lanes[la][i1], lanes[lb][j1]] = [lanes[lb][j1], lanes[la][i1]];
          [lanes[la][i2], lanes[lb][j2]] = [lanes[lb][j2], lanes[la][i2]];
          const r = evaluate(lanes, enemies);
          if (isBetter(r.flags, r.wins, r.risk, bF, bW, bR)) { bF = r.flags; bW = r.wins; bR = r.risk; bD = r.details; imp = true; }
          else { [lanes[la][i2], lanes[lb][j2]] = [lanes[lb][j2], lanes[la][i2]]; [lanes[la][i1], lanes[lb][j1]] = [lanes[lb][j1], lanes[la][i1]]; }
        }
    if (!imp) break;
  }
  bL = lanes.map(l => [...l]);

  return { flags: bF, wins: bW, risk: bR, lanes: bL, details: bD };
}

function fullOptimize(ourPool, enemies) {
  const core = optimizeCore(ourPool, enemies);
  if (!core) return null;

  // Robustness
  const enemyAll = [...enemies[0], ...enemies[1], ...enemies[2]].sort((a, b) => b.power - a.power);
  const eG = [enemyAll.slice(0, 10), enemyAll.slice(10, 20), enemyAll.slice(20)];
  const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const gn = ["ТОП", "СЕР", "СЛБ"];
  const rob = perms.map(p => { const el = [eG[p[0]], eG[p[1]], eG[p[2]]]; const r = evaluate(core.lanes, el); return { label: `${gn[p[0]]}→${gn[p[1]]}→${gn[p[2]]}`, ...r }; });

  // Granular
  const strong5 = enemyAll.slice(0, 5);
  const gran = [];
  for (const pl of strong5) {
    const origL = enemies.findIndex(l => l.some(p => p.name === pl.name));
    if (origL < 0) continue;
    for (let tgt = 0; tgt < 3; tgt++) {
      if (tgt === origL) continue;
      const ne = enemies.map(l => [...l]);
      const wkI = ne[tgt].reduce((mi, p, i, a) => p.power < a[mi].power ? i : mi, 0);
      const sw = ne[tgt][wkI];
      ne[origL] = ne[origL].filter(p => p.name !== pl.name); ne[origL].push(sw);
      ne[tgt][wkI] = pl;
      const r = evaluate(core.lanes, ne);
      gran.push({ label: `${pl.name}(${Math.round(pl.power / 1000)}K) ${LN[origL]}→${LN[tgt]}`, swap: `↔${sw.name}(${Math.round(sw.power / 1000)}K)`, ...r });
    }
  }

  const lP = core.details.map(d => calcProb(d));
  return { ...core, robustness: rob, granular: gran, laneProbs: lP, overallProb: lP.reduce((a, b) => a * (b || 1), 1) };
}

function blindOptimize(ourPool, enemyTotals, enemyCounts) {
  // For each lane, generate multiple enemy scenarios
  // Run optimizer against each, then find the lineup that works best across all
  const scenarios = [];
  for (let i = 0; i < 3; i++) {
    scenarios.push(generateScenarios(enemyTotals[i], enemyCounts[i], LN[i]));
  }

  // Cross-product: 4 scenarios per lane × 3 lanes = up to 64 combos, but we test key ones
  const testCases = [];
  for (const s0 of scenarios[0]) for (const s1 of scenarios[1]) for (const s2 of scenarios[2]) {
    testCases.push({ label: `${s0.name}/${s1.name}/${s2.name}`, enemies: [s0.players, s1.players, s2.players] });
  }

  // Find lineup that maximizes MINIMUM flags across all scenarios
  // Use the "linear" scenario as primary, optimize, then test others
  const primaryEnemies = [scenarios[0][1].players, scenarios[1][1].players, scenarios[2][1].players];
  const primary = optimizeCore(ourPool, primaryEnemies);
  if (!primary) return null;

  // Test this lineup against all scenarios
  const results = testCases.map(tc => {
    const r = evaluate(primary.lanes, tc.enemies);
    return { ...tc, ...r };
  });

  const minFlags = Math.min(...results.map(r => r.flags));
  const minWins = Math.min(...results.filter(r => r.flags === minFlags).map(r => r.wins));
  const avgWins = Math.round(results.reduce((s, r) => s + r.wins, 0) / results.length);

  const lP = primary.details.map(d => calcProb(d));

  return { ...primary, blindResults: results, minFlags, minWins, avgWins, laneProbs: lP, overallProb: lP.reduce((a, b) => a * (b || 1), 1) };
}

// UI Components
function FightRow({ f, i, isLast }) {
  const w = f.winner === "us", auto = !f.our || !f.enemy, close = !auto && f.pct < RISK;
  const bg = isLast ? "rgba(186,117,23,0.12)" : (close ? (w ? "rgba(250,238,218,0.4)" : "rgba(252,235,235,0.4)") : undefined);
  return (
    <tr style={{ background: bg }}>
      <td style={{ color: "#888", width: 22, textAlign: "right", padding: "3px 5px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 12 }}>{i + 1}</td>
      <td style={{ textAlign: "right", padding: "3px 5px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 12 }}>{f.our ? `${f.our.name} (${Math.round(f.our.power / 1000)}K)` : ""}</td>
      <td style={{ textAlign: "center", color: "#888", padding: "3px 5px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 11 }}>vs</td>
      <td style={{ padding: "3px 5px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 12, fontStyle: auto ? "italic" : undefined, color: auto ? "var(--color-text-tertiary)" : undefined }}>{f.enemy ? `${f.enemy.name} (${Math.round(f.enemy.power / 1000)}K)` : "— нет —"}</td>
      <td style={{ padding: "3px 5px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontWeight: 500, fontSize: 11, color: w ? "#0F6E56" : "#A32D2D", width: 115 }}>
        {auto ? "AUTO" : (w ? "WIN" : "LOSE")}
        {close && !auto && <span style={{ fontSize: 10, color: "#854F0B", marginLeft: 2 }}>⚡{w ? "+" : "-"}{Math.round(Math.abs(f.margin) / 1000)}K</span>}
        {isLast && <span style={{ fontSize: 10, color: "#854F0B", fontWeight: 600, marginLeft: 3 }}>ФЛАГ</span>}
      </td>
    </tr>
  );
}

function LaneBlock({ detail, name, team, enemy, prob }) {
  const { won, ow, ew, fights, risky } = detail;
  const oT = team.reduce((s, p) => s + p.power, 0), eT = enemy.reduce((s, p) => s + p.power, 0), d = oT - eT;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: won ? "rgba(29,158,117,0.1)" : "rgba(226,75,74,0.08)", marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: won ? "#085041" : "#791F1F" }}>{won ? "🏴" : "❌"} {name} ({team.length}vs{enemy.length})</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: won ? "#0F6E56" : "#A32D2D" }}>{ow}:{ew}</span>
        {won && risky > 0 && <span style={{ fontSize: 11, color: "#854F0B", background: "rgba(186,117,23,0.12)", padding: "1px 7px", borderRadius: 4 }}>⚡{risky} рисков.</span>}
        {won && prob !== undefined && <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: "auto" }}>{Math.round(prob * 100)}%</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, padding: "0 3px" }}>Тотал: {oT.toLocaleString()} vs {eT.toLocaleString()} ({d > 0 ? "+" : ""}{d.toLocaleString()})</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["#", "Наш", "vs", "Враг", "Итог"].map((h, i) => (
          <th key={i} style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 400, textAlign: i === 1 ? "right" : (i === 2 ? "center" : "left"), padding: "3px 5px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>{h}</th>
        ))}</tr></thead>
        <tbody>{fights.map((f, i) => <FightRow key={i} f={f} i={i} isLast={i === fights.length - 1} />)}</tbody>
      </table>
    </div>
  );
}

function RobTable({ data, label }) {
  return (<div>
    <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 8 }}>{label}</div>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr>{["Сценарий", "Фл", "Побед", "ВЛ", "СЛ", "НЛ", "Итог"].map((h, i) => (
        <th key={i} style={{ textAlign: i === 0 || i === 6 ? "left" : "center", padding: "5px 6px", borderBottom: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-tertiary)", fontWeight: 400, fontSize: 11 }}>{h}</th>
      ))}</tr></thead>
      <tbody>{data.sort((a, b) => a.flags - b.flags || a.wins - b.wins).map((r, i) => (
        <tr key={i} style={{ background: r.flags < 2 ? "rgba(226,75,74,0.04)" : undefined }}>
          <td style={{ padding: "5px 6px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 11 }}>{r.label}{r.swap ? <span style={{ color: "var(--color-text-tertiary)" }}> {r.swap}</span> : ""}</td>
          <td style={{ padding: "5px 6px", borderBottom: "0.5px solid var(--color-border-tertiary)", textAlign: "center", fontWeight: 500 }}>{r.flags}</td>
          <td style={{ padding: "5px 6px", borderBottom: "0.5px solid var(--color-border-tertiary)", textAlign: "center" }}>{r.wins}</td>
          {[0, 1, 2].map(l => (<td key={l} style={{ padding: "5px 6px", borderBottom: "0.5px solid var(--color-border-tertiary)", textAlign: "center", color: r.details[l].won ? "#0F6E56" : "#A32D2D", fontWeight: 500, fontSize: 11 }}>{r.details[l].won ? "🏴" : "❌"}{r.details[l].ow}:{r.details[l].ew}</td>))}
          <td style={{ padding: "5px 6px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontWeight: 500, fontSize: 11, color: r.flags >= 2 ? "#0F6E56" : (r.flags === 1 ? "#854F0B" : "#A32D2D") }}>{r.flags >= 2 ? "✅" : (r.flags === 1 ? "🤝" : "❌")}</td>
        </tr>
      ))}</tbody>
    </table>
    <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>
      ✅{data.filter(r => r.flags >= 2).length} 🤝{data.filter(r => r.flags === 1).length} ❌{data.filter(r => r.flags === 0).length} из {data.length}
    </div>
  </div>);
}

export default function App() {
  const [mode, setMode] = useState("detailed");
  const [ourText, setOurText] = useState(DEFAULT_OUR);
  const [enemyTexts, setEnemyTexts] = useState(DEFAULT_ENEMY_DETAILED);
  const [blindTotals, setBlindTotals] = useState(["4611857", "4957118", "4389356"]);
  const [blindCounts, setBlindCounts] = useState(["10", "10", "10"]);
  const [result, setResult] = useState(null);
  const [computing, setComputing] = useState(false);
  const [tab, setTab] = useState(0);

  const setET = (i, v) => { const n = [...enemyTexts]; n[i] = v; setEnemyTexts(n); };
  const setBT = (i, v) => { const n = [...blindTotals]; n[i] = v; setBlindTotals(n); };
  const setBC = (i, v) => { const n = [...blindCounts]; n[i] = v; setBlindCounts(n); };

  const run = useCallback(() => {
    setComputing(true);
    setTimeout(() => {
      try {
        const ourPool = parse(ourText);
        if (ourPool.length < 12) { alert("Минимум 12 игроков"); setComputing(false); return; }
        let res;
        if (mode === "detailed") {
          const enemies = enemyTexts.map(t => parse(t));
          if (enemies.some(e => e.length < 1)) { alert("Заполни все линии врага"); setComputing(false); return; }
          res = fullOptimize(ourPool, enemies);
        } else {
          const totals = blindTotals.map(t => parseInt(t));
          const counts = blindCounts.map(c => parseInt(c));
          if (totals.some(isNaN) || counts.some(isNaN)) { alert("Введи числа"); setComputing(false); return; }
          res = blindOptimize(ourPool, totals, counts);
          res._blind = true;
        }
        setResult(res); setTab(0);
      } catch (e) { alert("Ошибка: " + e.message); }
      setComputing(false);
    }, 50);
  }, [ourText, enemyTexts, blindTotals, blindCounts, mode]);

  const tabs = mode === "detailed" ? ["Бои", "Робастность", "Точечные свапы", "Составы"] : ["Бои", "Сценарии", "Составы"];

  return (
    <div style={{ padding: "1rem 0", maxWidth: 820 }}>
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: 16 }}>
        {[["detailed", "Разведка (знаем игроков)"], ["blind", "Слепой (только тотал)"]].map(([m, l]) => (
          <button key={m} onClick={() => { setMode(m); setResult(null); }} style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", border: "none", background: "none", color: mode === m ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: mode === m ? 500 : 400, borderBottom: mode === m ? "2px solid #0F6E56" : "2px solid transparent" }}>{l}</button>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Наши игроки</div>
        <textarea value={ourText} onChange={e => setOurText(e.target.value)} rows={6} style={{ width: "100%", fontSize: 12, fontFamily: "var(--font-mono)", padding: 8, borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical" }} />
      </div>

      {mode === "detailed" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i}>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>{LN[i]} врага</div>
              <textarea value={enemyTexts[i]} onChange={e => setET(i, e.target.value)} rows={10} style={{ width: "100%", fontSize: 11, fontFamily: "var(--font-mono)", padding: 6, borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical" }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i}>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>{LN[i]} врага</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 2 }}>Тотал мощности:</div>
              <input value={blindTotals[i]} onChange={e => setBT(i, e.target.value)} style={{ width: "100%", fontSize: 13, padding: 6, borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", marginBottom: 6, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 2 }}>Кол-во игроков:</div>
              <input value={blindCounts[i]} onChange={e => setBC(i, e.target.value)} style={{ width: "100%", fontSize: 13, padding: 6, borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
            </div>
          ))}
        </div>
      )}

      <button onClick={run} disabled={computing} style={{ padding: "10px 32px", fontSize: 14, fontWeight: 500, borderRadius: 8, cursor: computing ? "wait" : "pointer", background: computing ? "var(--color-background-secondary)" : "#0F6E56", color: computing ? "var(--color-text-secondary)" : "#fff", border: "none", marginBottom: 24, width: "100%" }}>
        {computing ? "Считаю..." : "Рассчитать"}
      </button>

      {result && (<div>
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {[
            { l: "Расклад", v: result.lanes.map(l => l.length).join("–") },
            { l: "Флаги", v: `${result.flags}/3`, c: "#0F6E56" },
            { l: "Побед", v: result.wins },
            { l: "Надёжность", v: `${Math.round((result.overallProb || 1) * 100)}%`, c: (result.overallProb || 1) > 0.9 ? "#0F6E56" : (result.overallProb || 1) > 0.7 ? "#854F0B" : "#A32D2D" },
            ...(result._blind ? [{ l: "Мин.флагов", v: result.minFlags, c: result.minFlags >= 2 ? "#0F6E56" : "#854F0B" }] : []),
          ].map((m, i) => (
            <div key={i} style={{ flex: 1, minWidth: 80, background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{m.l}</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginTop: 1, color: m.c }}>{m.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: 14, flexWrap: "wrap" }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", border: "none", background: "none", color: tab === i ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: tab === i ? 500 : 400, borderBottom: tab === i ? "2px solid #0F6E56" : "2px solid transparent" }}>{t}</button>
          ))}
        </div>

        {tab === 0 && <div>
          {[0, 1, 2].map(i => {
            const enemy = mode === "detailed" ? parse(enemyTexts[i]) : generateEstimatedEnemies(parseInt(blindTotals[i]), parseInt(blindCounts[i]), LN[i]);
            return <LaneBlock key={i} detail={result.details[i]} name={LN[i]} team={result.lanes[i]} enemy={enemy} prob={result.laneProbs?.[i]} />;
          })}
        </div>}

        {tab === 1 && mode === "detailed" && result.robustness && <RobTable data={result.robustness} label="Враг перетасовывает блоками (ТОП-10 / СЕР-10 / СЛБ-10):" />}

        {tab === 1 && mode === "blind" && result.blindResults && <RobTable data={result.blindResults.map(r => ({ ...r, label: r.label }))} label="Результаты против разных моделей распределения врага:" />}

        {tab === 2 && mode === "detailed" && result.granular && <RobTable data={result.granular} label="Враг перебрасывает одного сильного на другую линию:" />}

        {tab === (mode === "detailed" ? 3 : 2) && <div>
          {[0, 1, 2].map(i => {
            const team = [...result.lanes[i]].sort((a, b) => a.power - b.power);
            const won = result.details[i].won;
            return (
              <div key={i} style={{ marginBottom: 14, padding: 10, borderRadius: 8, background: "var(--color-background-secondary)" }}>
                <div style={{ fontWeight: 500, marginBottom: 4, color: won ? "#0F6E56" : "#A32D2D", fontSize: 14 }}>{won ? "🏴" : "❌"} {LN[i]} ({team.length})</div>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  {team.map((p, j) => (<span key={j} style={{ display: "inline-block", background: "var(--color-background-primary)", padding: "1px 7px", borderRadius: 4, margin: "1px 2px", fontSize: 12 }}>{p.name} <span style={{ color: "var(--color-text-tertiary)" }}>{Math.round(p.power / 1000)}K</span></span>))}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 8, marginTop: 6, fontFamily: "var(--font-mono)" }}>
            {[0, 1, 2].map(i => {
              const t = [...result.lanes[i]].sort((a, b) => a.power - b.power);
              return <div key={i}>{LN[i]}: {t.map(p => p.name).join(", ")}</div>;
            })}
          </div>
        </div>}
      </div>)}
    </div>
  );
}
