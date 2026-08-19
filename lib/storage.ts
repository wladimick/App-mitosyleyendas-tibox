import type { Encounter } from "./domain";

const STORAGE_KEY = "team-cornetas:encounters:v1";

export const demoEncounters: Encounter[] = [
  {
    id: "demo-1",
    date: new Date().toISOString().slice(0, 10),
    format: "lunch",
    playerA: "Corneta A",
    raceA: "Guerrero",
    playerB: "Corneta B",
    raceB: "Bestia",
    createdAt: new Date().toISOString(),
    games: [
      { id: "demo-1-g1", diceWinner: "a", winner: "a" },
      { id: "demo-1-g2", diceWinner: "b", winner: "a" },
    ],
  },
  {
    id: "demo-2",
    date: new Date().toISOString().slice(0, 10),
    format: "bo3",
    playerA: "Corneta B",
    raceA: "Bestia",
    playerB: "Corneta C",
    raceB: "Caballero",
    createdAt: new Date().toISOString(),
    games: [
      { id: "demo-2-g1", diceWinner: "b", winner: "b" },
      { id: "demo-2-g2", diceWinner: "a", winner: "a" },
      { id: "demo-2-g3", diceWinner: "a", winner: "b" },
    ],
  },
];

export function loadEncounters(): Encounter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Encounter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEncounters(encounters: Encounter[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(encounters));
}

export function clearEncounters() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
