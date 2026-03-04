import { useState, useMemo, useCallback } from 'react';

// --- DATA ARRAYS ---
// Index i represents cost/time (in days) to go from Level i to i+1
const BM_TIMES = [0, 0.5, 0.5, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 7, 7, 7, 7, 7];
const BM_COSTS = [0, 1000000, 1100000, 1200000, 1300000, 1500000, 1600000, 1700000, 1800000, 1900000, 2100000, 2200000, 2300000, 2400000, 2500000, 2600000, 2700000, 2800000, 2900000, 3000000, 3100000, 3200000, 3300000, 3400000, 3500000, 3600000, 3700000, 3800000, 3900000, 4000000, 4100000, 4200000, 4300000, 4400000, 4500000];

const BC_TIMES: number[] = [];
const BC_COSTS: number[] = [];
for (let i = 0; i <= 35; i++) {
  if (i < 15) { BC_TIMES.push(0); BC_COSTS.push(0); }
  else if (i < 25) { BC_TIMES.push(5); BC_COSTS.push(BM_COSTS[i]); }
  else if (i < 30) { BC_TIMES.push(6); BC_COSTS.push(BM_COSTS[i]); }
  else if (i < 35) { BC_TIMES.push(7); BC_COSTS.push(BM_COSTS[i]); }
  else { BC_TIMES.push(0); BC_COSTS.push(0); }
}

const TARGET_LEVEL = 45;
const GOLD_PASS_DISCOUNT = 0.20;
const BUILDER_POTION_HOURS = 9;
const CT_POTION_DURATION = 30; // minutes

interface LevelDetail {
  from: number;
  to: number;
  time: number;
  cost: number;
}

interface HeroUpgradePlan {
  from: number;
  to: number;
  totalTime: number;
  totalCost: number;
  levels: number;
  details: LevelDetail[];
}

interface OptimalResult {
  bmPlan: HeroUpgradePlan;
  bcPlan: HeroUpgradePlan;
  bmOffset: number;
  bcOffset: number;
  makespan: number;
  totalBuilderTime: number;
  totalCost: number;
  unlockBC: boolean;
  unlockCost: number;
  message?: string;
}

function sumRange(arr: number[], from: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (from + i < arr.length) total += arr[from + i];
  }
  return total;
}

function getDetails(timesArr: number[], costsArr: number[], from: number, count: number, gpDiscount: number): LevelDetail[] {
  const details: LevelDetail[] = [];
  for (let i = 0; i < count; i++) {
    const idx = from + i;
    if (idx < timesArr.length) {
      details.push({
        from: idx,
        to: idx + 1,
        time: timesArr[idx] * (1 - gpDiscount),
        cost: costsArr[idx],
      });
    }
  }
  return details;
}

interface CalcInput {
  currentBM: number;
  currentBC: number;
  bmUpgrading: boolean;
  bmRemaining: number;
  bcUpgrading: boolean;
  bcRemaining: number;
  goldPass: boolean;
}

function calculateOptimalPath(input: CalcInput): OptimalResult {
  const { currentBM, currentBC, bmUpgrading, bmRemaining, bcUpgrading, bcRemaining, goldPass } = input;
  const gpDiscount = goldPass ? GOLD_PASS_DISCOUNT : 0;

  const effectiveBM = bmUpgrading ? Math.min(currentBM + 1, 35) : currentBM;
  const bmOffset = bmUpgrading ? bmRemaining : 0;

  let effectiveBC = currentBC;
  let bcOffset = bcUpgrading ? bcRemaining : 0;
  let unlockBC = false;
  let unlockCost = 0;

  if (bcUpgrading) {
    effectiveBC = Math.min(currentBC + 1, 35);
  }

  if (currentBC === 0 && !bcUpgrading) {
    effectiveBC = 15;
    unlockBC = true;
    unlockCost = 2500000;
  }

  const needed = TARGET_LEVEL - effectiveBM - effectiveBC;

  if (needed <= 0) {
    return {
      bmPlan: { from: effectiveBM, to: effectiveBM, totalTime: 0, totalCost: 0, levels: 0, details: [] },
      bcPlan: { from: effectiveBC, to: effectiveBC, totalTime: 0, totalCost: 0, levels: 0, details: [] },
      bmOffset,
      bcOffset,
      makespan: Math.max(bmOffset, bcOffset),
      totalBuilderTime: 0,
      totalCost: unlockCost,
      unlockBC,
      unlockCost,
      message: bmUpgrading || bcUpgrading
        ? "Just finish your current upgrade(s) and you're done! 🎉"
        : unlockBC
          ? "Just unlock the Battle Copter and you're done! 🎉"
          : "You already have enough levels! 🎉",
    };
  }

  const maxBMUps = Math.min(needed, 35 - effectiveBM);
  const maxBCUps = Math.min(needed, 35 - effectiveBC);

  let bestMakespan = Infinity;
  let bestCost = Infinity;
  let bestBMUps = 0;
  let bestBCUps = 0;

  for (let bmUps = 0; bmUps <= maxBMUps; bmUps++) {
    const bcUps = needed - bmUps;
    if (bcUps < 0 || bcUps > maxBCUps) continue;

    const bmChainTime = bmOffset + sumRange(BM_TIMES, effectiveBM, bmUps) * (1 - gpDiscount);
    const bcChainTime = bcOffset + sumRange(BC_TIMES, effectiveBC, bcUps) * (1 - gpDiscount);
    const makespan = Math.max(bmChainTime, bcChainTime);

    const bmCost = sumRange(BM_COSTS, effectiveBM, bmUps);
    const bcCost = sumRange(BC_COSTS, effectiveBC, bcUps);
    const totalCost = bmCost + bcCost;

    if (makespan < bestMakespan || (makespan === bestMakespan && totalCost < bestCost)) {
      bestMakespan = makespan;
      bestCost = totalCost;
      bestBMUps = bmUps;
      bestBCUps = bcUps;
    }
  }

  const bmPlanTime = sumRange(BM_TIMES, effectiveBM, bestBMUps) * (1 - gpDiscount);
  const bcPlanTime = sumRange(BC_TIMES, effectiveBC, bestBCUps) * (1 - gpDiscount);

  const bmPlan: HeroUpgradePlan = {
    from: effectiveBM,
    to: effectiveBM + bestBMUps,
    totalTime: bmPlanTime,
    totalCost: sumRange(BM_COSTS, effectiveBM, bestBMUps),
    levels: bestBMUps,
    details: getDetails(BM_TIMES, BM_COSTS, effectiveBM, bestBMUps, gpDiscount),
  };

  const bcPlan: HeroUpgradePlan = {
    from: effectiveBC,
    to: effectiveBC + bestBCUps,
    totalTime: bcPlanTime,
    totalCost: sumRange(BC_COSTS, effectiveBC, bestBCUps),
    levels: bestBCUps,
    details: getDetails(BC_TIMES, BC_COSTS, effectiveBC, bestBCUps, gpDiscount),
  };

  const totalBuilderTime = bmOffset + bmPlan.totalTime + bcOffset + bcPlan.totalTime;

  return {
    bmPlan,
    bcPlan,
    bmOffset,
    bcOffset,
    makespan: bestMakespan,
    totalBuilderTime,
    totalCost: bmPlan.totalCost + bcPlan.totalCost + unlockCost,
    unlockBC,
    unlockCost,
  };
}

