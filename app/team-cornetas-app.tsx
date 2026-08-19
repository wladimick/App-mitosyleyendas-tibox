"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createEncounter, fetchEncounters } from "../lib/cloud";
import {
  calculateMetrics,
  filterEncountersByPeriod,
  normalize,
  scoreEncounter,
  type Encounter,
  type EncounterFormat,
  type Period,
  type Side,
} from "../lib/domain";
import {
  ACTIVE_PLAYER_STORAGE_KEY,
  isTeamPlayer,
  TEAM_PLAYERS,
  type TeamPlayer,
} from "../lib/players";

type FormState = {
  date: string;
  format: EncounterFormat;
  playerA: string;
  raceA: string;
  playerB: string;
  raceB: string;
};

type AppTab = "play" | "metrics";

type PlayerVisual = {
  gradient: string;
  sigil: string;
};

const PLAYER_VISUALS: Record<TeamPlayer, PlayerVisual> = {
  Braulio: { gradient: "linear-gradient(145deg,#194a78,#d59a3a)", sigil: "⚔" },
  Wladimick: { gradient: "linear-gradient(145deg,#352016,#d9a43e)", sigil: "♛" },
  Ignacio: { gradient: "linear-gradient(145deg,#173d2c,#718b45)", sigil: "♞" },
  Diego: { gradient: "linear-gradient(145deg,#6d2117,#f07332)", sigil: "✦" },
  Claudio: { gradient: "linear-gradient(145deg,#31577d,#9cccf5)", sigil: "✧" },
  Diever: { gradient: "linear-gradient(145deg,#172b45,#527ba9)", sigil: "☠" },
  Cristobal: { gradient: "linear-gradient(145deg,#3d4d22,#a3a44f)", sigil: "➶" },
  Renzo: { gradient: "linear-gradient(145deg,#173b61,#5a91ce)", sigil: "⬟" },
};

const periodLabels: Record<Period, string> = {
  today: "Hoy",
  month: "Mes",
  all: "Histórico",
};

const RACE_COLORS = ["#e7b85d", "#6f9a54", "#5578b9", "#bb4437", "#8b9099"];

