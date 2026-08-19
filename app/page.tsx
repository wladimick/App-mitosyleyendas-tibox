"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { clearEncounters, demoEncounters, loadEncounters, saveEncounters } from "../lib/storage";

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
  lunch: "Almuerzo libre",
  bo3: "BO3 / torneo",
};

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
  const [hydrated, setHydrated] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
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

  useEffect(() => {
    setEncounters(loadEncounters());
    setForm((current) => ({ ...current, date: todayInputValue() }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveEncounters(encounters);
  }, [encounters, hydrated]);

  const filteredEncounters = useMemo(
    () => filterEncountersByPeriod(encounters, period),
    [encounters, period],
  );
  const metrics = useMemo(() => calculateMetrics(filteredEncounters), [filteredEncounters]);

  const playerSuggestions = useMemo(
    () =>
      Array.from(
        new Set(encounters.flatMap((item) => [normalize(item.playerA), normalize(item.playerB)])),
      ).filter(Boolean),
    [encounters],
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
    setGames((current) => (current.length === 1 ? current : current.filter((game) => game.id !== id)));
  }

  function submitEncounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");

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

    if (cleaned.playerA.toLocaleLowerCase() === cleaned.playerB.toLocaleLowerCase()) {
      setFormMessage("Los dos lados deben corresponder a jugadores distintos.");
      return;
    }

    const encounter: Encounter = {
      id: makeId("encounter"),
      date: form.date,
      format: form.format,
      playerA: cleaned.playerA,
      raceA: cleaned.raceA,
      playerB: cleaned.playerB,
      raceB: cleaned.raceB,
      createdAt: new Date().toISOString(),
      games: games.map((game) => ({
        id: makeId("game"),
        diceWinner: game.diceWinner,
        winner: game.winner,
      })),
    };

    setEncounters((current) => [encounter, ...current]);
    setGames([{ id: makeId("draft"), diceWinner: "a", winner: "a" }]);
    setForm((current) => ({
      ...current,
      playerA: "",
      raceA: "",
      playerB: "",
      raceB: "",
    }));
    setFormMessage(`Guardado: ${encounter.games.length} juego${encounter.games.length === 1 ? "" : "s"}.`);
  }

  function deleteEncounter(id: string) {
    setEncounters((current) => current.filter((encounter) => encounter.id !== id));
  }

  function loadDemo() {
    setEncounters(demoEncounters);
    setPeriod("today");
  }

  function resetAll() {
    clearEncounters();
    setEncounters([]);
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
        <div className="status-pill" title="En esta primera versión los datos viven en este navegador">
          <span className="status-dot" /> MVP local
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow">Winrate del team</p>
          <h2>Que el dado no decida la historia.</h2>
          <p className="hero-copy">
            Registra cada encuentro del almuerzo o un BO3 completo. La app separa cada juego para
            medir rendimiento real por jugador, raza y ventaja de dado.
          </p>
        </div>
        <div className="hero-actions">
          <button className="button secondary" type="button" onClick={loadDemo}>
            Cargar demo
          </button>
          {encounters.length > 0 && (
            <button className="button ghost" type="button" onClick={resetAll}>
              Limpiar datos
            </button>
          )}
        </div>
      </section>

      <section className="period-switch" aria-label="Período de estadísticas">
        {(Object.keys(periodLabels) as Period[]).map((key) => (
          <button
            key={key}
            className={period === key ? "active" : ""}
            type="button"
            onClick={() => setPeriod(key)}
          >
            {periodLabels[key]}
          </button>
        ))}
      </section>

      <section className="metrics-grid">
        <MetricCard label="Juegos" value={metrics.games.toString()} helper={`${metrics.encounters} encuentros`} />
        <MetricCard
          label="Ventaja del dado"
          value={`${metrics.diceAdvantage}%`}
          helper={`${metrics.diceWinnerGameWins} juegos ganados por quien ganó el dado`}
        />
        <MetricCard
          label="Líder"
          value={metrics.players[0]?.name ?? "—"}
          helper={metrics.players[0] ? `${metrics.players[0].winrate}% winrate` : "Sin partidas todavía"}
        />
        <MetricCard
          label="Raza líder"
          value={metrics.races[0]?.race ?? "—"}
          helper={metrics.races[0] ? `${metrics.races[0].winrate}% winrate` : "Sin datos todavía"}
        />
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
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </label>
              <label>
                Formato
                <select
                  value={form.format}
                  onChange={(event) =>
                    setForm({ ...form, format: event.target.value as EncounterFormat })
                  }
                >
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
                  <input
                    list="players"
                    placeholder="Nombre"
                    value={form.playerA}
                    onChange={(event) => setForm({ ...form, playerA: event.target.value })}
                  />
                </label>
                <label>
                  Raza / mazo
                  <input
                    list="races"
                    placeholder="Ej. Guerrero"
                    value={form.raceA}
                    onChange={(event) => setForm({ ...form, raceA: event.target.value })}
                  />
                </label>
              </div>

              <div className="versus-badge">VS</div>

              <div className="player-card side-b">
                <span className="player-side">B</span>
                <label>
                  Jugador
                  <input
                    list="players"
                    placeholder="Nombre"
                    value={form.playerB}
                    onChange={(event) => setForm({ ...form, playerB: event.target.value })}
                  />
                </label>
                <label>
                  Raza / mazo
                  <input
                    list="races"
                    placeholder="Ej. Bestia"
                    value={form.raceB}
                    onChange={(event) => setForm({ ...form, raceB: event.target.value })}
                  />
                </label>
              </div>
            </div>

            <datalist id="players">
              {playerSuggestions.map((player) => (
                <option key={player} value={player} />
              ))}
            </datalist>
            <datalist id="races">
              {raceSuggestions.map((race) => (
                <option key={race} value={race} />
              ))}
            </datalist>

            <div className="games-block">
              <div className="games-heading">
                <div>
                  <span className="field-title">Resultados</span>
                  <small>Ganador del dado y ganador de cada juego.</small>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={addGame}
                  disabled={games.length >= 3}
                >
                  + Agregar juego
                </button>
              </div>

              {games.map((game, index) => (
                <div className="game-row" key={game.id}>
                  <strong>J{index + 1}</strong>
                  <label>
                    Ganó el dado
                    <select
                      value={game.diceWinner}
                      onChange={(event) => updateGame(game.id, "diceWinner", event.target.value as Side)}
                    >
                      <option value="a">{form.playerA || "Jugador A"}</option>
                      <option value="b">{form.playerB || "Jugador B"}</option>
                    </select>
                  </label>
                  <label>
                    Ganó el juego
                    <select
                      value={game.winner}
                      onChange={(event) => updateGame(game.id, "winner", event.target.value as Side)}
                    >
                      <option value="a">{form.playerA || "Jugador A"}</option>
                      <option value="b">{form.playerB || "Jugador B"}</option>
                    </select>
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => removeGame(game.id)}
                    disabled={games.length === 1}
                    aria-label={`Eliminar juego ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {formMessage && <p className="form-message">{formMessage}</p>}

            <button className="button primary full" type="submit">
              Guardar encuentro
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

          {metrics.players.length === 0 ? (
            <EmptyState text="Registra el primer juego o carga la demo para ver el ranking." />
          ) : (
            <div className="ranking-list">
              {metrics.players.map((player, index) => (
                <div className="ranking-row" key={player.name}>
                  <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                  <div className="ranking-name">
                    <strong>{player.name}</strong>
                    <small>
                      {player.wins}V · {player.losses}D · {player.games} juegos
                    </small>
                  </div>
                  <div className="winrate-block">
                    <strong>{player.winrate}%</strong>
                    <div className="progress-track">
                      <span style={{ width: `${player.winrate}%` }} />
                    </div>
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
                <thead>
                  <tr>
                    <th>Raza</th>
                    <th>Juegos</th>
                    <th>V</th>
                    <th>D</th>
                    <th>WR</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.races.map((race) => (
                    <tr key={race.race}>
                      <td><strong>{race.race}</strong></td>
                      <td>{race.games}</td>
                      <td>{race.wins}</td>
                      <td>{race.losses}</td>
                      <td><span className="wr-chip">{race.winrate}%</span></td>
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
                    <div className="encounter-meta">
                      <span>{encounter.date}</span>
                      <span>{formatLabels[encounter.format]}</span>
                    </div>
                    <div className="encounter-main">
                      <div className={score.a > score.b ? "winner" : ""}>
                        <strong>{encounter.playerA}</strong>
                        <small>{encounter.raceA}</small>
                      </div>
                      <div className="score-box">{score.a} : {score.b}</div>
                      <div className={score.b > score.a ? "winner right" : "right"}>
                        <strong>{encounter.playerB}</strong>
                        <small>{encounter.raceB}</small>
                      </div>
                    </div>
                    <div className="encounter-footer">
                      <span>{encounter.games.length} juego{encounter.games.length === 1 ? "" : "s"}</span>
                      <button className="danger-link" type="button" onClick={() => deleteEncounter(encounter.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <footer>
        <strong>Team Cornetas</strong>
        <span>·</span>
        <span>MVP de estadísticas MyL</span>
      </footer>
    </main>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