// --- Clock Tower Savings Calculator ---
interface CTSavings {
  adjustedMakespan: number; // in days
  totalSavedHours: number;
  naturalBoosts: number;
  naturalSavedHours: number;
  potionSavedHours: number;
}

function calculateCTSavings(
  makespanDays: number,
  ctDurationMin: number,
  boostsPerDay: number,
  ctPotions: number
): CTSavings {
  if (makespanDays <= 0) {
    return { adjustedMakespan: 0, totalSavedHours: 0, naturalBoosts: 0, naturalSavedHours: 0, potionSavedHours: 0 };
  }

  const makespanHours = makespanDays * 24;

  // Each natural boost: 10x speed for ctDurationMin → saves 9 * ctDurationMin minutes
  const savingsPerNaturalBoostHours = (9 * ctDurationMin) / 60;
  // Each potion: 10x speed for 30 min → saves 9 * 30 = 270 min = 4.5 hours
  const savingsPerPotionHours = (9 * CT_POTION_DURATION) / 60;

  // Potion savings (flat, user decides to use them)
  const potionSavedHours = ctPotions * savingsPerPotionHours;

  // Natural boosts: boostsPerDay * adjustedDays
  // adjustedHours = makespanHours - potionSavedHours - naturalBoosts * savingsPerNaturalBoostHours
  // naturalBoosts = boostsPerDay * adjustedHours / 24
  // Solve: adjustedHours = makespanHours - potionSavedHours - (boostsPerDay * adjustedHours / 24) * savingsPerNaturalBoostHours
  // adjustedHours * (1 + boostsPerDay * savingsPerNaturalBoostHours / 24) = makespanHours - potionSavedHours
  // adjustedHours = (makespanHours - potionSavedHours) / (1 + boostsPerDay * savingsPerNaturalBoostHours / 24)

  const dailyNaturalSavingsHours = boostsPerDay * savingsPerNaturalBoostHours;
  const afterPotions = Math.max(0, makespanHours - potionSavedHours);
  const adjustedHours = afterPotions / (1 + dailyNaturalSavingsHours / 24);
  const adjustedMakespan = Math.max(0, adjustedHours / 24);

  const naturalBoosts = Math.floor(boostsPerDay * adjustedMakespan);
  const naturalSavedHours = naturalBoosts * savingsPerNaturalBoostHours;
  const totalSavedHours = Math.min(makespanHours, naturalSavedHours + potionSavedHours);

  return {
    adjustedMakespan,
    totalSavedHours,
    naturalBoosts,
    naturalSavedHours,
    potionSavedHours: Math.min(potionSavedHours, makespanHours),
  };
}

function formatTime(daysFloat: number): string {
  if (daysFloat <= 0) return 'Instant';
  const totalHours = Math.round(daysFloat * 24);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  return parts.join(' ') || '0h';
}

function formatTimeHours(hours: number): string {
  if (hours <= 0) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '0h';
}

function formatElixir(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toLocaleString();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Toggle Switch Component ---
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
        style={{ background: checked ? '#d946ef' : '#475569' }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 shadow"
          style={{
            background: '#fff',
            left: checked ? '22px' : '2px',
          }}
        />
      </div>
      <span className="text-sm font-bold" style={{ color: checked ? '#d946ef' : '#94a3b8' }}>
        {label}
      </span>
    </label>
  );
}

// --- Time Input Component (FIXED - string-based state) ---
function TimeInput({
  days,
  hours,
  onDaysChange,
  onHoursChange,
  maxDays = 30,
}: {
  days: number;
  hours: number;
  onDaysChange: (v: number) => void;
  onHoursChange: (v: number) => void;
  maxDays?: number;
}) {
  const [daysStr, setDaysStr] = useState(String(days));
  const [hoursStr, setHoursStr] = useState(String(hours));

  const [prevDays, setPrevDays] = useState(days);
  const [prevHours, setPrevHours] = useState(hours);
  if (days !== prevDays) {
    setDaysStr(String(days));
    setPrevDays(days);
  }
  if (hours !== prevHours) {
    setHoursStr(String(hours));
    setPrevHours(hours);
  }

  const handleDaysChange = (val: string) => {
    if (val === '') {
      setDaysStr('');
      onDaysChange(0);
      return;
    }
    const num = parseInt(val);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(maxDays, num));
      setDaysStr(String(clamped));
      onDaysChange(clamped);
    }
  };

  const handleHoursChange = (val: string) => {
    if (val === '') {
      setHoursStr('');
      onHoursChange(0);
      return;
    }
    const num = parseInt(val);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(23, num));
      setHoursStr(String(clamped));
      onHoursChange(clamped);
    }
  };

  const handleDaysBlur = () => {
    if (daysStr === '') { setDaysStr('0'); onDaysChange(0); }
  };

  const handleHoursBlur = () => {
    if (hoursStr === '') { setHoursStr('0'); onHoursChange(0); }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs font-bold" style={{ color: '#94a3b8' }}>⏳ Remaining:</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={maxDays}
          value={daysStr}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleDaysChange(e.target.value)}
          onBlur={handleDaysBlur}
          className="w-14 px-2 py-1.5 rounded-lg text-center text-sm font-bold outline-none text-white focus:ring-2 focus:ring-fuchsia-500"
          style={{ background: '#0f172a', border: '1px solid #475569' }}
        />
        <span className="text-xs font-bold" style={{ color: '#94a3b8' }}>d</span>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={23}
          value={hoursStr}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleHoursChange(e.target.value)}
          onBlur={handleHoursBlur}
          className="w-14 px-2 py-1.5 rounded-lg text-center text-sm font-bold outline-none text-white focus:ring-2 focus:ring-fuchsia-500"
          style={{ background: '#0f172a', border: '1px solid #475569' }}
        />
        <span className="text-xs font-bold" style={{ color: '#94a3b8' }}>h</span>
      </div>
    </div>
  );
}

