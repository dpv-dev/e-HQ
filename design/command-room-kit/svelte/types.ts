import type { Snippet } from "svelte";

export type CommandRoomTone = "success" | "warning" | "danger" | "info" | "accent" | "neutral";
export type CommandRoomKpiVariant = "compact" | "ledger" | "orbit" | "risk";
export type CommandRoomGraphVariant = "line" | "area" | "bars" | "gauge" | "funnel" | "donut";
export type CommandRoomSurface = "office" | "distribution" | "command";

export interface CommandRoomDataPoint {
  readonly label: string;
  readonly value: number;
  readonly tone: CommandRoomTone;
}

export interface CommandRoomNavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly active: boolean;
}

export interface CommandRoomSnippetSlot {
  readonly content: Snippet | null;
}
