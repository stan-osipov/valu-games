import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '../supabaseClient';
import { generateNickname, generateAvatarSeed } from '../utils/nicknames';
import { getDiceBearUrl } from '../utils/dicebear';

interface AuthState {
  userId: string;
  nickname: string;
  avatarUrl: string;
  avatarSeed: string;
  isValuVerse: boolean;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  updateNickname: (name: string) => Promise<void>;
  regenerateAvatar: () => Promise<void>;
  logout: () => void;
  loginWithId: (id: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function upsertProfile(id: string, nickname: string, avatarSeed: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id, nickname, avatar_seed: avatarSeed }, { onConflict: 'id' });
  if (error) console.error('Profile upsert failed:', error.message);
}

async function loadProfile(id: string): Promise<{ nickname: string; avatar_seed: string } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('nickname, avatar_seed')
    .eq('id', id)
    .single();
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: '',
    nickname: '',
    avatarUrl: '',
    avatarSeed: '',
    isValuVerse: false,
    loading: true,
  });

  const initNormal = useCallback(async () => {
    let id = localStorage.getItem('player_id');
    let nickname = localStorage.getItem('nickname');
    let avatarSeed = localStorage.getItem('avatar_seed');

    const isNew = !id;
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('player_id', id);
    }

    // Show cached values immediately
    if (nickname && avatarSeed) {
      setState({
        userId: id,
        nickname,
        avatarUrl: getDiceBearUrl(avatarSeed),
        avatarSeed,
        isValuVerse: false,
        loading: false,
      });
    }

    // Load from DB or create
    const profile = await loadProfile(id);
    if (profile) {
      nickname = profile.nickname;
      avatarSeed = profile.avatar_seed;
    } else if (isNew || !nickname || !avatarSeed) {
      nickname = nickname || generateNickname();
      avatarSeed = avatarSeed || generateAvatarSeed();
      await upsertProfile(id, nickname, avatarSeed);
    }

    localStorage.setItem('nickname', nickname!);
    localStorage.setItem('avatar_seed', avatarSeed!);

    setState({
      userId: id,
      nickname: nickname!,
      avatarUrl: getDiceBearUrl(avatarSeed!),
      avatarSeed: avatarSeed!,
      isValuVerse: false,
      loading: false,
    });
  }, []);

  const initValuVerse = useCallback(async (): Promise<boolean> => {
    try {
      const { ValuApi } = await import('@arkeytyp/valu-api') as any;

      const ready = await Promise.race([
        new Promise<boolean>((resolve) => {
          ValuApi.API_READY.then(() => resolve(true));
        }),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
      ]);

      if (!ready) return false;

      const valuApi = new ValuApi();
      const usersApi = (valuApi as any).getApi('users');
      const user = await usersApi.run('current');

      if (!user || !user.id) return false;

      const id = user.id as string;
      const avatarUrl = (user.avatar as string) || getDiceBearUrl(id);

      // Load or create profile for nickname
      let nickname: string;
      const profile = await loadProfile(id);
      if (profile) {
        nickname = profile.nickname;
      } else {
        nickname = (user.name as string) || generateNickname();
        await upsertProfile(id, nickname, id);
      }

      setState({
        userId: id,
        nickname,
        avatarUrl,
        avatarSeed: id,
        isValuVerse: true,
        loading: false,
      });

      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    async function init() {
      const inIframe = window.self !== window.top;
      if (inIframe) {
        const ok = await initValuVerse();
        if (ok) return;
      }
      await initNormal();
    }
    init();
  }, [initNormal, initValuVerse]);

  const updateNickname = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) => ({ ...s, nickname: trimmed }));
    localStorage.setItem('nickname', trimmed);
    await supabase
      .from('profiles')
      .update({ nickname: trimmed })
      .eq('id', state.userId);
  }, [state.userId]);

  const regenerateAvatar = useCallback(async () => {
    const seed = generateAvatarSeed();
    const url = getDiceBearUrl(seed);
    setState((s) => ({ ...s, avatarSeed: seed, avatarUrl: url }));
    localStorage.setItem('avatar_seed', seed);
    await supabase
      .from('profiles')
      .update({ avatar_seed: seed })
      .eq('id', state.userId);
  }, [state.userId]);

  const logout = useCallback(() => {
    localStorage.removeItem('player_id');
    localStorage.removeItem('nickname');
    localStorage.removeItem('avatar_seed');

    const id = crypto.randomUUID();
    const nickname = generateNickname();
    const avatarSeed = generateAvatarSeed();

    localStorage.setItem('player_id', id);
    localStorage.setItem('nickname', nickname);
    localStorage.setItem('avatar_seed', avatarSeed);

    upsertProfile(id, nickname, avatarSeed);

    setState({
      userId: id,
      nickname,
      avatarUrl: getDiceBearUrl(avatarSeed),
      avatarSeed,
      isValuVerse: false,
      loading: false,
    });
  }, []);

  const loginWithId = useCallback(async (id: string): Promise<boolean> => {
    const trimmed = id.trim();
    if (!trimmed) return false;

    const profile = await loadProfile(trimmed);
    if (!profile) return false;

    localStorage.setItem('player_id', trimmed);
    localStorage.setItem('nickname', profile.nickname);
    localStorage.setItem('avatar_seed', profile.avatar_seed);

    setState({
      userId: trimmed,
      nickname: profile.nickname,
      avatarUrl: getDiceBearUrl(profile.avatar_seed),
      avatarSeed: profile.avatar_seed,
      isValuVerse: false,
      loading: false,
    });

    return true;
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, updateNickname, regenerateAvatar, logout, loginWithId }}
    >
      {children}
    </AuthContext.Provider>
  );
}
