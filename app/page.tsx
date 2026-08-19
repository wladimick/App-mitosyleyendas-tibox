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

type DraftGame = {
  id: string;
  diceWinner: Side;
  winner: Side;
};

type FormState = {
  date: string;
  format: EncounterFormat;
  playerA: string;
  raceA: string;
  playerB: string;
  raceB: string;
};

const periodLabels: Record<Period, string> = {
  today: "Hoy",
  month: "Este mes",
  all: "Histórico",
};

const formatLabels: Record<EncounterFormat, string> = {
  lunch: "Almuerzo",
  bo3: "BO3 / torneo",
};

const diceFaces = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function todayInputValue() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function makeId(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newDraftGame(index: number): DraftGame {
  return { id: `draft-${index}-${Date.now()}`, diceWinner: "a", winner: "a" };
}

export default function HomePage() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [activePlayer, setActivePlayer] = useState<TeamPlayer | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [diceRolls, setDiceRolls] = useState(0);
  const [form, setForm] = useState<FormState>({
    date: "",
    format: "lunch",
    playerA: "",
    raceA: "",
    playerB: "",
    raceB: "",
  });
  const [games, setGames] = useState<DraftGame[]>([
    { id: "draft-initial", diceWinner: "a", winner: "a" },
  ]);
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
      setCloudError("No pudimos sincronizar con Supabase. Revisa la configuración o vuelve a intentar.");
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
    () =>
      Array.from(
        new Set(encounters.flatMap((item) => [normalize(item.raceA), normalize(item.raceB)])),
      ).filter(Boolean),
    [encounters],
  );
  const sortedEncounters = useMemo(
    () =>
      [...filteredEncounters].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      ),
    [filteredEncounters],
  );

  function choosePlayer(player: TeamPlayer) {
    window.localStorage.setItem(ACTIVE_PLAYER_STORAGE_KEY, player);
    setActivePlayer(player);
    setForm((current) => ({
      ...current,
      playerA: player,
      playerB: current.playerB === player ? "" : current.playerB,
    }));
  }

  function changePlayer() {
    window.localStorage.removeItem(ACTIVE_PLAYER_STORAGE_KEY);
    setActivePlayer(null);
    setDiceValue(null);
  }

  function rollDice() {
    const next = Math.floor(Math.random() * 6) + 1;
    setDiceValue(next);
    setDiceRolls((current) => current + 1);
  }

  function updateGame(id: string, field: "diceWinner" | "winner", value: Side) {
    setGames((current) =>
      current.map((game) => (game.id === id ? { ...game, [field]: value } : game)),
    );
  }

  function addGame() {
    if (games.length >= 3) return;
    setGames((current) => [...current, newDraftGame(current.length + 1)]);
  }

  function removeGame(id: string) {
    setGames((current) =>
      current.length === 1 ? current : current.filter((game) => game.id !== id),
    );
  }

  async function submitEncounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");

    if (!activePlayer) {
      setFormMessage("Selecciona tu perfil antes de registrar una partida.");
      return;
    }

    const cleaned = {
      playerA: normalize(form.playerA),
      raceA: normalize(form.raceA),
      playerB: normalize(form.playerB),
      raceB: normalize(form.raceB),
    };

    if (!form.date || !cleaned.playerA || !cleaned.playerB || !cleaned.raceA || !cleaned.raceB) {
      setFormMessage("Completa fecha, jugadores y razas antes de guardar.");
      return;
    }

    if (cleaned.playerA === cleaned.playerB) {
      setFormMessage("Los dos lados deben corresponder a jugadores distintos.");
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
          games: games.map((game) => ({
            id: makeId("game"),
            diceWinner: game.diceWinner,
            winner: game.winner,
          })),
        },
        activePlayer,
      );

      await refreshCloud(true);
      setGames([{ id: makeId("draft"), diceWinner: "a", winner: "a" }]);
      setForm((current) => ({
        ...current,
        playerA: activePlayer,
        raceA: "",
        playerB: "",
        raceB: "",
      }));
      setFormMessage(`Guardado en la nube: ${games.length} juego${games.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error(error);
      setFormMessage(
        "No se pudo guardar. Si recién configuraste Supabase, ejecuta 002_public_player_mode.sql.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!profileReady) return null;

  if (!activePlayer) {
    return (
      <main className="welcome-shell">
        <div className="welcome-glow glow-one" />
        <div className="welcome-glow glow-two" />
        <section className="welcome-card">
          <div className="brand-mark large">TC</div>
          <p className="eyebrow">Mitos y Leyendas · Team Cornetas</p>
          <h1>¿Quién está jugando?</h1>
          <p className="welcome-copy">
            No necesitas contraseña. Elige tu perfil y la app lo recordará en este dispositivo.
          </p>
          <div className="profile-grid">
            {TEAM_PLAYERS.map((player) => (
              <button className="profile-button" key={player} onClick={() => choosePlayer(player)}>
                <span>{player.slice(0, 1)}</span>
                <strong>{player}</strong>
              </button>
            ))}
          </div>
          <small className="welcome-note">
            Los perfiles identifican quién registra la partida; no son cuentas con autenticación.
          </small>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">TC</div>
          <div>
            <p className="eyebrow">Mitos y Leyendas</p>
            <h1>Team Cornetas</h1>
          </div>
        </div>

        <div className="top-actions">
          <button className="dice-trigger" type="button" onClick={rollDice}>
            <span>🎲</span> Dado
          </button>
          <div className="cloud-status" title={lastSync ? `Última sincronización ${lastSync.toLocaleTimeString("es-CL")}` : "Conectando"}>
            <span className={cloudError ? "status-dot error" : "status-dot"} />
            {cloudError ? "Sin conexión" : "Nube"}
          </div>
          <button className="player-menu" type="button" onClick={changePlayer} title="Cambiar jugador">
            <span className="avatar">{activePlayer.slice(0, 1)}</span>
            <span>
              <small>Jugando como</small>
              <strong>{activePlayer}</strong>
            </span>
          </button>
        </div>
      </header>

      {diceValue && (
        <section className="dice-banner" key={diceRolls}>
          <div className="dice-face">{diceFaces[diceValue]}</div>
          <div>
            <span>Resultado del dado</span>
            <strong>{diceValue}</strong>
          </div>
          <button type="button" onClick={rollDice}>Tirar otra vez</button>
          <button className="dice-close" type="button" onClick={() => setDiceValue(null)} aria-label="Cerrar dado">×</button>
        </section>
      )}

      <section className="hero-panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Winrate del team</p>
          <h2>El almuerzo ahora tiene estadísticas.</h2>
          <p className="hero-copy">
            Registra cada juego, compara jugadores y razas, y descubre cuánto influye realmente ganar el dado.
          </p>
        </div>
        <div className="hero-player-stat">
          <span>Tu rendimiento · {periodLabels[period]}</span>
          <strong>{activeStats ? `${activeStats.winrate}%` : "—"}</strong>
          <small>{activeStats ? `${activeStats.wins}V · ${activeStats.losses}D · ${activeStats.games} juegos` : "Aún sin partidas en este período"}</small>
        </div>
      </section>

      {cloudError && (
        <div className="alert error-alert">
          <span>{cloudError}</span>
          <button type="button" onClick={() => void refreshCloud()}>Reintentar</button>
        </div>
      )}

      <section className="period-bar">
        <div className="period-switch" aria-label="Período de estadísticas">
          {(Object.keys(periodLabels) as Period[]).map((key) => (
            <button key={key} className={period === key ? "active" : ""} type="button" onClick={() => setPeriod(key)}>
              {periodLabels[key]}
            </button>
          ))}
        </div>
        <button className="refresh-button" type="button" onClick={() => void refreshCloud()} disabled={loading}>
          {loading ? "Sincronizando…" : "↻ Actualizar"}
        </button>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Juegos" value={metrics.games.toString()} helper={`${metrics.encounters} encuentros`} />
        <MetricCard label="Ventaja del dado" value={`${metrics.diceAdvantage}%`} helper={`${metrics.diceWinnerGameWins} ganados por quien ganó el dado`} />
        <MetricCard label="Líder" value={metrics.players[0]?.name ?? "—"} helper={metrics.players[0] ? `${metrics.players[0].winrate}% winrate` : "Sin partidas todavía"} />
        <MetricCard label="Raza líder" value={metrics.races[0]?.race ?? "—"} helper={metrics.races[0] ? `${metrics.races[0].winrate}% winrate` : "Sin datos todavía"} />
      </section>

      <section className="content-grid">
        <article className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Registro rápido</p>
              <h3>Nuevo encuentro</h3>
            </div>
            <span className="panel-badge">1–3 juegos</span>
          </div>

          <form onSubmit={submitEncounter}>
            <div className="field-grid two">
              <label>
                Fecha
                <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </label>
              <label>
                Formato
                <select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as EncounterFormat })}>
                  <option value="lunch">Almuerzo libre</option>
                  <option value="bo3">BO3 / torneo</option>
                </select>
              </label>
            </div>

            <div className="versus-grid">
              <div className="player-card side-a">
                <span className="player-side">A</span>
                <label>
                  Jugador
                  <select value={form.playerA} onChange={(event) => setForm({ ...form, playerA: event.target.value, playerB: form.playerB === event.target.value ? "" : form.playerB })}>
                    {TEAM_PLAYERS.map((player) => <option key={player} value={player}>{player}</option>)}
                  </select>
                </label>
                <label>
                  Raza / mazo
                  <input list="races" placeholder="Ej. Guerrero" value={form.raceA} onChange={(event) => setForm({ ...form, raceA: event.target.value })} />
                </label>
              </div>

              <div className="versus-badge">VS</div>

              <div className="player-card side-b">
                <span className="player-side">B</span>
                <label>
                  Jugador
                  <select value={form.playerB} onChange={(event) => setForm({ ...form, playerB: event.target.value })}>
                    <option value="">Seleccionar rival</option>
                    {TEAM_PLAYERS.filter((player) => player !== form.playerA).map((player) => <option key={player} value={player}>{player}</option>)}
                  </select>
                </label>
                <label>
                  Raza / mazo
                  <input list="races" placeholder="Ej. Bestia" value={form.raceB} onChange={(event) => setForm({ ...form, raceB: event.target.value })} />
                </label>
              </div>
            </div>

            <datalist id="races">
              {raceSuggestions.map((race) => <option key={race} value={race} />)}
            </datalist>

            <div className="games-block">
              <div className="games-heading">
                <div>
                  <span className="field-title">Resultados</span>
                  <small>Registra quién ganó el dado y quién ganó cada juego.</small>
                </div>
                <button className="text-button" type="button" onClick={addGame} disabled={games.length >= 3}>+ Agregar juego</button>
              </div>

              {games.map((game, index) => (
                <div className="game-row" key={game.id}>
                  <strong>J{index + 1}</strong>
                  <label>
                    Ganó el dado
                    <select value={game.diceWinner} onChange={(event) => updateGame(game.id, "diceWinner", event.target.value as Side)}>
                      <option value="a">{form.playerA || "Jugador A"}</option>
                      <option value="b">{form.playerB || "Jugador B"}</option>
                    </select>
                  </label>
                  <label>
                    Ganó el juego
                    <select value={game.winner} onChange={(event) => updateGame(game.id, "winner", event.target.value as Side)}>
                      <option value="a">{form.playerA || "Jugador A"}</option>
                      <option value="b">{form.playerB || "Jugador B"}</option>
                    </select>
                  </label>
                  <button className="icon-button" type="button" onClick={() => removeGame(game.id)} disabled={games.length === 1} aria-label={`Eliminar juego ${index + 1}`}>×</button>
                </div>
              ))}
            </div>

            {formMessage && <p className={formMessage.startsWith("Guardado") ? "form-message success" : "form-message"}>{formMessage}</p>}

            <button className="button primary full" type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar encuentro"}
            </button>
          </form>
        </article>

        <article className="panel ranking-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Competencia interna</p>
              <h3>Ranking</h3>
            </div>
            <span className="panel-badge">{periodLabels[period]}</span>
          </div>

          {loading && encounters.length === 0 ? (
            <EmptyState text="Sincronizando partidas…" />
          ) : metrics.players.length === 0 ? (
            <EmptyState text="Todavía no hay partidas registradas en este período." />
          ) : (
            <div className="ranking-list">
              {metrics.players.map((player, index) => (
                <div className={`ranking-row ${player.name === activePlayer ? "is-me" : ""}`} key={player.name}>
                  <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                  <div className="ranking-name">
                    <strong>{player.name}{player.name === activePlayer ? " · tú" : ""}</strong>
                    <small>{player.wins}V · {player.losses}D · {player.games} juegos</small>
                  </div>
                  <div className="winrate-block">
                    <strong>{player.winrate}%</strong>
                    <div className="progress-track"><span style={{ width: `${player.winrate}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="content-grid lower-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Metajuego interno</p>
              <h3>Rendimiento por raza</h3>
            </div>
          </div>
          {metrics.races.length === 0 ? (
            <EmptyState text="Las razas aparecerán automáticamente al registrar partidas." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Raza</th><th>Juegos</th><th>V</th><th>D</th><th>WR</th></tr></thead>
                <tbody>
                  {metrics.races.map((race) => (
                    <tr key={race.race}>
                      <td><strong>{race.race}</strong></td><td>{race.games}</td><td>{race.wins}</td><td>{race.losses}</td><td><span className="wr-chip">{race.winrate}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Bitácora</p>
              <h3>Últimos encuentros</h3>
            </div>
          </div>
          {sortedEncounters.length === 0 ? (
            <EmptyState text="Todavía no hay encuentros en este período." />
          ) : (
            <div className="encounter-list">
              {sortedEncounters.slice(0, 10).map((encounter) => {
                const score = scoreEncounter(encounter);
                return (
                  <div className="encounter-row" key={encounter.id}>
                    <div className="encounter-meta"><span>{encounter.date}</span><span>{formatLabels[encounter.format]}</span></div>
                    <div className="encounter-main">
                      <div className={score.a > score.b ? "winner" : ""}><strong>{encounter.playerA}</strong><small>{encounter.raceA}</small></div>
                      <div className="score-box">{score.a} : {score.b}</div>
                      <div className={score.b > score.a ? "winner right" : "right"}><strong>{encounter.playerB}</strong><small>{encounter.raceB}</small></div>
                    </div>
                    <div className="encounter-footer"><span>{encounter.games.length} juego{encounter.games.length === 1 ? "" : "s"}</span><span>Compartido en la nube</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <footer><strong>Team Cornetas</strong><span>·</span><span>Winrate MyL</span></footer>
    </main>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
