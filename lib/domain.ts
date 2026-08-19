export type Side = "a" | "b";
export type EncounterFormat = "lunch" | "bo3";
export type Period = "today" | "month" | "all";

export interface GameResult {
  id: string;
  diceWinner: Side;
  winner: Side;
}

export interface Encounter {
  id: string;
  date: string;
  format: EncounterFormat;
  playerA: string;
  raceA: string;
  playerB: string;
  raceB: string;
  games: GameResult[];
  createdAt: string;
}

export interface PlayerStat {
  name: string;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
}

export interface RaceStat {
  race: string;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
}

export interface Metrics {
  encounters: number;
  games: number;
  diceWinnerGameWins: number;
  diceAdvantage: number;
  players: PlayerStat[];
  races: RaceStat[];
}

export function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function filterEncountersByPeriod(
  encounters: Encounter[],
  period: Period,
  now = new Date(),
) {
  if (period === "all") return encounters;

  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  if (period === "today") {
    return encounters.filter((encounter) => encounter.date === localDate);
  }

  return encounters.filter((encounter) => encounter.date.startsWith(localDate.slice(0, 7)));
}

export function calculateMetrics(encounters: Encounter[]): Metrics {
  const players = new Map<string, Omit<PlayerStat, "winrate">>();
  const races = new Map<string, Omit<RaceStat, "winrate">>();
  let gameCount = 0;
  let diceWinnerGameWins = 0;

  const ensurePlayer = (name: string) => {
    const key = normalize(name);
    if (!players.has(key)) {
      players.set(key, { name: key, games: 0, wins: 0, losses: 0 });
    }
    return players.get(key)!;
  };

  const ensureRace = (race: string) => {
    const key = normalize(race) || "Sin raza";
    if (!races.has(key)) {
      races.set(key, { race: key, games: 0, wins: 0, losses: 0 });
    }
    return races.get(key)!;
  };

  for (const encounter of encounters) {
    for (const game of encounter.games) {
      gameCount += 1;
      if (game.diceWinner === game.winner) diceWinnerGameWins += 1;

      const playerA = ensurePlayer(encounter.playerA);
      const playerB = ensurePlayer(encounter.playerB);
      const raceA = ensureRace(encounter.raceA);
      const raceB = ensureRace(encounter.raceB);

      playerA.games += 1;
      playerB.games += 1;
      raceA.games += 1;
      raceB.games += 1;

      if (game.winner === "a") {
        playerA.wins += 1;
        playerB.losses += 1;
        raceA.wins += 1;
        raceB.losses += 1;
      } else {
        playerB.wins += 1;
        playerA.losses += 1;
        raceB.wins += 1;
        raceA.losses += 1;
      }
    }
  }

  const playerStats = Array.from(players.values())
    .map((player) => ({
      ...player,
      winrate: player.games ? Math.round((player.wins / player.games) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.winrate - a.winrate || b.wins - a.wins || a.name.localeCompare(b.name));

  const raceStats = Array.from(races.values())
    .map((race) => ({
      ...race,
      winrate: race.games ? Math.round((race.wins / race.games) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.winrate - a.winrate || b.wins - a.wins || a.race.localeCompare(b.race));

  return {
    encounters: encounters.length,
    games: gameCount,
    diceWinnerGameWins,
    diceAdvantage: gameCount ? Math.round((diceWinnerGameWins / gameCount) * 1000) / 10 : 0,
    players: playerStats,
    races: raceStats,
  };
}

export function scoreEncounter(encounter: Encounter) {
  const score = encounter.games.reduce(
    (acc, game) => {
      acc[game.winner] += 1;
      return acc;
    },
    { a: 0, b: 0 },
  );

  return score;
}