// --- Number Input with string state (for 0-bug fix) ---
function NumInput({
  value,
  onChange,
  min = 0,
  max = 99,
  width = 'w-16',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  width?: string;
}) {
  const [str, setStr] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setStr(String(value));
    setPrev(value);
  }

  const handleChange = (val: string) => {
    if (val === '') {
      setStr('');
      onChange(min);
      return;
    }
    const num = parseInt(val);
    if (!isNaN(num)) {
      const clamped = Math.max(min, Math.min(max, num));
      setStr(String(clamped));
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    if (str === '') { setStr(String(min)); onChange(min); }
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={str}
      onFocus={(e) => e.target.select()}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className={`${width} px-2 py-1.5 rounded-lg text-center text-sm font-bold outline-none text-white focus:ring-2 focus:ring-fuchsia-500`}
      style={{ background: '#0f172a', border: '1px solid #475569' }}
    />
  );
}

// --- Collapsible Section ---
function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 px-1 text-sm font-bold cursor-pointer bg-transparent border-none outline-none"
        style={{ color: '#94a3b8' }}
      >
        <span>{title}</span>
        <span className="transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: '#64748b' }}>
          ▾
        </span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

export default function App() {
  const [bmLevel, setBmLevel] = useState(15);
  const [bcLevel, setBcLevel] = useState(15);

  const [bmUpgrading, setBmUpgrading] = useState(false);
  const [bmRemDays, setBmRemDays] = useState(0);
  const [bmRemHours, setBmRemHours] = useState(0);

  const [bcUpgrading, setBcUpgrading] = useState(false);
  const [bcRemDays, setBcRemDays] = useState(0);
  const [bcRemHours, setBcRemHours] = useState(0);

  const [goldPass, setGoldPass] = useState(false);

  // Clock Tower state
  const [ctEnabled, setCtEnabled] = useState(false);
  const [ctDuration, setCtDuration] = useState(30); // 14-32 min
  const [ctBoostsPerDay, setCtBoostsPerDay] = useState(3);
  const [ctPotions, setCtPotions] = useState(0);

  const canBmUpgrade = bmLevel < 35;
  const canBcUpgrade = bcLevel >= 15 && bcLevel < 35;

  const effectiveBmUpgrading = bmUpgrading && canBmUpgrade;
  const effectiveBcUpgrading = bcUpgrading && canBcUpgrade;

  const bmRemaining = effectiveBmUpgrading ? bmRemDays + bmRemHours / 24 : 0;
  const bcRemaining = effectiveBcUpgrading ? bcRemDays + bcRemHours / 24 : 0;

  const result = useMemo(
    () =>
      calculateOptimalPath({
        currentBM: bmLevel,
        currentBC: bcLevel,
        bmUpgrading: effectiveBmUpgrading,
        bmRemaining,
        bcUpgrading: effectiveBcUpgrading,
        bcRemaining,
        goldPass,
      }),
    [bmLevel, bcLevel, effectiveBmUpgrading, bmRemaining, effectiveBcUpgrading, bcRemaining, goldPass]
  );

  // Calculate Clock Tower savings
  const ctSavings = useMemo(() => {
    if (!ctEnabled || result.makespan <= 0) {
      return { adjustedMakespan: result.makespan, totalSavedHours: 0, naturalBoosts: 0, naturalSavedHours: 0, potionSavedHours: 0 };
    }
    return calculateCTSavings(result.makespan, ctDuration, ctBoostsPerDay, ctPotions);
  }, [ctEnabled, result.makespan, ctDuration, ctBoostsPerDay, ctPotions]);

  const effectiveMakespan = ctEnabled ? ctSavings.adjustedMakespan : result.makespan;

  const handleReset = useCallback(() => {
    setBmLevel(15);
    setBcLevel(15);
    setBmUpgrading(false);
    setBmRemDays(0);
    setBmRemHours(0);
    setBcUpgrading(false);
    setBcRemDays(0);
    setBcRemHours(0);
    setGoldPass(false);
    setCtEnabled(false);
    setCtDuration(30);
    setCtBoostsPerDay(3);
    setCtPotions(0);
  }, []);

  const effectiveBM = effectiveBmUpgrading ? Math.min(bmLevel + 1, 35) : bmLevel;
  const effectiveBC = effectiveBcUpgrading
    ? Math.min(bcLevel + 1, 35)
    : bcLevel === 0
      ? 15
      : bcLevel;
  const currentCombined = bmLevel + (bcLevel === 0 ? 0 : bcLevel);
  const afterCombined = effectiveBM + effectiveBC;
  const finalCombined = result.bmPlan.to + result.bcPlan.to;
  const progressPercent = Math.min((afterCombined / TARGET_LEVEL) * 100, 100);

  const bmFullTime = result.bmOffset + result.bmPlan.totalTime;
  const bcFullTime = result.bcOffset + result.bcPlan.totalTime;
  const bmBarPercent = result.makespan > 0 ? (bmFullTime / result.makespan) * 100 : 0;
  const bcBarPercent = result.makespan > 0 ? (bcFullTime / result.makespan) * 100 : 0;
  const bmOffsetPercent = result.makespan > 0 ? (result.bmOffset / result.makespan) * 100 : 0;
  const bcOffsetPercent = result.makespan > 0 ? (result.bcOffset / result.makespan) * 100 : 0;

  // Estimated completion date using effective (CT-adjusted) makespan
  const completionDate = new Date();
  completionDate.setHours(completionDate.getHours() + Math.ceil(effectiveMakespan * 24));

  // Builder potions needed
  const potionsToFinish = effectiveMakespan > 0 ? Math.ceil((effectiveMakespan * 24) / BUILDER_POTION_HOURS) : 0;

  // Hammers/Books: most expensive upgrades
  const allUpgrades = [
    ...result.bmPlan.details.map(d => ({ ...d, hero: 'BM' as const })),
    ...result.bcPlan.details.map(d => ({ ...d, hero: 'BC' as const })),
  ].sort((a, b) => b.time - a.time);
  const topHammerSaves = allUpgrades.slice(0, 3);

  // CT level label from duration
  const ctLevelFromDuration = (dur: number) => {
    const levels: Record<number, number> = { 14: 1, 16: 2, 18: 3, 20: 4, 22: 5, 24: 6, 26: 7, 28: 8, 30: 9, 32: 10 };
    return levels[dur] || '?';
  };

  // Copy results
  const handleCopyResults = useCallback(() => {
    const lines = [
      `🏗️ B.O.B Rush Optimizer Results`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `Current: BM ${bmLevel}${effectiveBmUpgrading ? ` (upgrading → ${bmLevel + 1})` : ''} | BC ${bcLevel === 0 ? 'Locked' : `${bcLevel}${effectiveBcUpgrading ? ` (upgrading → ${bcLevel + 1})` : ''}`}`,
      `Target: Combined Lvl ${TARGET_LEVEL}`,
      goldPass ? `Gold Pass: ✅ Active (-20% time)` : '',
      ``,
      `⚡ Optimal Strategy:`,
      result.bmPlan.levels > 0 ? `  🛠️ BM ${result.bmPlan.from} → ${result.bmPlan.to} (${formatTime(result.bmPlan.totalTime)} | ${formatElixir(result.bmPlan.totalCost)})` : '',
      result.bcPlan.levels > 0 ? `  🚁 BC ${result.bcPlan.from} → ${result.bcPlan.to} (${formatTime(result.bcPlan.totalTime)} | ${formatElixir(result.bcPlan.totalCost)})` : '',
      ``,
      `⏱ Base Time: ${formatTime(result.makespan)}`,
      ctEnabled ? `⏰ With Clock Tower: ${formatTime(effectiveMakespan)} (saved ${formatTimeHours(ctSavings.totalSavedHours)})` : '',
      `💰 Total Cost: ${formatElixir(result.totalCost)}`,
      `📅 Done by: ${formatDate(completionDate)}`,
      ``,
      `Time saved via parallel builders: ${formatTime(result.totalBuilderTime - result.makespan)}`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      alert('Results copied to clipboard! 📋');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = lines;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Results copied to clipboard! 📋');
    });
  }, [bmLevel, bcLevel, effectiveBmUpgrading, effectiveBcUpgrading, goldPass, result, ctEnabled, effectiveMakespan, ctSavings, completionDate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-5"
      style={{ backgroundColor: '#0f172a', fontFamily: "'Nunito', sans-serif" }}
    >
      <div
        className="w-full max-w-[540px] rounded-[20px] p-5 sm:p-8"
        style={{
          background: '#1e293b',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          border: '1px solid #334155',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="w-10" />
          <h1 className="text-center font-black mt-0 text-[1.6rem] sm:text-[1.8rem]" style={{ color: '#d946ef' }}>
            B.O.B Rush Optimizer
          </h1>
          <button
            onClick={handleReset}
            title="Reset all"
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-none transition-colors"
            style={{ background: '#334155', color: '#94a3b8', fontSize: '1.1rem' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#475569'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#334155'; }}
          >
            ↺
          </button>
        </div>
        <p className="text-center mb-5 text-[0.9rem] sm:text-[0.95rem]" style={{ color: '#94a3b8' }}>
          Find the absolute fastest path to combined Hero Lvl 45
        </p>

        {/* Gold Pass Toggle */}
        <div
          className="rounded-xl p-3 mb-4 flex items-center justify-between"
          style={{
            background: goldPass ? '#422006' : '#1e293b',
            border: goldPass ? '1px solid #854d0e' : '1px solid #334155',
            transition: 'all 0.2s',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="font-bold text-sm" style={{ color: goldPass ? '#fbbf24' : '#94a3b8' }}>
              Gold Pass Active
            </span>
            {goldPass && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#854d0e', color: '#fde68a' }}>
                -20% Time
              </span>
            )}
          </div>
          <div
            className="relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0"
            style={{ background: goldPass ? '#f59e0b' : '#475569' }}
            onClick={() => setGoldPass(!goldPass)}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 shadow"
              style={{ background: '#fff', left: goldPass ? '22px' : '2px' }}
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-5">
          <div className="flex justify-between mb-2 text-[0.85rem] sm:text-[0.9rem] font-bold" style={{ color: '#cbd5e1' }}>
            <span>Combined Hero Level</span>
            <span>
              {currentCombined} / {TARGET_LEVEL}
              {(effectiveBmUpgrading || effectiveBcUpgrading || bcLevel === 0) &&
                currentCombined !== afterCombined && (
                  <span className="text-xs ml-1" style={{ color: '#94a3b8' }}>
                    (→{afterCombined} soon)
                  </span>
                )}
            </span>
          </div>
          <div
            className="rounded-[10px] h-[14px] overflow-hidden relative"
            style={{ background: '#0f172a', border: '1px solid #334155' }}
          >
            <div
              className="h-full transition-all duration-500 ease-out absolute left-0 top-0"
              style={{
                background: progressPercent >= 100
                  ? 'linear-gradient(90deg, #34d399, #22d3ee)'
                  : 'linear-gradient(90deg, #d946ef, #8b5cf6)',
                width: `${progressPercent}%`,
              }}
            />
            {finalCombined > afterCombined && finalCombined <= TARGET_LEVEL && (
              <div
                className="h-full absolute top-0 transition-all duration-500 ease-out opacity-30"
                style={{
                  background: 'linear-gradient(90deg, #d946ef, #8b5cf6)',
                  width: `${(finalCombined / TARGET_LEVEL) * 100}%`,
                  left: 0,
                }}
              />
            )}
          </div>
          <div className="flex justify-between mt-1 text-[0.7rem]" style={{ color: '#64748b' }}>
            <span>Lvl 0</span>
            <span>Lvl 45 🎯</span>
          </div>
        </div>

        {/* Battle Machine Select */}
        <div className="mb-4">
          <label className="block font-bold mb-2 text-sm" style={{ color: '#cbd5e1' }}>
            🛠️ Battle Machine Current Level
          </label>
          <div className="relative">
            <select
              value={bmLevel}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBmLevel(val);
                if (val >= 35) setBmUpgrading(false);
              }}
              className="w-full p-3 rounded-[10px] text-[1rem] font-bold outline-none cursor-pointer appearance-none text-white pr-10"
              style={{ background: '#0f172a', border: '1px solid #475569' }}
            >
              {Array.from({ length: 35 }, (_, i) => i + 1).map((lvl) => (
                <option key={lvl} value={lvl}>Level {lvl}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3" style={{ color: '#94a3b8' }}>▾</div>
          </div>

          {canBmUpgrade && (
            <div
              className="mt-3 rounded-xl p-3 transition-all"
              style={{
                background: effectiveBmUpgrading ? '#1a1033' : 'transparent',
                border: effectiveBmUpgrading ? '1px solid #581c87' : '1px solid transparent',
              }}
            >
              <Toggle
                checked={effectiveBmUpgrading}
                onChange={(v) => {
                  setBmUpgrading(v);
                  if (v) {
                    const fullTime = BM_TIMES[bmLevel] || 0;
                    const gp = goldPass ? (1 - GOLD_PASS_DISCOUNT) : 1;
                    const adjusted = fullTime * gp;
                    setBmRemDays(Math.floor(adjusted));
                    setBmRemHours(Math.round((adjusted - Math.floor(adjusted)) * 24));
                  }
                }}
                label={effectiveBmUpgrading ? `Upgrading to Lvl ${bmLevel + 1}...` : 'Currently upgrading?'}
              />
              {effectiveBmUpgrading && (
                <>
                  <TimeInput
                    days={bmRemDays}
                    hours={bmRemHours}
                    onDaysChange={setBmRemDays}
                    onHoursChange={setBmRemHours}
                  />
                  <div className="mt-1.5 text-[0.7rem]" style={{ color: '#64748b' }}>
                    Full upgrade: {formatTime((BM_TIMES[bmLevel] || 0) * (goldPass ? 1 - GOLD_PASS_DISCOUNT : 1))}
                    {' | '}Cost: {formatElixir(BM_COSTS[bmLevel] || 0)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Battle Copter Select */}
        <div className="mb-4">
          <label className="block font-bold mb-2 text-sm" style={{ color: '#cbd5e1' }}>
            🚁 Battle Copter Current Level
          </label>
          <div className="relative">
            <select
              value={bcLevel}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBcLevel(val);
                if (val >= 35 || val === 0) setBcUpgrading(false);
              }}
              className="w-full p-3 rounded-[10px] text-[1rem] font-bold outline-none cursor-pointer appearance-none text-white pr-10"
              style={{ background: '#0f172a', border: '1px solid #475569' }}
            >
              <option value={0}>Not Unlocked (0)</option>
              {Array.from({ length: 21 }, (_, i) => i + 15).map((lvl) => (
                <option key={lvl} value={lvl}>Level {lvl}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3" style={{ color: '#94a3b8' }}>▾</div>
          </div>

          {canBcUpgrade && (
            <div
              className="mt-3 rounded-xl p-3 transition-all"
              style={{
                background: effectiveBcUpgrading ? '#0c1a33' : 'transparent',
                border: effectiveBcUpgrading ? '1px solid #1e3a5f' : '1px solid transparent',
              }}
            >
              <Toggle
                checked={effectiveBcUpgrading}
                onChange={(v) => {
                  setBcUpgrading(v);
                  if (v) {
                    const fullTime = BC_TIMES[bcLevel] || 0;
                    const gp = goldPass ? (1 - GOLD_PASS_DISCOUNT) : 1;
                    const adjusted = fullTime * gp;
                    setBcRemDays(Math.floor(adjusted));
                    setBcRemHours(Math.round((adjusted - Math.floor(adjusted)) * 24));
                  }
                }}
                label={effectiveBcUpgrading ? `Upgrading to Lvl ${bcLevel + 1}...` : 'Currently upgrading?'}
              />
              {effectiveBcUpgrading && (
                <>
                  <TimeInput
                    days={bcRemDays}
                    hours={bcRemHours}
                    onDaysChange={setBcRemDays}
                    onHoursChange={setBcRemHours}
                  />
                  <div className="mt-1.5 text-[0.7rem]" style={{ color: '#64748b' }}>
                    Full upgrade: {formatTime((BC_TIMES[bcLevel] || 0) * (goldPass ? 1 - GOLD_PASS_DISCOUNT : 1))}
                    {' | '}Cost: {formatElixir(BC_COSTS[bcLevel] || 0)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Active Upgrades Summary */}
        {(effectiveBmUpgrading || effectiveBcUpgrading) && (
          <div className="rounded-xl p-4 mb-4" style={{ background: '#172032', border: '1px solid #1e3a5f' }}>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: '#fbbf24' }}>
              <span className="text-base">🔄</span> In-Progress Upgrades
            </h3>
            {effectiveBmUpgrading && (
              <div className="flex justify-between items-center text-sm mb-1">
                <span style={{ color: '#f0abfc' }}>🛠️ BM {bmLevel} → {bmLevel + 1}</span>
                <span className="font-bold" style={{ color: '#34d399' }}>{formatTime(bmRemaining)} left</span>
              </div>
            )}
            {effectiveBcUpgrading && (
              <div className="flex justify-between items-center text-sm">
                <span style={{ color: '#7dd3fc' }}>🚁 BC {bcLevel} → {bcLevel + 1}</span>
                <span className="font-bold" style={{ color: '#34d399' }}>{formatTime(bcRemaining)} left</span>
              </div>
            )}
          </div>
        )}

        {/* ═══════ CLOCK TOWER SECTION ═══════ */}
        <div
          className="rounded-xl mb-5 overflow-hidden transition-all duration-300"
          style={{
            border: ctEnabled ? '1px solid #0e7490' : '1px solid #334155',
            background: ctEnabled ? '#0c2d3f' : '#1e293b',
          }}
        >
          {/* CT Header Toggle */}
          <div
            className="p-3 flex items-center justify-between cursor-pointer"
            onClick={() => setCtEnabled(!ctEnabled)}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⏰</span>
              <span className="font-bold text-sm" style={{ color: ctEnabled ? '#22d3ee' : '#94a3b8' }}>
                Clock Tower Boost
              </span>
              {ctEnabled && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#164e63', color: '#67e8f9' }}>
                  10× Speed
                </span>
              )}
            </div>
            <div
              className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
              style={{ background: ctEnabled ? '#06b6d4' : '#475569' }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 shadow"
                style={{ background: '#fff', left: ctEnabled ? '22px' : '2px' }}
              />
            </div>
          </div>

          {/* CT Settings (expanded) */}
          {ctEnabled && (
            <div className="px-4 pb-4 space-y-4">
              {/* Natural Boost Duration Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold" style={{ color: '#94a3b8' }}>
                    🏗️ Clock Tower Boost Duration
                  </label>
                  <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ background: '#164e63', color: '#22d3ee' }}>
                    {ctDuration} min
                    <span className="text-[0.65rem] ml-1" style={{ color: '#67e8f9' }}>
                      (Lvl {ctLevelFromDuration(ctDuration)})
                    </span>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min={14}
                    max={32}
                    step={2}
                    value={ctDuration}
                    onChange={(e) => setCtDuration(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #06b6d4 ${((ctDuration - 14) / 18) * 100}%, #1e293b ${((ctDuration - 14) / 18) * 100}%)`,
                      accentColor: '#06b6d4',
                    }}
                  />
                  <div className="flex justify-between mt-1 text-[0.6rem]" style={{ color: '#475569' }}>
                    <span>14 min</span>
                    <span>32 min</span>
                  </div>
                </div>
                <div className="text-[0.7rem] mt-1" style={{ color: '#0e7490' }}>
                  Each boost: 10× speed for {ctDuration} min → saves {Math.round(9 * ctDuration)} min ({formatTimeHours(9 * ctDuration / 60)})
                </div>
              </div>

              {/* Boosts per day */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold" style={{ color: '#94a3b8' }}>
                    🔁 Natural Boosts Per Day
                  </label>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setCtBoostsPerDay(n)}
                        className="w-8 h-8 rounded-lg text-xs font-bold border-none cursor-pointer transition-all"
                        style={{
                          background: ctBoostsPerDay === n ? '#06b6d4' : '#1e293b',
                          color: ctBoostsPerDay === n ? '#fff' : '#64748b',
                          border: ctBoostsPerDay === n ? '1px solid #22d3ee' : '1px solid #334155',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-[0.65rem]" style={{ color: '#475569' }}>
                  ~{ctBoostsPerDay > 0 ? Math.round(24 / ctBoostsPerDay) : '∞'}h between uses • Daily savings: {formatTimeHours(ctBoostsPerDay * 9 * ctDuration / 60)}
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid #164e63' }} />

              {/* Clock Tower Potion */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#94a3b8' }}>
                      🧪 Clock Tower Potions
                    </label>
                    <div className="text-[0.65rem] mt-0.5" style={{ color: '#475569' }}>
                      Each: 30 min @ 10× speed → saves 4h 30m
                    </div>
                  </div>
                  <NumInput
                    value={ctPotions}
                    onChange={setCtPotions}
                    min={0}
                    max={99}
                    width="w-16"
                  />
                </div>
              </div>

              {/* CT Summary */}
              {result.makespan > 0 && (
                <div className="rounded-lg p-3" style={{ background: '#0a1f2e', border: '1px solid #164e63' }}>
                  <div className="text-xs font-bold mb-2" style={{ color: '#22d3ee' }}>
                    ⏰ Clock Tower Impact
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[0.8rem]">
                      <span style={{ color: '#94a3b8' }}>Natural Boosts:</span>
                      <span className="font-bold" style={{ color: '#e2e8f0' }}>
                        ~{ctSavings.naturalBoosts}× → saves {formatTimeHours(ctSavings.naturalSavedHours)}
                      </span>
                    </div>
                    {ctPotions > 0 && (
                      <div className="flex justify-between text-[0.8rem]">
                        <span style={{ color: '#94a3b8' }}>CT Potions ({ctPotions}×):</span>
                        <span className="font-bold" style={{ color: '#e2e8f0' }}>
                          saves {formatTimeHours(ctSavings.potionSavedHours)}
                        </span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #164e63', margin: '4px 0' }} />
                    <div className="flex justify-between text-[0.85rem]">
                      <span className="font-bold" style={{ color: '#67e8f9' }}>Total Time Saved:</span>
                      <span className="font-bold" style={{ color: '#34d399' }}>
                        {formatTime(ctSavings.totalSavedHours / 24)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[0.85rem]">
                      <span className="font-bold" style={{ color: '#67e8f9' }}>Adjusted Time:</span>
                      <span className="font-bold" style={{ color: '#22d3ee' }}>
                        {formatTime(ctSavings.adjustedMakespan)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Box */}
        <div className="rounded-[15px] p-5 mt-2" style={{ background: '#0f172a', border: '1px solid #334155' }}>
          <h2 className="text-center text-[1.15rem] font-bold m-0 mb-4" style={{ color: '#38bdf8' }}>
            ⚡ Optimal Strategy
          </h2>

          {result.message ? (
            <p className="text-center text-[1.1rem] font-bold" style={{ color: '#34d399' }}>
              {result.message}
            </p>
          ) : (
            <>
              {/* Main stats */}
              <div className="flex justify-between mb-2.5 text-[1.02rem]">
                <span style={{ color: '#cbd5e1' }}>
                  {ctEnabled ? 'Base Time:' : 'Total Elapsed Time:'}
                </span>
                <span className="font-bold" style={{ color: ctEnabled ? '#94a3b8' : '#34d399', textDecoration: ctEnabled ? 'line-through' : 'none' }}>
                  {formatTime(result.makespan)}
                </span>
              </div>

              {/* CT-Adjusted Time */}
              {ctEnabled && (
                <div className="flex justify-between mb-2.5 text-[1.1rem]">
                  <span className="font-bold" style={{ color: '#22d3ee' }}>⏰ With Clock Tower:</span>
                  <span className="font-bold" style={{ color: '#34d399' }}>{formatTime(effectiveMakespan)}</span>
                </div>
              )}

              {/* Completion date */}
              <div className="flex justify-between mb-2.5 text-[0.85rem]" style={{ color: '#94a3b8' }}>
                <span>📅 Estimated Done:</span>
                <span className="font-bold" style={{ color: '#e2e8f0' }}>{formatDate(completionDate)}</span>
              </div>

              {(effectiveBmUpgrading || effectiveBcUpgrading) && (
                <div className="flex justify-between mb-2.5 text-[0.8rem]" style={{ color: '#64748b' }}>
                  <span>Includes in-progress wait:</span>
                  <span style={{ color: '#fbbf24' }}>{formatTime(Math.max(result.bmOffset, result.bcOffset))}</span>
                </div>
              )}
              <div className="flex justify-between mb-2.5 text-[0.8rem]" style={{ color: '#64748b' }}>
                <span>Combined Builder Time:</span>
                <span>{formatTime(result.totalBuilderTime)}</span>
              </div>
              <div className="flex justify-between mb-2.5 text-[0.8rem]" style={{ color: '#64748b' }}>
                <span>⚡ Time Saved via Parallel:</span>
                <span style={{ color: '#fbbf24' }}>{formatTime(result.totalBuilderTime - result.makespan)}</span>
              </div>

              <div className="my-3" style={{ borderTop: '1px solid #334155' }} />

              <div className="flex justify-between mb-2.5 text-[1.02rem]">
                <span style={{ color: '#cbd5e1' }}>Total Builder Elixir:</span>
                <span className="font-bold" style={{ color: '#f472b6' }}>{formatElixir(result.totalCost)}</span>
              </div>

              <div className="my-3" style={{ borderTop: '1px solid #334155' }} />

              {/* Builder Potion estimate */}
              <div className="flex justify-between mb-1 text-[0.8rem]" style={{ color: '#64748b' }}>
                <span>🧪 Builder Potions to finish:</span>
                <span className="font-bold" style={{ color: '#a78bfa' }}>~{potionsToFinish}</span>
              </div>
              <div className="text-[0.65rem] mb-2" style={{ color: '#475569' }}>
                (Each potion saves ~{BUILDER_POTION_HOURS}h per active builder)
              </div>

              {/* Hammer of Heroes suggestions */}
              {topHammerSaves.length > 0 && (
                <Collapsible title={`🔨 Best Hammer/Book of Heroes Targets (${topHammerSaves.length})`}>
                  <div className="text-[0.75rem] mb-2" style={{ color: '#64748b' }}>
                    Use Hammer/Book on these upgrades to save the most time:
                  </div>
                  {topHammerSaves.map((u, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-1.5 px-2 rounded-lg mb-1 text-[0.8rem]"
                      style={{ background: '#1e293b' }}
                    >
                      <span style={{ color: '#e2e8f0' }}>
                        {u.hero === 'BM' ? '🛠️' : '🚁'} Lvl {u.from} → {u.to}
                      </span>
                      <div className="flex gap-3">
                        <span style={{ color: '#34d399' }}>-{formatTime(u.time)}</span>
                        <span style={{ color: '#f472b6' }}>-{formatElixir(u.cost)}</span>
                      </div>
                    </div>
                  ))}
                </Collapsible>
              )}
            </>
          )}
        </div>

        {/* Parallel Timeline */}
        {!result.message && (result.bmPlan.levels > 0 || result.bcPlan.levels > 0) && (
          <div className="mt-5">
            <h3 className="text-[1rem] font-bold mb-3 text-center" style={{ color: '#cbd5e1' }}>
              🔧 Builder Timeline (Parallel)
            </h3>

            {/* Timeline Visualization */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0f172a', border: '1px solid #334155' }}>
              {/* Builder 1 - BM */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#86198f', color: '#f0abfc' }}>Builder 1</span>
                  <span className="text-xs" style={{ color: '#94a3b8' }}>Battle Machine</span>
                  {result.bmPlan.levels > 0 && (
                    <span className="text-xs ml-auto" style={{ color: '#64748b' }}>
                      {result.bmPlan.from}→{result.bmPlan.to}
                    </span>
                  )}
                </div>
                <div className="h-8 rounded-lg overflow-hidden flex" style={{ background: '#1e293b' }}>
                  {result.bmOffset > 0 && (
                    <div
                      className="h-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        width: `${bmOffsetPercent}%`,
                        minWidth: '35px',
                        background: 'repeating-linear-gradient(45deg, #86198f33, #86198f33 4px, #86198f55 4px, #86198f55 8px)',
                        color: '#f0abfc',
                        borderRight: result.bmPlan.levels > 0 ? '2px solid #0f172a' : 'none',
                      }}
                    >
                      ⏳{formatTime(result.bmOffset)}
                    </div>
                  )}
                  {result.bmPlan.levels > 0 && (
                    <div
                      className="h-full flex items-center justify-center text-xs font-bold transition-all duration-500"
                      style={{
                        width: result.bmOffset > 0 ? `${bmBarPercent - bmOffsetPercent}%` : `${bmBarPercent}%`,
                        minWidth: '45px',
                        background: 'linear-gradient(90deg, #d946ef, #a855f7)',
                        color: '#fff',
                      }}
                    >
                      {formatTime(result.bmPlan.totalTime)}
                    </div>
                  )}
                </div>
              </div>

              {/* Builder 2 - BC */}
              <div className="mb-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#7dd3fc' }}>Builder 2</span>
                  <span className="text-xs" style={{ color: '#94a3b8' }}>Battle Copter</span>
                  {result.bcPlan.levels > 0 && (
                    <span className="text-xs ml-auto" style={{ color: '#64748b' }}>
                      {result.bcPlan.from}→{result.bcPlan.to}
                    </span>
                  )}
                </div>
                <div className="h-8 rounded-lg overflow-hidden flex" style={{ background: '#1e293b' }}>
                  {result.bcOffset > 0 && (
                    <div
                      className="h-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        width: `${bcOffsetPercent}%`,
                        minWidth: '35px',
                        background: 'repeating-linear-gradient(45deg, #1e3a5f55, #1e3a5f55 4px, #1e3a5f99 4px, #1e3a5f99 8px)',
                        color: '#7dd3fc',
                        borderRight: result.bcPlan.levels > 0 ? '2px solid #0f172a' : 'none',
                      }}
                    >
                      ⏳{formatTime(result.bcOffset)}
                    </div>
                  )}
                  {result.bcPlan.levels > 0 && (
                    <div
                      className="h-full flex items-center justify-center text-xs font-bold transition-all duration-500"
                      style={{
                        width: result.bcOffset > 0 ? `${bcBarPercent - bcOffsetPercent}%` : `${bcBarPercent}%`,
                        minWidth: '45px',
                        background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
                        color: '#fff',
                      }}
                    >
                      {formatTime(result.bcPlan.totalTime)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between mt-2 text-[0.7rem]" style={{ color: '#475569' }}>
                <span>Now</span>
                <span>Day {Math.ceil(result.makespan)}{ctEnabled ? ` → ~Day ${Math.ceil(effectiveMakespan)} w/ CT` : ''}</span>
              </div>
            </div>

            {/* Upgrade Cards */}
            {result.unlockBC && (
              <div className="rounded-[10px] p-4 mb-3 border-l-[5px] border-l-cyan-400" style={{ background: '#334155' }}>
                <div className="font-bold text-[1.02rem] mb-1">🚁 Unlock Battle Copter</div>
                <div className="flex flex-wrap gap-3 text-[0.85rem]" style={{ color: '#94a3b8' }}>
                  <span className="flex items-center gap-1">⏱ Instant</span>
                  <span className="flex items-center gap-1">💰 {formatElixir(result.unlockCost)}</span>
                  <span className="flex items-center gap-1">📈 Lvl 0 → 15</span>
                </div>
              </div>
            )}

            {/* In-progress cards */}
            {effectiveBmUpgrading && (
              <div className="rounded-[10px] p-4 mb-3 border-l-[5px]" style={{ background: '#2d1f3d', borderLeftColor: '#c084fc' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-[1.02rem] mb-1" style={{ color: '#e9d5ff' }}>
                      ⏳ BM {bmLevel} → {bmLevel + 1} (In Progress)
                    </div>
                    <div className="flex flex-wrap gap-3 text-[0.85rem]" style={{ color: '#a78bfa' }}>
                      <span className="flex items-center gap-1">⏱ {formatTime(bmRemaining)} remaining</span>
                      <span className="flex items-center gap-1">💰 Already paid</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0 ml-2" style={{ background: '#86198f', color: '#f0abfc' }}>Builder 1</span>
                </div>
              </div>
            )}

            {effectiveBcUpgrading && (
              <div className="rounded-[10px] p-4 mb-3 border-l-[5px]" style={{ background: '#0f2137', borderLeftColor: '#7dd3fc' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-[1.02rem] mb-1" style={{ color: '#bae6fd' }}>
                      ⏳ BC {bcLevel} → {bcLevel + 1} (In Progress)
                    </div>
                    <div className="flex flex-wrap gap-3 text-[0.85rem]" style={{ color: '#7dd3fc' }}>
                      <span className="flex items-center gap-1">⏱ {formatTime(bcRemaining)} remaining</span>
                      <span className="flex items-center gap-1">💰 Already paid</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0 ml-2" style={{ background: '#1e3a5f', color: '#7dd3fc' }}>Builder 2</span>
                </div>
              </div>
            )}

            {/* Future upgrade cards */}
            {result.bmPlan.levels > 0 && (
              <div className="rounded-[10px] p-4 mb-3 border-l-[5px]" style={{ background: '#334155', borderLeftColor: '#d946ef' }}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[1.02rem] mb-1">
                      🛠️ Battle Machine Lvl {result.bmPlan.from} → {result.bmPlan.to}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[0.85rem]" style={{ color: '#94a3b8' }}>
                      <span className="flex items-center gap-1">⏱ {formatTime(result.bmPlan.totalTime)}</span>
                      <span className="flex items-center gap-1">💰 {formatElixir(result.bmPlan.totalCost)}</span>
                      <span className="flex items-center gap-1">📊 {result.bmPlan.levels} upgrade{result.bmPlan.levels > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0 ml-2" style={{ background: '#86198f', color: '#f0abfc' }}>Builder 1</span>
                </div>

                {result.bmPlan.levels > 1 && (
                  <Collapsible title={`📋 Level-by-level breakdown`}>
                    <div className="space-y-1">
                      {result.bmPlan.details.map((d, i) => (
                        <div key={i} className="flex justify-between py-1 px-2 rounded text-[0.78rem]" style={{ background: '#293548' }}>
                          <span style={{ color: '#cbd5e1' }}>Lvl {d.from} → {d.to}</span>
                          <div className="flex gap-3">
                            <span style={{ color: '#34d399' }}>{formatTime(d.time)}</span>
                            <span style={{ color: '#f472b6' }}>{formatElixir(d.cost)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Collapsible>
                )}
              </div>
            )}

            {result.bcPlan.levels > 0 && (
              <div className="rounded-[10px] p-4 mb-3 border-l-[5px]" style={{ background: '#334155', borderLeftColor: '#6366f1' }}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[1.02rem] mb-1">
                      🚁 Battle Copter Lvl {result.bcPlan.from} → {result.bcPlan.to}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[0.85rem]" style={{ color: '#94a3b8' }}>
                      <span className="flex items-center gap-1">⏱ {formatTime(result.bcPlan.totalTime)}</span>
                      <span className="flex items-center gap-1">💰 {formatElixir(result.bcPlan.totalCost)}</span>
                      <span className="flex items-center gap-1">📊 {result.bcPlan.levels} upgrade{result.bcPlan.levels > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0 ml-2" style={{ background: '#1e3a5f', color: '#7dd3fc' }}>Builder 2</span>
                </div>

                {result.bcPlan.levels > 1 && (
                  <Collapsible title={`📋 Level-by-level breakdown`}>
                    <div className="space-y-1">
                      {result.bcPlan.details.map((d, i) => (
                        <div key={i} className="flex justify-between py-1 px-2 rounded text-[0.78rem]" style={{ background: '#293548' }}>
                          <span style={{ color: '#cbd5e1' }}>Lvl {d.from} → {d.to}</span>
                          <div className="flex gap-3">
                            <span style={{ color: '#34d399' }}>{formatTime(d.time)}</span>
                            <span style={{ color: '#f472b6' }}>{formatElixir(d.cost)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Collapsible>
                )}
              </div>
            )}

            {/* Parallel callout */}
            {result.bmPlan.levels > 0 && result.bcPlan.levels > 0 && (
              <div
                className="rounded-lg p-3 flex items-start gap-2 text-[0.82rem]"
                style={{ background: '#1a2e05', border: '1px solid #365314', color: '#a3e635' }}
              >
                <span className="text-lg leading-none">⚡</span>
                <div>
                  <span className="font-bold">Both upgrade simultaneously!</span>
                  <span style={{ color: '#86efac' }}>
                    {' '}You save {formatTime(result.totalBuilderTime - result.makespan)} by using both builders in parallel.
                    {ctEnabled && ctSavings.totalSavedHours > 0 && (
                      <> Plus {formatTime(ctSavings.totalSavedHours / 24)} from Clock Tower boosts!</>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Copy Results Button */}
            <button
              onClick={handleCopyResults}
              className="mt-4 w-full py-3 rounded-xl font-bold text-sm cursor-pointer border-none transition-all duration-200 flex items-center justify-center gap-2"
              style={{ background: '#334155', color: '#cbd5e1' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#475569'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#334155'; }}
            >
              📋 Copy Results to Clipboard
            </button>
          </div>
        )}

        <p className="text-[0.7rem] text-center mt-4 leading-relaxed" style={{ color: '#64748b' }}>
          *Upgrade times are base values{goldPass ? ' with Gold Pass (-20%)' : ' (no Gold Pass)'}.
          {ctEnabled ? ' Clock Tower assumes consistent daily activation.' : ''} Uses 2 builders in parallel.
        </p>
      </div>
    </div>
  );
}
