import { useMemo, useState } from 'react';
import { Atom, BookOpen, Check, ChevronRight, CircleHelp, Code2, Cpu, ExternalLink, Gauge, GraduationCap, Info, Layers3, Moon, Play, RotateCcw, ScanLine, Sparkles, Target, Terminal, Waves, X, Zap } from 'lucide-react';

type Complex = { re: number; im: number };
type GateName = 'X' | 'Y' | 'Z' | 'H' | 'S' | 'T' | 'RX' | 'RY' | 'RZ';
type GateOp = { gate: GateName | 'CX'; target: number; angle?: number };
type InitialState = 'zero' | 'one' | 'plus' | 'bell';

const C = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => C(a.re + b.re, a.im + b.im);
const mul = (a: Complex, b: Complex): Complex => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const magnitudeSquared = (a: Complex) => a.re * a.re + a.im * a.im;
const round = (n: number) => Math.abs(n) < 0.0005 ? 0 : n;

function matrixFor(gate: GateName, angle = 0): Complex[][] {
  const s = 1 / Math.sqrt(2);
  if (gate === 'X') return [[C(0), C(1)], [C(1), C(0)]];
  if (gate === 'Y') return [[C(0), C(0, -1)], [C(0, 1), C(0)]];
  if (gate === 'Z') return [[C(1), C(0)], [C(0), C(-1)]];
  if (gate === 'H') return [[C(s), C(s)], [C(s), C(-s)]];
  if (gate === 'S') return [[C(1), C(0)], [C(0, 1)]];
  if (gate === 'T') return [[C(1), C(0)], [C(0), C(Math.SQRT1_2, Math.SQRT1_2)]];
  const theta = (angle * Math.PI) / 180;
  const co = Math.cos(theta / 2);
  const si = Math.sin(theta / 2);
  if (gate === 'RX') return [[C(co), C(0, -si)], [C(0, -si), C(co)]];
  if (gate === 'RY') return [[C(co), C(-si)], [C(si), C(co)]];
  return [[C(Math.cos(theta / 2), -Math.sin(theta / 2)), C(0)], [C(0), C(Math.cos(theta / 2), Math.sin(theta / 2))]];
}

function applyGate(vector: Complex[], gate: GateName, target: number, qubits: number, angle = 0) {
  const result = vector.map((item) => ({ ...item }));
  const bit = 1 << (qubits - 1 - target);
  if (gate === 'S') {
    for (let index = 0; index < vector.length; index += 1) {
      if ((index & bit) !== 0) {
        const amplitude = vector[index];
        result[index] = C(-amplitude.im, amplitude.re);
      }
    }
    return result;
  }
  const matrix = matrixFor(gate, angle);
  for (let index = 0; index < vector.length; index += 1) {
    if ((index & bit) === 0) {
      const one = index | bit;
      result[index] = add(mul(matrix[0][0], vector[index]), mul(matrix[0][1], vector[one]));
      result[one] = add(mul(matrix[1][0], vector[index]), mul(matrix[1][1], vector[one]));
    }
  }
  return result;
}

function applyCnot(vector: Complex[], control: number, target: number, qubits: number) {
  const result = vector.map(() => C(0));
  const controlBit = 1 << (qubits - 1 - control);
  const targetBit = 1 << (qubits - 1 - target);
  vector.forEach((amplitude, index) => {
    const next = (index & controlBit) ? index ^ targetBit : index;
    result[next] = add(result[next], amplitude);
  });
  return result;
}

function initialVector(qubits: number, state: InitialState): Complex[] {
  if (state === 'one') return Array.from({ length: 2 ** qubits }, (_, i) => i === 2 ** qubits - 1 ? C(1) : C(0));
  if (state === 'plus') {
    const value = 1 / Math.sqrt(2);
    return qubits === 1 ? [C(value), C(value)] : [C(value), C(0), C(value), C(0)];
  }
  if (state === 'bell' && qubits === 2) return [C(1 / Math.sqrt(2)), C(0), C(0), C(1 / Math.sqrt(2))];
  return Array.from({ length: 2 ** qubits }, (_, i) => i === 0 ? C(1) : C(0));
}

function formatComplex(value: Complex) {
  const re = round(value.re);
  const im = round(value.im);
  if (re === 0 && im === 0) return '0';
  if (im === 0) return re.toFixed(3);
  if (re === 0) return `${im < 0 ? '-' : ''}${Math.abs(im).toFixed(3)}i`;
  return `${re.toFixed(3)} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(3)}i`;
}

function phaseLabel(value: Complex) {
  if (Math.abs(value.re) < 0.0005 && Math.abs(value.im) < 0.0005) return null;
  const phase = Math.atan2(value.im, value.re) * (180 / Math.PI);
  return Math.abs(phase) < 0.5 ? null : `phase ${phase.toFixed(0)}°`;
}