function todayInputValue() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function makeId(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function TeamCornetasApp() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [activePlayer, setActivePlayer] = useState<TeamPlayer | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("play");
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [diceValue, setDiceValue] = useState(1);
  const [diceRolling, setDiceRolling] = useState(false);
  const [form, setForm] = useState<FormState>({
    date: "",
    format: "lunch",
    playerA: "",
    raceA: "",
    playerB: "",
    raceB: "",
  });
  const [diceWinner, setDiceWinner] = useState<Side>("a");
  const [winner, setWinner] = useState<Side>("a");
  const [formMessage, setFormMessage] = useState("");

  async function refreshCloud(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await fetchEncounters();
      setEncounters(data);
      setCloudError("");
      setLastSync(new Date());
    } catch (error) {
      console.error(error);
      setCloudError("No se pudo sincronizar con Supabase.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const storedPlayer = window.localStorage.getItem(ACTIVE_PLAYER_STORAGE_KEY);
    if (isTeamPlayer(storedPlayer)) {
      setActivePlayer(storedPlayer);
      setForm((current) => ({ ...current, playerA: storedPlayer }));
    }

    setForm((current) => ({ ...current, date: todayInputValue() }));
    setProfileReady(true);
    void refreshCloud();

    const interval = window.setInterval(() => void refreshCloud(true), 15_000);
    const onFocus = () => void refreshCloud(true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const filteredEncounters = useMemo(
    () => filterEncountersByPeriod(encounters, period),
    [encounters, period],
  );
  const metrics = useMemo(() => calculateMetrics(filteredEncounters), [filteredEncounters]);
  const activeStats = useMemo(
    () => metrics.players.find((player) => player.name === activePlayer),
    [activePlayer, metrics.players],
  );
  const raceSuggestions = useMemo(
    () => Array.from(new Set(encounters.flatMap((item) => [normalize(item.raceA), normalize(item.raceB)]))).filter(Boolean),
    [encounters],
  );
  const sortedEncounters = useMemo(
    () => [...filteredEncounters].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [filteredEncounters],
  );

  function choosePlayer(player: TeamPlayer) {
    window.localStorage.setItem(ACTIVE_PLAYER_STORAGE_KEY, player);
    setActivePlayer(player);
    setActiveTab("play");
    setForm((current) => ({
      ...current,
      playerA: player,
      playerB: current.playerB === player ? "" : current.playerB,
    }));
  }

  function changePlayer() {
    window.localStorage.removeItem(ACTIVE_PLAYER_STORAGE_KEY);
    setActivePlayer(null);
    setActiveTab("play");
  }

  function rollDice() {
    if (diceRolling) return;
    setDiceRolling(true);
    window.setTimeout(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      setDiceRolling(false);
    }, 850);
  }

  async function submitEncounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");
    if (!activePlayer) return;

    const cleaned = {
      playerA: normalize(form.playerA),
      raceA: normalize(form.raceA),
      playerB: normalize(form.playerB),
      raceB: normalize(form.raceB),
    };

    if (!form.date || !cleaned.playerA || !cleaned.playerB || !cleaned.raceA || !cleaned.raceB) {
      setFormMessage("Completa jugadores y razas.");
      return;
    }
    if (cleaned.playerA === cleaned.playerB) {
      setFormMessage("Selecciona jugadores distintos.");
      return;
    }

    setSaving(true);
    try {
      await createEncounter(
        {
          date: form.date,
          format: form.format,
          playerA: cleaned.playerA,
          raceA: cleaned.raceA,
          playerB: cleaned.playerB,
          raceB: cleaned.raceB,
          games: [{ id: makeId("game"), diceWinner, winner }],
        },
        activePlayer,
      );

      await refreshCloud(true);
      setForm((current) => ({
        ...current,
        playerA: activePlayer,
        raceA: "",
        playerB: "",
        raceB: "",
      }));
      setDiceWinner("a");
      setWinner("a");
      setFormMessage("Partida guardada.");
    } catch (error) {
      console.error(error);
      setFormMessage("No se pudo guardar la partida.");
    } finally {
      setSaving(false);
    }
  }

  if (!profileReady) return null;
  if (!activePlayer) return <PlayerSelector onChoose={choosePlayer} />;

  return (
    <div className="dashboard-shell">
      <aside className="app-sidebar">
        <div className="sidebar-logo-wrap">
          <img className="sidebar-logo" src="/team-cornetas-logo.webp" alt="Team Cornetas" />
        </div>
        <nav className="sidebar-nav" aria-label="Secciones">
          <button className={activeTab === "play" ? "active" : ""} onClick={() => setActiveTab("play")}>
            <span>⌂</span> Registrar partida
          </button>
          <button className={activeTab === "metrics" ? "active" : ""} onClick={() => setActiveTab("metrics")}>
            <span>◔</span> Métricas
          </button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <span className={cloudError ? "cloud-dot error" : "cloud-dot"} />
          <div>
            <strong>{cloudError ? "Sin conexión" : "Supabase"}</strong>
            <small>{lastSync ? lastSync.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "Conectando"}</small>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-header">
          <div className="mobile-brand"><img src="/team-cornetas-logo.webp" alt="Team Cornetas" /></div>
          <nav className="top-tabs" aria-label="Vista">
            <button className={activeTab === "play" ? "active" : ""} onClick={() => setActiveTab("play")}>Registrar partida</button>
            <button className={activeTab === "metrics" ? "active" : ""} onClick={() => setActiveTab("metrics")}>Métricas</button>
          </nav>
          <button className="active-user" type="button" onClick={changePlayer} title="Cambiar jugador">
            <PlayerAvatar player={activePlayer} size="sm" />
            <span><strong>{activePlayer}</strong><small>Cambiar</small></span>
            <b>⌄</b>
          </button>
        </header>

        {cloudError && (
          <div className="inline-alert">
            <span>{cloudError}</span>
            <button onClick={() => void refreshCloud()}>Reintentar</button>
          </div>
        )}

        {activeTab === "play" ? (
          <PlayView
            activePlayer={activePlayer}
            form={form}
            setForm={setForm}
            raceSuggestions={raceSuggestions}
            diceWinner={diceWinner}
            setDiceWinner={setDiceWinner}
            winner={winner}
            setWinner={setWinner}
            saving={saving}
            formMessage={formMessage}
            submitEncounter={submitEncounter}
            diceValue={diceValue}
            diceRolling={diceRolling}
            rollDice={rollDice}
          />
        ) : (
          <MetricsView
            activePlayer={activePlayer}
            activeStats={activeStats}
            period={period}
            setPeriod={setPeriod}
            loading={loading}
            refreshCloud={refreshCloud}
            metrics={metrics}
            sortedEncounters={sortedEncounters}
          />
        )}
      </main>
    </div>
  );
}

function PlayerSelector({ onChoose }: { onChoose: (player: TeamPlayer) => void }) {
  return (
    <main className="selector-shell">
      <section className="selector-card">
        <img className="selector-logo" src="/team-cornetas-logo.webp" alt="Team Cornetas" />
        <div className="selector-title"><span>TEAM CORNETAS</span><h1>Elige jugador</h1></div>
        <div className="selector-grid">
          {TEAM_PLAYERS.map((player) => (
            <button key={player} className="selector-player" type="button" onClick={() => onChoose(player)}>
              <PlayerAvatar player={player} size="lg" />
              <strong>{player}</strong>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function PlayView({
  activePlayer,
  form,
  setForm,
  raceSuggestions,
  diceWinner,
  setDiceWinner,
  winner,
  setWinner,
  saving,
  formMessage,
  submitEncounter,
  diceValue,
  diceRolling,
  rollDice,
}: {
  activePlayer: TeamPlayer;
  form: FormState;
  setForm: (form: FormState) => void;
  raceSuggestions: string[];
  diceWinner: Side;
  setDiceWinner: (side: Side) => void;
  winner: Side;
  setWinner: (side: Side) => void;
  saving: boolean;
  formMessage: string;
  submitEncounter: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  diceValue: number;
  diceRolling: boolean;
  rollDice: () => void;
}) {
  return (
    <section className="page-section play-section">
      <div className="player-strip" aria-label="Jugadores del team">
        {TEAM_PLAYERS.map((player) => (
          <button
            key={player}
            className={`strip-player ${form.playerA === player ? "selected" : ""}`}
            type="button"
            onClick={() => setForm({ ...form, playerA: player, playerB: form.playerB === player ? "" : form.playerB })}
          >
            <PlayerAvatar player={player} size="md" />
            <span>{player}</span>
          </button>
        ))}
      </div>

      <div className="play-grid">
        <article className="registration-card">
          <div className="card-title-row">
            <div><span className="micro-label">REGISTRO RÁPIDO</span><h2>Nueva partida</h2></div>
            <span className="single-game-chip">1 partida</span>
          </div>

          <form onSubmit={submitEncounter}>
            <div className="form-grid compact-row">
              <label>Fecha<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
              <label>Contexto<select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as EncounterFormat })}><option value="lunch">Almuerzo</option><option value="bo3">Torneo</option></select></label>
            </div>

            <div className="matchup-panel">
              <div className="match-player match-a">
                <div className="match-player-head"><PlayerAvatar player={(form.playerA || activePlayer) as TeamPlayer} size="sm" /><span>Jugador A</span></div>
                <select value={form.playerA} onChange={(event) => setForm({ ...form, playerA: event.target.value, playerB: form.playerB === event.target.value ? "" : form.playerB })}>
                  {TEAM_PLAYERS.map((player) => <option key={player} value={player}>{player}</option>)}
                </select>
                <input list="races" placeholder="Raza / mazo" value={form.raceA} onChange={(event) => setForm({ ...form, raceA: event.target.value })} />
              </div>

              <div className="versus-token">VS</div>

              <div className="match-player match-b">
                <div className="match-player-head">
                  {isTeamPlayer(form.playerB) ? <PlayerAvatar player={form.playerB} size="sm" /> : <span className="avatar-placeholder">?</span>}
                  <span>Jugador B</span>
                </div>
                <select value={form.playerB} onChange={(event) => setForm({ ...form, playerB: event.target.value })}>
                  <option value="">Seleccionar rival</option>
                  {TEAM_PLAYERS.filter((player) => player !== form.playerA).map((player) => <option key={player} value={player}>{player}</option>)}
                </select>
                <input list="races" placeholder="Raza / mazo" value={form.raceB} onChange={(event) => setForm({ ...form, raceB: event.target.value })} />
              </div>
            </div>

            <datalist id="races">{raceSuggestions.map((race) => <option key={race} value={race} />)}</datalist>

            <div className="result-grid">
              <label>Ganó el dado<select value={diceWinner} onChange={(event) => setDiceWinner(event.target.value as Side)}><option value="a">{form.playerA || "Jugador A"}</option><option value="b">{form.playerB || "Jugador B"}</option></select></label>
              <label>Ganó la partida<select value={winner} onChange={(event) => setWinner(event.target.value as Side)}><option value="a">{form.playerA || "Jugador A"}</option><option value="b">{form.playerB || "Jugador B"}</option></select></label>
            </div>

            {formMessage && <div className={formMessage === "Partida guardada." ? "form-status success" : "form-status"}>{formMessage}</div>}
            <button className="save-match" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar partida"}</button>
          </form>
        </article>

        <DiceCard value={diceValue} rolling={diceRolling} onRoll={rollDice} />
      </div>
    </section>
  );
}

function DiceCard({ value, rolling, onRoll }: { value: number; rolling: boolean; onRoll: () => void }) {
  return (
    <article className="dice-card">
      <div className="dice-card-title"><span>◇</span><strong>Tirar dado</strong></div>
      <div className="dice-stage">
        <div className="dice-orbit orbit-one" />
        <div className="dice-orbit orbit-two" />
        <div className={`dice-cube show-${value} ${rolling ? "rolling" : ""}`}>
          <div className="dice-side dice-one">⚀</div>
          <div className="dice-side dice-two">⚁</div>
          <div className="dice-side dice-three">⚂</div>
          <div className="dice-side dice-four">⚃</div>
          <div className="dice-side dice-five">⚄</div>
          <div className="dice-side dice-six">⚅</div>
        </div>
        <div className="dice-glow" />
      </div>
      <div className="dice-result"><span>Resultado</span><strong>{rolling ? "…" : value}</strong></div>
      <button className="roll-button" type="button" onClick={onRoll} disabled={rolling}><span>◇</span>{rolling ? "Girando…" : "Tirar dado"}</button>
    </article>
  );
}

function MetricsView({
  activePlayer,
  activeStats,
  period,
  setPeriod,
  loading,
  refreshCloud,
  metrics,
  sortedEncounters,
}: {
  activePlayer: TeamPlayer;
  activeStats: ReturnType<typeof calculateMetrics>["players"][number] | undefined;
  period: Period;
  setPeriod: (period: Period) => void;
  loading: boolean;
  refreshCloud: (silent?: boolean) => Promise<void>;
  metrics: ReturnType<typeof calculateMetrics>;
  sortedEncounters: Encounter[];
}) {
  const rankedPlayers = TEAM_PLAYERS.map((name) => {
    const stat = metrics.players.find((item) => item.name === name);
    return stat ?? { name, games: 0, wins: 0, losses: 0, winrate: 0 };
  }).sort((a, b) => b.winrate - a.winrate || b.wins - a.wins || b.games - a.games);

  const raceTotal = metrics.races.reduce((sum, race) => sum + race.games, 0) || 1;
  let cursor = 0;
  const donutStops = metrics.races.slice(0, 5).map((race, index) => {
    const start = cursor;
    const size = (race.games / raceTotal) * 100;
    cursor += size;
    return `${RACE_COLORS[index]} ${start}% ${cursor}%`;
  });
  if (cursor < 100) donutStops.push(`#252a31 ${cursor}% 100%`);

  return (
    <section className="page-section metrics-section">
      <div className="metrics-toolbar">
        <div className="period-pills">
          {(Object.keys(periodLabels) as Period[]).map((key) => <button key={key} className={period === key ? "active" : ""} onClick={() => setPeriod(key)}>{periodLabels[key]}</button>)}
        </div>
        <button className="sync-button" onClick={() => void refreshCloud()} disabled={loading}>{loading ? "Sincronizando…" : "↻ Actualizar"}</button>
      </div>

      <div className="kpi-grid">
        <KpiCard icon="⚔" label="Total partidas" value={metrics.games.toString()} helper={`${metrics.encounters} registros`} />
        <KpiCard icon="◎" label={`Winrate · ${activePlayer}`} value={`${activeStats?.winrate ?? 0}%`} helper={`${activeStats?.wins ?? 0}V · ${activeStats?.losses ?? 0}D`} ring={activeStats?.winrate ?? 0} />
        <KpiCard icon="♛" label="Líder actual" value={metrics.players[0]?.name ?? "—"} helper={metrics.players[0] ? `${metrics.players[0].winrate}% winrate` : "Sin partidas"} player={isTeamPlayer(metrics.players[0]?.name ?? null) ? metrics.players[0].name as TeamPlayer : undefined} />
        <KpiCard icon="◇" label="Ventaja del dado" value={`${metrics.diceAdvantage}%`} helper={`${metrics.diceWinnerGameWins}/${metrics.games || 0} partidas`} />
      </div>

      <div className="analytics-grid">
        <article className="analytics-card ranking-card">
          <div className="analytics-title"><h3>Ranking de jugadores</h3><span>Winrate</span></div>
          <div className="ranking-stack">
            {rankedPlayers.map((player, index) => (
              <div className={`ranking-item ${player.name === activePlayer ? "is-me" : ""}`} key={player.name}>
                <span className="position">{index + 1}</span>
                <PlayerAvatar player={player.name as TeamPlayer} size="xs" />
                <div className="rank-person"><strong>{player.name}</strong><small>{player.wins}V · {player.losses}D</small></div>
                <div className="rank-bar"><i style={{ width: `${player.winrate}%` }} /></div>
                <b>{player.winrate}%</b>
              </div>
            ))}
          </div>
        </article>

        <article className="analytics-card race-card">
          <div className="analytics-title"><h3>Rendimiento por raza/mazo</h3></div>
          {metrics.races.length === 0 ? <EmptyState text="Sin datos de razas todavía." /> : (
            <>
              <div className="race-overview">
                <div className="donut" style={{ background: `conic-gradient(${donutStops.join(",")})` }}><span>{metrics.races.length}<small>mazos</small></span></div>
                <div className="race-legend">{metrics.races.slice(0, 5).map((race, index) => <div key={race.race}><i style={{ background: RACE_COLORS[index] }} /><span>{race.race}</span><b>{Math.round((race.games / raceTotal) * 100)}%</b></div>)}</div>
              </div>
              <div className="race-bars">{metrics.races.slice(0, 5).map((race, index) => <div key={race.race}><span>{race.race}</span><div><i style={{ width: `${race.winrate}%`, background: RACE_COLORS[index] }} /></div><b>{race.winrate}%</b></div>)}</div>
            </>
          )}
        </article>

        <article className="analytics-card activity-card">
          <div className="analytics-title"><h3>Actividad</h3><span>{periodLabels[period]}</span></div>
          <ActivityChart encounters={sortedEncounters} />
        </article>

        <article className="analytics-card recent-card">
          <div className="analytics-title"><h3>Últimas partidas</h3><span>Resultado</span></div>
          {sortedEncounters.length === 0 ? <EmptyState text="Aún no hay partidas." /> : (
            <div className="recent-list">
              {sortedEncounters.slice(0, 7).map((encounter) => {
                const score = scoreEncounter(encounter);
                const winnerName = score.a > score.b ? encounter.playerA : encounter.playerB;
                return (
                  <div className="recent-row" key={encounter.id}>
                    <div className="recent-players">
                      {isTeamPlayer(encounter.playerA) && <PlayerAvatar player={encounter.playerA} size="xs" />}
                      <strong>{encounter.playerA}</strong><span>vs</span><strong>{encounter.playerB}</strong>
                    </div>
                    <div className="recent-result"><span className="winner-dot">◆</span><b>{winnerName}</b></div>
                    <time>{formatShortDate(encounter.date)}</time>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function KpiCard({ icon, label, value, helper, ring, player }: { icon: string; label: string; value: string; helper: string; ring?: number; player?: TeamPlayer }) {
  return (
    <article className="kpi-card">
      <div className="kpi-label"><span>{icon}</span>{label}</div>
      <div className="kpi-main">
        {player && <PlayerAvatar player={player} size="md" />}
        <div><strong>{value}</strong><small>{helper}</small></div>
        {ring !== undefined && <div className="mini-ring" style={{ background: `conic-gradient(var(--gold) ${ring}%, #292d33 ${ring}% 100%)` }}><span>{Math.round(ring)}%</span></div>}
      </div>
    </article>
  );
}

function PlayerAvatar({ player, size = "md" }: { player: TeamPlayer; size?: "xs" | "sm" | "md" | "lg" }) {
  const visual = PLAYER_VISUALS[player];
  return <span className={`player-avatar avatar-${size}`} style={{ background: visual.gradient }}><span className="avatar-sigil">{visual.sigil}</span><b>{player.slice(0, 1)}</b></span>;
}

function ActivityChart({ encounters }: { encounters: Encounter[] }) {
  const series = useMemo(() => {
    const counts = new Map<string, number>();
    encounters.forEach((encounter) => counts.set(encounter.date, (counts.get(encounter.date) ?? 0) + encounter.games.length));
    const dates = Array.from(counts.keys()).sort().slice(-14);
    return { dates, values: dates.map((date) => counts.get(date) ?? 0) };
  }, [encounters]);

  if (series.values.length === 0) return <EmptyState text="La actividad aparecerá con las primeras partidas." />;

  const max = Math.max(...series.values, 1);
  const points = series.values.map((value, index) => {
    const x = series.values.length === 1 ? 50 : (index / (series.values.length - 1)) * 100;
    const y = 38 - (value / max) * 30;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="activity-chart">
      <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-label="Actividad de partidas">
        <defs><linearGradient id="areaGold" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#e7b85d" stopOpacity=".32" /><stop offset="100%" stopColor="#e7b85d" stopOpacity="0" /></linearGradient></defs>
        <polyline className="chart-grid-line" points="0,38 100,38" />
        <polygon points={`0,38 ${points} 100,38`} fill="url(#areaGold)" />
        <polyline className="activity-line" points={points} />
      </svg>
      <div className="chart-labels"><span>{formatShortDate(series.dates[0])}</span><span>{formatShortDate(series.dates[series.dates.length - 1])}</span></div>
    </div>
  );
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}`;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
