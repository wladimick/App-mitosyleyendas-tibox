import type { Encounter, EncounterFormat, Side } from "./domain";
import { supabase } from "./supabase";
import type { TeamPlayer } from "./players";

type EncounterRow = {
  id: string;
  played_on: string;
  format: EncounterFormat;
  player_a: string;
  race_a: string;
  player_b: string;
  race_b: string;
  created_at: string;
  games: GameRow[] | null;
};

type GameRow = {
  id: string;
  game_number: number;
  dice_winner: Side;
  winner: Side;
};

export async function fetchEncounters(): Promise<Encounter[]> {
  const { data, error } = await supabase
    .from("encounters")
    .select(
      "id, played_on, format, player_a, race_a, player_b, race_b, created_at, games(id, game_number, dice_winner, winner)",
    )
    .order("played_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as EncounterRow[]).map((row) => ({
    id: row.id,
    date: row.played_on,
    format: row.format,
    playerA: row.player_a,
    raceA: row.race_a,
    playerB: row.player_b,
    raceB: row.race_b,
    createdAt: row.created_at,
    games: [...(row.games ?? [])]
      .sort((a, b) => a.game_number - b.game_number)
      .map((game) => ({
        id: game.id,
        diceWinner: game.dice_winner,
        winner: game.winner,
      })),
  }));
}

export async function createEncounter(
  encounter: Omit<Encounter, "id" | "createdAt">,
  submittedBy: TeamPlayer,
): Promise<void> {
  const { data, error } = await supabase
    .from("encounters")
    .insert({
      played_on: encounter.date,
      format: encounter.format,
      player_a: encounter.playerA,
      race_a: encounter.raceA,
      player_b: encounter.playerB,
      race_b: encounter.raceB,
      submitted_by: submittedBy,
    })
    .select("id")
    .single();

  if (error) throw error;

  const { error: gameError } = await supabase.from("games").insert(
    encounter.games.map((game, index) => ({
      encounter_id: data.id,
      game_number: index + 1,
      dice_winner: game.diceWinner,
      winner: game.winner,
    })),
  );

  if (gameError) {
    throw gameError;
  }
}
