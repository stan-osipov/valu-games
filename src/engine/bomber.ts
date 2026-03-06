import type { BomberCell, BomberGrid } from '../types';

export const GRID_COLS = 15;
export const GRID_ROWS = 13;

const SPAWN_POSITIONS: [number, number][] = [
  [1, 1], [13, 1], [1, 11], [13, 11],
  [7, 1], [7, 11], [1, 6], [13, 6],
  [5, 1], [9, 1],
];

export const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
  '#9b59b6', '#e67e22', '#1abc9c', '#e84393',
  '#a3cb38', '#6c5ce7',
];

/** Get spawn positions for N players */
export function getSpawnPositions(playerCount: number): { x: number; y: number }[] {
  return SPAWN_POSITIONS.slice(0, playerCount).map(([x, y]) => ({ x, y }));
}

/** Get cells that must be clear around a spawn point (L-shaped, 3 cells) */
function getSpawnClearZone(x: number, y: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [{ x, y }];
  // Clear adjacent cells in both axes
  if (x + 1 < GRID_COLS) cells.push({ x: x + 1, y });
  if (x - 1 >= 0) cells.push({ x: x - 1, y });
  if (y + 1 < GRID_ROWS) cells.push({ x, y: y + 1 });
  if (y - 1 >= 0) cells.push({ x, y: y - 1 });
  // Also clear the diagonal-adjacent cells for more room
  if (x + 1 < GRID_COLS && y + 1 < GRID_ROWS) cells.push({ x: x + 1, y: y + 1 });
  if (x + 1 < GRID_COLS && y - 1 >= 0) cells.push({ x: x + 1, y: y - 1 });
  if (x - 1 >= 0 && y + 1 < GRID_ROWS) cells.push({ x: x - 1, y: y + 1 });
  if (x - 1 >= 0 && y - 1 >= 0) cells.push({ x: x - 1, y: y - 1 });
  return cells;
}

/** Generate the game grid with hard walls, soft walls, and clear spawn zones */
export function generateGrid(playerCount: number): BomberGrid {
  const grid: BomberGrid = [];

  // Initialize with empty
  for (let row = 0; row < GRID_ROWS; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      grid[row][col] = 0;
    }
  }

  // Border walls
  for (let col = 0; col < GRID_COLS; col++) {
    grid[0][col] = 1;
    grid[GRID_ROWS - 1][col] = 1;
  }
  for (let row = 0; row < GRID_ROWS; row++) {
    grid[row][0] = 1;
    grid[row][GRID_COLS - 1] = 1;
  }

  // Hard walls in checkerboard at even row/col (inside border)
  for (let row = 2; row < GRID_ROWS - 1; row += 2) {
    for (let col = 2; col < GRID_COLS - 1; col += 2) {
      grid[row][col] = 1;
    }
  }

  // Collect spawn clear zones
  const spawns = getSpawnPositions(playerCount);
  const clearSet = new Set<string>();
  for (const sp of spawns) {
    for (const cell of getSpawnClearZone(sp.x, sp.y)) {
      clearSet.add(`${cell.x},${cell.y}`);
    }
  }

  // Fill soft walls in remaining empty cells (~50% chance), avoiding spawn zones
  for (let row = 1; row < GRID_ROWS - 1; row++) {
    for (let col = 1; col < GRID_COLS - 1; col++) {
      if (grid[row][col] !== 0) continue;
      if (clearSet.has(`${col},${row}`)) continue;
      if (Math.random() < 0.5) {
        grid[row][col] = 2;
      }
    }
  }

  return grid;
}

/** Check if a position is walkable */
export function canMoveTo(grid: BomberGrid, x: number, y: number): boolean {
  if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false;
  const cell = grid[y][x];
  return cell === 0 || cell === 3 || cell === 4 || cell === 5; // empty or powerup
}

/** Calculate explosion cells from a bomb position */
export function calculateExplosion(
  grid: BomberGrid,
  x: number,
  y: number,
  range: number,
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [{ x, y }];
  const directions = [
    [0, -1], // up
    [0, 1],  // down
    [-1, 0], // left
    [1, 0],  // right
  ];

  for (const [dx, dy] of directions) {
    for (let i = 1; i <= range; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) break;
      const cell = grid[ny][nx];
      if (cell === 1) break; // hard wall stops explosion
      cells.push({ x: nx, y: ny });
      if (cell === 2) break; // soft wall: include cell but stop
    }
  }

  return cells;
}

/** Determine which powerup (if any) a destroyed soft wall drops */
export function rollPowerup(): BomberCell {
  if (Math.random() > 0.3) return 0; // 70% nothing
  const roll = Math.random();
  if (roll < 0.33) return 3; // range up
  if (roll < 0.66) return 4; // extra bomb
  return 5; // speed up
}
