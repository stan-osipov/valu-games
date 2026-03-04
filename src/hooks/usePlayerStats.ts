import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { GameRow, GameType } from '../types';

interface Stats {
  wins: number;
  losses: number;
  draws: number;
}

interface PlayerStats {
  total: Stats;
  chess: Stats;
  checkers: Stats;
  recentGames: GameRow[];
  loading: boolean;
}

function emptyStats(): Stats {
  return { wins: 0, losses: 0, draws: 0 };
}

function computeStats(games: GameRow[], userId: string, gameType?: GameType): Stats {
  const filtered = gameType ? games.filter((g) => g.game_type === gameType) : games;
  const stats = emptyStats();

  for (const g of filtered) {
    if (g.status !== 'finished') continue;
    if (g.winner === 'draw') {
      stats.draws++;
    } else {
      const myColor =
        g.player_white === userId ? 'white' : g.player_black === userId ? 'black' : null;
      if (!myColor) continue;
      if (g.winner === myColor) stats.wins++;
      else stats.losses++;
    }
  }

  return stats;
}

export function usePlayerStats(userId: string): PlayerStats {
  const [stats, setStats] = useState<PlayerStats>({
    total: emptyStats(),
    chess: emptyStats(),
    checkers: emptyStats(),
    recentGames: [],
    loading: true,
  });

  useEffect(() => {
    if (!userId) return;

    async function fetch() {
      const { data } = await supabase
        .from('games')
        .select('*')
        .or(`player_white.eq.${userId},player_black.eq.${userId}`)
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(100);

      const games = (data ?? []) as GameRow[];
      const recent = games.slice(0, 20);

      setStats({
        total: computeStats(games, userId),
        chess: computeStats(games, userId, 'chess'),
        checkers: computeStats(games, userId, 'checkers'),
        recentGames: recent,
        loading: false,
      });
    }

    fetch();
  }, [userId]);

  return stats;
}
