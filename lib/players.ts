export const TEAM_PLAYERS = [
  "Braulio",
  "Wladimick",
  "Ignacio",
  "Diego",
  "Claudio",
  "Diever",
  "Cristobal",
  "Renzo",
] as const;

export type TeamPlayer = (typeof TEAM_PLAYERS)[number];

export const ACTIVE_PLAYER_STORAGE_KEY = "team-cornetas:active-player:v1";

export function isTeamPlayer(value: string | null): value is TeamPlayer {
  return Boolean(value && TEAM_PLAYERS.includes(value as TeamPlayer));
}