function probabilityLabel(probability: number) {
  return `${(probability * 100).toFixed(probability > 0 && probability < 0.1 ? 1 : 0)}%`;
}

function stateLabel(index: number, qubits: number) {
  return `|${index.toString(2).padStart(qubits, '0')}⟩`;
}

function BarChart({
  items,
  valueLabel,
  color,
  emptyLabel,
  testId,
}: {
  items: { label: string; value: number }[];
  valueLabel: (value: number) => string;
  color: string;
  emptyLabel?: string;
  testId: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="mt-5 overflow-x-auto" data-testid={testId}>
      {items.length === 0 ? (
        <div className="qq-dashed rounded-lg p-5 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex min-w-[360px] items-end gap-3 border-b border-l border-border px-3 pb-0 pt-4" style={{ height: 190 }}>
          {items.map((item) => {
            const height = item.value > 0 ? Math.max((item.value / maxValue) * 132, 4) : 2;
            return (
              <div key={item.label} className="group flex h-full min-w-14 flex-1 flex-col items-center justify-end gap-2">
                <span className="qq-mono text-[10px] font-bold text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {valueLabel(item.value)}
                </span>
                <div
                  className="w-full max-w-16 rounded-t-md transition-all duration-500 group-hover:brightness-110"
                  style={{ height, backgroundColor: color }}
                  title={`${item.label}: ${valueLabel(item.value)}`}
                  aria-label={`${item.label}: ${valueLabel(item.value)}`}
                />
                <span className="qq-mono whitespace-nowrap text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProbabilityChart({ items }: { items: { label: string; value: number }[] }) {
  return (
    <div className="qq-card rounded-2xl p-5 md:p-7" data-testid="panel-theoretical-chart">
      <div className="flex items-start justify-between">
        <div>
          <div className="qq-kicker text-primary">Theoretical probability</div>
          <h2 className="mt-1 text-xl font-bold tracking-tight">State distribution</h2>
          <p className="mt-1 text-xs text-muted-foreground">Exact values from the live state vector.</p>
        </div>
        <span className="qq-mono rounded bg-primary/10 px-2 py-1 text-[10px] text-primary">0–100%</span>
      </div>
      <BarChart
        items={items}
        valueLabel={(value) => `${(value * 100).toFixed(1)}%`}
        color="#3157D5"
        testId="chart-theoretical-probability"
      />
      <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span><span>Probability of measuring each basis state</span><span>100%</span>
      </div>
    </div>
  );
}

function MeasurementChart({
  counts,
  shots,
}: {
  counts: Record<string, number>;
  shots: number;
}) {
  const items = Object.entries(counts).map(([label, value]) => ({ label, value }));
  return (
    <div className="qq-card rounded-2xl p-5 md:p-7" data-testid="panel-measurement-chart">
      <div className="flex items-start justify-between">
        <div>
          <div className="qq-kicker text-accent-foreground">Measurement results</div>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Observed shots</h2>
          <p className="mt-1 text-xs text-muted-foreground">Real random samples from the current distribution.</p>
        </div>
        <span className="qq-mono rounded bg-accent/20 px-2 py-1 text-[10px] text-accent-foreground">{shots} shots</span>
      </div>
      <BarChart
        items={items}
        valueLabel={(value) => `${value} shots`}
        color="#16B8A6"
        emptyLabel="Run a measurement to populate the shot chart."
        testId="chart-measurement-results"
      />
      <div className="mt-3 text-[10px] text-muted-foreground">Counts are sampled from the exact theoretical probabilities above.</div>
    </div>
  );
}

function BlochSphere({ vector }: { vector: Complex[] }) {
  const a = vector[0] ?? C(1);
  const b = vector[1] ?? C(0);
  const total = Math.max(0.0001, magnitudeSquared(a) + magnitudeSquared(b));
  const x = (2 * (a.re * b.re + a.im * b.im)) / total;
  const y = (2 * (a.re * b.im - a.im * b.re)) / total;
  const z = (magnitudeSquared(a) - magnitudeSquared(b)) / total;
  const px = 98 + x * 59;
  const py = 97 - z * 59;
  return (
    <div className="relative mx-auto h-[215px] w-[215px]" data-testid="visual-bloch-sphere">
      <svg viewBox="0 0 196 196" className="h-full w-full overflow-visible" aria-label="Bloch sphere">
        <defs>
          <linearGradient id="sphere-fill" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#e5f7f8" /><stop offset="1" stopColor="#c3e1e0" /></linearGradient>
        </defs>
        <circle cx="98" cy="98" r="61" fill="url(#sphere-fill)" fillOpacity=".48" stroke="#4a989e" strokeWidth="1.2" />
        <ellipse cx="98" cy="98" rx="61" ry="18" fill="none" stroke="#4a989e" strokeOpacity=".5" />
        <ellipse cx="98" cy="98" rx="21" ry="61" fill="none" stroke="#4a989e" strokeOpacity=".28" />
        <path d="M37 98h122M98 37v122" stroke="#4a989e" strokeOpacity=".55" strokeDasharray="3 4" />
        <path d={`M98 98 L${px} ${py}`} stroke="#e78c2e" strokeWidth="3" strokeLinecap="round" />
        <circle cx={px} cy={py} r="5.5" fill="#e78c2e" stroke="#fff7e7" strokeWidth="2" />
        <text x="98" y="25" textAnchor="middle" fill="#21404a" fontSize="10" fontFamily="DM Mono">|0⟩</text>
        <text x="98" y="184" textAnchor="middle" fill="#21404a" fontSize="10" fontFamily="DM Mono">|1⟩</text>
        <text x="173" y="102" textAnchor="middle" fill="#21404a" fontSize="10" fontFamily="DM Mono">+X</text>
        <text x="24" y="102" textAnchor="middle" fill="#21404a" fontSize="10" fontFamily="DM Mono">−X</text>
      </svg>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 qq-mono text-[10px] text-[#54717a]">x {x.toFixed(2)} · y {y.toFixed(2)} · z {z.toFixed(2)}</div>
    </div>
  );
}

function App() {
  const [qubits, setQubits] = useState(1);
  const [initial, setInitial] = useState<InitialState>('zero');
  const [vector, setVector] = useState<Complex[]>(() => initialVector(1, 'zero'));
  const [operations, setOperations] = useState<GateOp[]>([]);
  const [selectedGate, setSelectedGate] = useState<GateName>('H');
  const [target, setTarget] = useState(0);
  const [angle, setAngle] = useState(90);
  const [shots, setShots] = useState(100);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastMeasured, setLastMeasured] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [guided, setGuided] = useState(false);
  const [dark, setDark] = useState(false);
  const [activeSection, setActiveSection] = useState('explorer');

  const probabilities = useMemo(() => vector.map(magnitudeSquared), [vector]);
  const totalProbability = probabilities.reduce((sum, value) => sum + value, 0) || 1;
  const normalizedProbabilities = probabilities.map((value) => value / totalProbability);
  const maxProbability = Math.max(...normalizedProbabilities, 0.01);
  const visibleState = useMemo(() => normalizedProbabilities.map((probability, index) => ({
    index,
    label: stateLabel(index, qubits),
    amplitude: vector[index] ?? C(0),
    probability,
  })), [normalizedProbabilities, qubits, vector]);

  const reset = (nextQubits = qubits, nextInitial = initial) => {
    setQubits(nextQubits);
    setInitial(nextInitial);
    setVector(initialVector(nextQubits, nextInitial));
    setOperations([]);
    setCounts({});
    setLastMeasured(null);
    setOperationError(null);
    setTarget(0);
  };

  const chooseInitial = (next: InitialState) => {
    const nextQubits = next === 'bell' ? 2 : qubits;
    reset(nextQubits, next);
  };

  const addGate = () => {
    setOperationError(null);
    try {
      if (target < 0 || target >= qubits) throw new Error('Choose a valid target qubit.');
      const nextVector = applyGate(vector, selectedGate, target, qubits, angle);
      if (!nextVector.every((value) => Number.isFinite(value.re) && Number.isFinite(value.im))) {
        throw new Error('The gate produced an invalid state.');
      }
      const op = { gate: selectedGate, target, angle: selectedGate === 'RX' || selectedGate === 'RY' || selectedGate === 'RZ' ? angle : undefined };
      setVector(nextVector);
      setOperations((current) => [...current, op]);
      setLastMeasured(null);
    } catch {
      setOperationError(`Unable to apply ${selectedGate}. Reset the circuit and try again.`);
    }
  };

  const runBell = () => {
    let next = initialVector(2, 'zero');
    next = applyGate(next, 'H', 0, 2);
    next = applyCnot(next, 0, 1, 2);
    setQubits(2);
    setInitial('zero');
    setVector(next);
    setOperations([{ gate: 'H', target: 0 }, { gate: 'CX', target: 1 }]);
    setCounts({});
    setLastMeasured(null);
    setOperationError(null);
    setTarget(0);
    document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth' });
  };

  const measure = () => {
    const nextCounts: Record<string, number> = {};
    let latest = '';
    for (let shot = 0; shot < shots; shot += 1) {
      const random = Math.random();
      let cursor = 0;
      let result = normalizedProbabilities.length - 1;
      for (let index = 0; index < normalizedProbabilities.length; index += 1) {
        cursor += normalizedProbabilities[index];
        if (random <= cursor) { result = index; break; }
      }
      const label = stateLabel(result, qubits);
      nextCounts[label] = (nextCounts[label] ?? 0) + 1;
      latest = label;
    }
    setCounts(nextCounts);
    setLastMeasured(latest);
    setVector((current) => current.map((_, index) => index === Number.parseInt(latest.replace(/\D/g, ''), 2) ? C(1) : C(0)));
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="qq-shell min-h-[100dvh] text-foreground">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[246px] flex-col border-r border-sidebar-border bg-sidebar px-5 py-6 text-sidebar-foreground md:flex">
          <button type="button" onClick={() => scrollTo('explorer')} className="mb-10 flex items-center gap-3 text-left" data-testid="button-brand">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Atom size={21} strokeWidth={2.4} /></span>
            <span><strong className="block font-[var(--app-font-serif)] text-[17px] tracking-[-.04em] text-[#fff5df]">Qubit Quest</strong><span className="qq-kicker text-[9px] text-sidebar-foreground/60">EXPO INSTRUMENT</span></span>
          </button>
          <div className="mb-3 px-3 qq-kicker text-sidebar-foreground/45">Navigate</div>
          <nav className="space-y-1" aria-label="Primary">
            {[
              { id: 'explorer', label: 'Live explorer', Icon: Gauge },
              { id: 'bell', label: 'Bell state lab', Icon: Waves },
              { id: 'guide', label: 'Guided demo', Icon: Play },
              { id: 'learn', label: 'Learn the why', Icon: BookOpen },
            ].map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => scrollTo(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${activeSection === id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground'}`} data-testid={`nav-${id}`}>
                <Icon size={16} /><span>{label}</span>{activeSection === id && <ChevronRight className="ml-auto" size={14} />}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-sidebar-border bg-[#172b35] p-4">
            <div className="mb-3 flex items-center gap-2"><span className="qq-status-dot" /><span className="qq-kicker text-[9px] text-[#9fc4c3]">Local engine online</span></div>
            <p className="text-xs leading-relaxed text-sidebar-foreground/60">Every amplitude is calculated in your browser. No cloud, no waiting.</p>
            <button type="button" onClick={() => setGuided(true)} className="mt-4 flex items-center gap-2 text-xs font-bold text-sidebar-primary" data-testid="button-sidebar-guide">Open tour <ChevronRight size={13} /></button>
          </div>
        </aside>

        <header className="sticky top-0 z-20 border-b border-border/70 bg-[#f5f4ee]/90 px-5 py-3 backdrop-blur-md dark:bg-[#101c25]/90 md:ml-[246px] md:px-9">
          <div className="mx-auto flex max-w-[1380px] items-center justify-between">
            <div className="flex items-center gap-3 md:hidden"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Atom size={18} /></span><span className="font-[var(--app-font-serif)] font-bold">Qubit Quest</span></div>
            <div className="hidden items-center gap-2 md:flex"><span className="qq-kicker text-muted-foreground">Mission control</span><span className="h-1 w-1 rounded-full bg-accent" /><span className="text-xs text-muted-foreground">Explore → observe → understand</span></div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="qq-status-dot bg-[#45a49e]" /> Simulator ready</span>
              <button type="button" onClick={() => { setDark((value) => !value); document.documentElement.classList.toggle('dark', !dark); }} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Toggle theme" data-testid="button-toggle-theme">{dark ? <Sparkles size={16} /> : <Moon size={16} />}</button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1590px] md:ml-[246px]">
          <section id="explorer" className="qq-grid scroll-mt-20 border-b border-border/70 px-5 pb-10 pt-10 md:px-9 md:pb-14 md:pt-14">
            <div className="mx-auto max-w-[1380px]">
              <div className="mb-9 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                <div className="max-w-2xl qq-fade-up">
                  <div className="mb-4 flex items-center gap-2 text-primary"><ScanLine size={16} /><span className="qq-kicker">Live state laboratory / 01</span></div>
                  <h1 className="qq-display max-w-[720px] text-4xl font-bold leading-[.95] text-foreground sm:text-6xl">Make a qubit<br /><span className="text-primary">do something.</span></h1>
                  <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">Start with a state. Apply a gate. Watch probability move. Quantum computing begins as a feeling you can see.</p>
                </div>
                <div className="flex items-center gap-2 self-start lg:self-end">
                  <span className="qq-kicker text-muted-foreground">Experiment ID</span><span className="qq-mono rounded bg-foreground px-2 py-1 text-xs text-background">QQ–{operations.length.toString().padStart(2, '0')}</span>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
                <div className="qq-card qq-scanline rounded-2xl p-5 md:p-7">
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div><div className="qq-kicker text-primary">State setup</div><h2 className="mt-1 text-xl font-bold tracking-tight">Choose your starting point</h2></div>
                    <div className="flex rounded-lg border border-border bg-muted/60 p-1">
                      {[1, 2].map((value) => <button type="button" key={value} onClick={() => reset(value, value === 2 && initial === 'bell' ? 'bell' : 'zero')} className={`rounded-md px-3 py-1.5 qq-mono text-[11px] ${qubits === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`button-qubits-${value}`}>{value} qubit{value > 1 ? 's' : ''}</button>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([
                      ['zero', '|0⟩', 'Ground state'],
                      ['one', '|1⟩', 'Excited state'],
                      ['plus', '|+⟩', 'Equal chance'],
                      ['bell', 'Bell', 'Entangled pair'],
                    ] as [InitialState, string, string][]).map(([id, notation, label]) => (
                      <button type="button" key={id} disabled={id === 'bell' && qubits === 1} onClick={() => chooseInitial(id)} className={`group rounded-xl border p-3 text-left transition-all ${initial === id ? 'border-primary bg-primary/8 ring-1 ring-primary/20' : 'border-border bg-background/50 hover:border-primary/50'} disabled:cursor-not-allowed disabled:opacity-40`} data-testid={`button-initial-${id}`}>
                        <span className={`qq-display block text-2xl font-bold ${initial === id ? 'text-primary' : 'text-foreground'}`}>{notation}</span><span className="mt-1 block text-[10px] text-muted-foreground">{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-8 border-t border-dashed border-border pt-6">
                    <div className="mb-3 flex items-center justify-between"><div><div className="qq-kicker text-primary">Circuit sequence</div><p className="mt-1 text-xs text-muted-foreground">Gates act immediately on the live state.</p></div><span className="qq-mono text-[11px] text-muted-foreground">{operations.length} operation{operations.length === 1 ? '' : 's'}</span></div>
                    <div className="relative overflow-x-auto rounded-xl bg-[#e7f0ee] px-4 py-5 dark:bg-[#142d33]" data-testid="display-circuit">
                      <div className="absolute left-4 right-4 top-1/2 h-px bg-primary/35" />
                      <div className="relative flex min-w-max items-center gap-3">
                        <div className="z-10 grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-background qq-mono text-xs text-primary">q0</div>
                        {qubits === 2 && <div className="z-10 grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-background qq-mono text-xs text-primary">q1</div>}
                        {operations.length === 0 ? <span className="ml-3 z-10 rounded-md border border-dashed border-primary/30 bg-[#e7f0ee] px-4 py-2 text-xs text-muted-foreground dark:bg-[#142d33]">Your first move is waiting</span> : operations.map((operation, index) => <div key={`${operation.gate}-${index}`} className="qq-gate-pop z-10 grid h-10 min-w-10 place-items-center rounded-lg border border-accent/70 bg-accent px-2 qq-mono text-xs font-bold text-accent-foreground shadow-sm" data-testid={`gate-chip-${index}`}>{operation.gate}{operation.angle ? <sup className="ml-0.5 text-[8px]">{operation.angle}°</sup> : null}<span className="absolute mt-14 text-[9px] font-normal text-muted-foreground">q{operation.target}</span></div>)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-7 rounded-xl border border-border bg-background/70 p-4">
                    <div className="mb-4 flex items-center justify-between"><div><div className="qq-kicker text-primary">Gate deck</div><p className="mt-1 text-xs text-muted-foreground">Select a gate, then press Apply to add it to q{target}.</p></div><Target size={18} className="text-accent" /></div>
                    {operationError && <div className="mb-4 rounded-lg border border-[#FF7657]/40 bg-[#FF7657]/10 px-3 py-2 text-xs text-[#b84c38]" role="alert">{operationError}</div>}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                      {(['X', 'Y', 'Z', 'H', 'S', 'T', 'RX', 'RY', 'RZ'] as GateName[]).map((gate) => <button type="button" key={gate} onClick={() => { setSelectedGate(gate); setOperationError(null); }} className={`rounded-lg border py-2.5 qq-mono text-xs font-medium transition-all ${selectedGate === gate ? 'border-primary bg-primary text-primary-foreground shadow-md' : 'border-border hover:border-primary/60 hover:bg-primary/5'}`} data-testid={`button-gate-${gate}`}>{gate}</button>)}
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex-1"><span className="qq-kicker mb-1.5 block text-muted-foreground">Target qubit</span><select value={target} onChange={(event) => setTarget(Number(event.target.value))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="select-target-qubit">{Array.from({ length: qubits }, (_, index) => <option value={index} key={index}>q{index} — {index === 0 ? 'primary wire' : 'secondary wire'}</option>)}</select></label>
                      <label className="flex-1"><span className="qq-kicker mb-1.5 flex justify-between text-muted-foreground"><span>Rotation angle</span><span className="text-foreground">{angle}°</span></span><input type="range" min="-180" max="180" step="15" value={angle} onChange={(event) => setAngle(Number(event.target.value))} className="mt-3 w-full accent-[#e78c2e]" data-testid="input-angle" /></label>
                      <button type="button" onClick={addGate} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-apply-gate"><Zap size={15} /> Apply {selectedGate}</button>
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">{selectedGate}:</strong> {selectedGate === 'S' ? 'adds a 90° phase to the |1⟩ amplitude. On |0⟩, probabilities correctly remain 100% |0⟩.' : selectedGate === 'H' ? 'creates superposition from a basis state.' : selectedGate === 'X' ? 'swaps |0⟩ and |1⟩.' : 'changes the state using its unitary matrix.'}</p>
                  </div>
                  <div className="mt-4 flex justify-end"><button type="button" onClick={() => reset()} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground" data-testid="button-reset-circuit"><RotateCcw size={13} /> Reset circuit</button></div>
                </div>

                <div className="space-y-5">
                  <div className="qq-card rounded-2xl p-5 md:p-7" data-testid="panel-state-vector">
                    <div className="mb-6 flex items-start justify-between"><div><div className="qq-kicker text-primary">Readout / state vector</div><h2 className="mt-1 text-xl font-bold tracking-tight">What exists right now?</h2></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><Layers3 size={19} /></div></div>
                    <div className="space-y-2">
                      {visibleState.map(({ label, amplitude, probability }) => <div key={label} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${probability > 0.001 ? 'border-primary/20 bg-primary/5' : 'border-border/70 opacity-50'}`} data-testid={`row-state-${label}`}><span className="w-12 qq-mono text-xs text-primary">{label}</span><span className="flex-1 qq-mono text-xs text-foreground">{formatComplex(amplitude)} {phaseLabel(amplitude) && <span className="ml-2 text-[10px] text-accent-foreground">({phaseLabel(amplitude)})</span>}</span><span className="w-11 text-right qq-mono text-[11px] text-muted-foreground">{probabilityLabel(probability)}</span></div>)}
                    </div>
                    <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/70 p-3 text-xs leading-relaxed text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0 text-primary" />Amplitudes can be negative or imaginary. Probabilities are the square of their magnitude.</div>
                  </div>
                  <div className="qq-card rounded-2xl p-5 md:p-7" data-testid="panel-probabilities">
                    <div className="mb-5 flex items-start justify-between"><div><div className="qq-kicker text-primary">Probability field</div><h2 className="mt-1 text-xl font-bold tracking-tight">Where will it land?</h2></div><span className="qq-mono rounded bg-accent/20 px-2 py-1 text-[10px] text-accent-foreground">{qubits}D basis</span></div>
                    <div className="space-y-3">{visibleState.map(({ label, probability, index }) => <div key={label} data-testid={`bar-probability-${index}`}><div className="mb-1 flex justify-between qq-mono text-[10px] text-muted-foreground"><span>{label}</span><span>{probabilityLabel(probability)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(probability / maxProbability) * 100}%` }} /></div></div>)}</div>
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-xs text-muted-foreground">Norm check</span><span className="qq-mono text-xs text-primary">{(totalProbability * 100).toFixed(2)}% <Check size={13} className="ml-1 inline" /></span></div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[.88fr_1.12fr]">
                <div className="qq-card rounded-2xl p-5 md:p-7" data-testid="panel-bloch">
                  <div className="mb-2"><div className="qq-kicker text-primary">Geometric readout</div><h2 className="mt-1 text-xl font-bold tracking-tight">Bloch sphere</h2><p className="mt-1 text-xs text-muted-foreground">A qubit’s full state, compressed into one moving point.</p></div>
                  {qubits === 1 ? <BlochSphere vector={vector} /> : <div className="flex h-[215px] flex-col items-center justify-center text-center"><div className="mb-3 rounded-full border border-dashed border-primary/30 p-4 text-primary"><Layers3 size={22} /></div><p className="text-sm font-semibold">One sphere per qubit</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">The pair is currently entangled. Switch to one qubit to inspect its geometry.</p></div>}
                </div>
                <div className="qq-card rounded-2xl p-5 md:p-7" data-testid="panel-measurement">
                  <div className="mb-5 flex items-start justify-between"><div><div className="qq-kicker text-primary">Observation deck</div><h2 className="mt-1 text-xl font-bold tracking-tight">Measure the state</h2><p className="mt-1 text-xs text-muted-foreground">Measurement collapses one live state into a classical answer.</p></div><div className="rounded-lg bg-accent/20 p-2 text-accent-foreground"><ScanLine size={19} /></div></div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1"><span className="qq-kicker mb-1.5 block text-muted-foreground">Number of shots</span><select value={shots} onChange={(event) => setShots(Number(event.target.value))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="select-shots"><option value="1">1 shot — instant</option><option value="10">10 shots — quick look</option><option value="100">100 shots — reliable</option><option value="500">500 shots — smooth curve</option><option value="1000">1,000 shots — expo mode</option></select></label><button type="button" onClick={measure} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90" data-testid="button-measure"><ScanLine size={15} /> Run measurement</button></div>
                  {lastMeasured && <div className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs"><span className="qq-kicker text-accent-foreground">Latest collapse</span><strong className="ml-2 qq-mono text-sm">{lastMeasured}</strong></div>}
                  <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">{Object.entries(counts).length === 0 ? <div className="qq-dashed col-span-2 rounded-lg p-5 text-center text-xs text-muted-foreground">Run a measurement to populate the shot histogram.</div> : Object.entries(counts).map(([label, count]) => <div key={label} data-testid={`result-${label}`}><div className="mb-1 flex justify-between qq-mono text-[10px]"><span>{label}</span><span>{count} / {shots}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(count / shots) * 100}%` }} /></div></div>)}</div>
                </div>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <ProbabilityChart items={visibleState.map(({ label, probability }) => ({ label, value: probability }))} />
                <MeasurementChart counts={counts} shots={shots} />
              </div>
            </div>
          </section>

          <section id="bell" className="scroll-mt-20 border-b border-border/70 bg-[#e9f0eb] px-5 py-14 dark:bg-[#13242a] md:px-9 md:py-20">
            <div className="mx-auto grid max-w-[1380px] items-center gap-10 lg:grid-cols-[.8fr_1.2fr]">
              <div><div className="mb-4 flex items-center gap-2 text-primary"><Waves size={16} /><span className="qq-kicker">Bell state lab / 02</span></div><h2 className="qq-display text-4xl font-bold leading-[.98] sm:text-5xl">Two particles.<br /><span className="text-primary">One story.</span></h2><p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">Entanglement is not a secret signal. It is a shared mathematical state: measure one qubit and the other agrees, even before you know which answer arrives.</p><button type="button" onClick={runBell} className="mt-7 flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-bold text-background hover:-translate-y-0.5" data-testid="button-run-bell"><Play size={15} /> Load Bell experiment <ChevronRight size={15} /></button></div>
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[#d9e8e5] p-6 dark:bg-[#17353b]"><div className="absolute right-5 top-5 qq-kicker text-primary/70">|Φ+⟩ = (|00⟩ + |11⟩) / √2</div><div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4"><div className="text-center"><div className="mx-auto mb-3 grid h-24 w-24 place-items-center rounded-full border-2 border-primary/40 bg-[#eff8f1] text-3xl text-primary dark:bg-[#20454a]">q0</div><span className="qq-mono text-xs text-muted-foreground">50% |0⟩ · 50% |1⟩</span></div><div className="relative h-1 w-24 bg-accent"><span className="absolute -left-1 -top-1.5 h-4 w-4 rounded-full border-2 border-[#d9e8e5] bg-accent dark:border-[#17353b]" /><span className="absolute -right-1 -top-1.5 h-4 w-4 rounded-full border-2 border-[#d9e8e5] bg-accent dark:border-[#17353b]" /></div><div className="text-center"><div className="mx-auto mb-3 grid h-24 w-24 place-items-center rounded-full border-2 border-primary/40 bg-[#eff8f1] text-3xl text-primary dark:bg-[#20454a]">q1</div><span className="qq-mono text-xs text-muted-foreground">same result · always</span></div></div><div className="mt-7 rounded-lg border border-primary/20 bg-background/60 p-3 text-center text-xs text-muted-foreground"><span className="text-accent-foreground">H</span> on q0 creates possibility. <span className="text-accent-foreground">CNOT</span> copies the relationship, not the answer.</div></div>
            </div>
          </section>

          <section id="guide" className="scroll-mt-20 border-b border-border/70 px-5 py-14 md:px-9 md:py-20">
            <div className="mx-auto max-w-[1380px]">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-4 flex items-center gap-2 text-primary"><GraduationCap size={16} /><span className="qq-kicker">Guided expo mode / 03</span></div><h2 className="qq-display text-4xl font-bold leading-none sm:text-5xl">A good first<br /><span className="text-primary">ten seconds.</span></h2></div><button type="button" onClick={() => setGuided((value) => !value)} className={`flex items-center gap-2 self-start rounded-lg border px-4 py-2.5 text-sm font-bold ${guided ? 'border-accent bg-accent text-accent-foreground' : 'border-border hover:border-primary'}`} data-testid="button-toggle-guided">{guided ? <Check size={15} /> : <Play size={15} />} {guided ? 'Demo active' : 'Start demo mode'}</button></div>
              {guided && <div className="qq-fade-up mt-7 grid gap-4 rounded-2xl border border-accent/40 bg-accent/10 p-5 md:grid-cols-[auto_1fr_auto] md:items-center" data-testid="panel-guided"><div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground"><span className="qq-mono text-sm">01</span></div><div><p className="font-bold">Put possibility on the board</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Click <strong>H</strong> in the Gate deck, then Apply H. The state vector will split into two equal amplitudes.</p></div><button type="button" onClick={() => { reset(1, 'zero'); setSelectedGate('H'); }} className="rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background" data-testid="button-guided-reset">Set up step 1</button></div>}
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {[
                  ['01', 'Prepare', 'Choose |0⟩. It is the quietest possible starting line.', 'Start with certainty.'],
                  ['02', 'Transform', 'Apply H. One basis state becomes two possible paths.', 'Make probability move.'],
                  ['03', 'Observe', 'Run 100 shots. The pattern converges while each shot surprises.', 'Turn math into evidence.'],
                ].map(([number, title, body, footer]) => <div key={number} className="qq-card group rounded-2xl p-5 transition-transform hover:-translate-y-1" data-testid={`card-guide-${number}`}><span className="qq-mono text-4xl text-accent/70">{number}</span><h3 className="mt-7 text-lg font-bold">{title}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{body}</p><div className="mt-7 flex items-center gap-2 border-t border-border pt-3 text-xs font-semibold text-primary"><ArrowRightIcon />{footer}</div></div>)}
              </div>
            </div>
          </section>

           <section id="learn" className="scroll-mt-20 bg-[#172b35] px-5 py-14 text-[#e4efeb] md:px-9 md:py-20">
             <div className="mx-auto max-w-[1380px]"><div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-4 flex items-center gap-2 text-[#e9a24b]"><BookOpen size={16} /></div><h2 className="qq-display max-w-xl text-4xl font-bold leading-[.98] sm:text-5xl">The instrument,<br /><span className="text-[#78d2cf]">explained.</span></h2></div><p className="max-w-sm text-sm leading-6 text-[#a8c0bc]">A simulator is useful when it turns a black box into a conversation. These cards are designed for the moment after the “wow.”</p></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  [CircleHelp, 'The problem', 'Quantum notation is precise but visually distant. Beginners see symbols before they see cause and effect.'],
                  [Sparkles, 'The solution', 'Qubit Quest makes every gate a tactile, reversible experiment: action first, explanation immediately after.'],
                  [Zap, 'What is novel', 'The probability field, vector readout, and Bloch geometry update together, so one idea has three visible proofs.'],
                  [Code2, 'Qiskit bridge', 'The same circuit maps cleanly to Qiskit: QuantumCircuit.h(0), measure_all(), and a histogram of the results.'],
                ].map(([Icon, title, body]) => <article key={title as string} className="rounded-2xl border border-[#31515b] bg-[#1e3943] p-5" data-testid={`card-faculty-${title}`}><Icon size={19} className="mb-8 text-[#e9a24b]" /><h3 className="text-lg font-bold">{title as string}</h3><p className="mt-3 text-sm leading-6 text-[#a8c0bc]">{body as string}</p></article>)}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
                <article className="rounded-2xl border border-[#31515b] bg-[#1e3943] p-6" data-testid="card-architecture"><div className="mb-5 flex items-center gap-2 text-[#78d2cf]"><Cpu size={17} /><span className="qq-kicker">Architecture</span></div><div className="grid gap-3 sm:grid-cols-3">{[['01', 'State', 'Complex amplitudes'], ['02', 'Operator', 'Unitary gate matrix'], ['03', 'Readout', 'Random sampling']].map(([number, title, body]) => <div key={number} className="border-l border-[#4a7274] pl-3"><span className="qq-mono text-xs text-[#e9a24b]">{number}</span><p className="mt-2 text-sm font-bold">{title}</p><p className="mt-1 text-xs text-[#a8c0bc]">{body}</p></div>)}</div></article>
                <article className="rounded-2xl border border-[#31515b] bg-[#1e3943] p-6" data-testid="card-fundamentals"><div className="mb-5 flex items-center gap-2 text-[#78d2cf]"><Terminal size={17} /><span className="qq-kicker">Fundamentals</span></div><p className="qq-mono text-sm leading-7 text-[#d6e8e2]">|ψ⟩ = α|0⟩ + β|1⟩</p><p className="mt-3 text-xs leading-5 text-[#a8c0bc]">The rule that keeps the universe honest: <span className="text-[#e9a24b]">|α|² + |β|² = 1</span>.</p></article>
              </div>
              <div className="mt-12 flex flex-col justify-between gap-4 border-t border-[#31515b] pt-5 text-xs text-[#71908d] sm:flex-row"><span>Qubit Quest · An open learning instrument for curious minds</span><span className="flex items-center gap-1">Built for the expo floor <ExternalLink size={12} /></span></div>
            </div>
          </section>
        </main>
        <div className="fixed bottom-4 right-4 z-40 md:hidden"><button type="button" onClick={() => scrollTo('explorer')} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground shadow-xl" aria-label="Back to explorer" data-testid="button-mobile-back"><X size={17} className="rotate-45" /></button></div>
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return <ChevronRight size={14} />;
}

export default App;
