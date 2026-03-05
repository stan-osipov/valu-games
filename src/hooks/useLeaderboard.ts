import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { getDiceBearUrl } from '../utils/dicebear';
import type { GameRow, GameType } from '../types';

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  avatarUrl: string;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  winRate: number;
}

interface LeaderboardData {
  overall: LeaderboardEntry[];
  chess: LeaderboardEntry[];
  checkers: LeaderboardEntry[];
  tictactoe: LeaderboardEntry[];
  loading: boolean;
}

export function useLeaderboard(): LeaderboardData {
  const { isValuVerse } = useAuth();
  const [data, setData] = useState<LeaderboardData>({
    overall: [],
    chess: [],
    checkers: [],
    tictactoe: [],
    loading: true,
  });

  useEffect(() => {
    async function fetch() {
      // Fetch all finished games
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!games) {
        setData((d) => ({ ...d, loading: false }));
        return;
      }

      // Collect all player IDs
      const playerIds = new Set<string>();
      for (const g of games as GameRow[]) {
        if (g.player_white) playerIds.add(g.player_white);
        if (g.player_black) playerIds.add(g.player_black);
      }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_seed')
        .in('id', [...playerIds]);

      const profileMap = new Map<string, { nickname: string; avatar_seed: string }>();
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { nickname: p.nickname, avatar_seed: p.avatar_seed });
      }

      // In ValuVerse mode, fetch real avatars from Valu API
      const valuAvatarMap = new Map<string, string>();
      if (isValuVerse) {
        try {
          const valuApi = (globalThis as any).valuApi;
          if (valuApi) {
            const usersApi = await valuApi.getApi('users');
            const results = await Promise.allSettled(
              [...profileMap.entries()].map(async ([id, p]) => {
                const icon = await usersApi.run('get-icon', { userId: p.avatar_seed, size: 80 });
                if (icon) valuAvatarMap.set(id, icon);
              })
            );
            void results;
          }
        } catch {
          // fallback to DiceBear
        }
      }

      function buildLeaderboard(gameType?: GameType): LeaderboardEntry[] {
        const statsMap = new Map<string, { wins: number; losses: number; draws: number }>();

        const filtered = gameType
          ? (games as GameRow[]).filter((g) => g.game_type === gameType)
          : (games as GameRow[]);

        for (const g of filtered) {
          const players = [g.player_white, g.player_black].filter(Boolean) as string[];

          for (const pid of players) {
            if (!statsMap.has(pid)) statsMap.set(pid, { wins: 0, losses: 0, draws: 0 });
            const s = statsMap.get(pid)!;

            if (g.winner === 'draw') {
              s.draws++;
            } else {
              const myColor = g.player_white === pid ? 'white' : 'black';
              if (g.winner === myColor) s.wins++;
              else s.losses++;
            }
          }
        }

        const entries: LeaderboardEntry[] = [];
        for (const [id, s] of statsMap) {
          const profile = profileMap.get(id);
          const totalGames = s.wins + s.losses + s.draws;
          entries.push({
            id,
            nickname: profile?.nickname ?? id.slice(0, 8) + '...',
            avatarUrl: valuAvatarMap.get(id) || getDiceBearUrl(profile?.avatar_seed ?? id),
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
            games: totalGames,
            winRate: totalGames > 0 ? Math.round((s.wins / totalGames) * 100) : 0,
          });
        }

        // Sort by wins desc, then win rate desc
        entries.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
        return entries;
      }

      setData({
        overall: buildLeaderboard(),
        chess: buildLeaderboard('chess'),
        checkers: buildLeaderboard('checkers'),
        tictactoe: buildLeaderboard('tictactoe'),
        loading: false,
      });
    }

    fetch();
  }, [isValuVerse]);

  return data;
}
