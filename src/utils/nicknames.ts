const ADJECTIVES = [
  'Swift', 'Brave', 'Clever', 'Bold', 'Mighty',
  'Sly', 'Keen', 'Wild', 'Calm', 'Fierce',
  'Quick', 'Bright', 'Noble', 'Wise', 'Lucky',
  'Sharp', 'Cool', 'Grand', 'Slick', 'Daring',
  'Sneaky', 'Turbo', 'Cosmic', 'Epic', 'Hyper',
  'Mega', 'Ultra', 'Super', 'Stealth', 'Phantom',
  'Shadow', 'Iron', 'Storm', 'Frost', 'Blaze',
  'Thunder', 'Crystal', 'Neon', 'Pixel', 'Cyber',
];

const NOUNS = [
  'Pawn', 'Knight', 'Rook', 'Bishop', 'King',
  'Fox', 'Wolf', 'Hawk', 'Bear', 'Tiger',
  'Dragon', 'Phoenix', 'Falcon', 'Viper', 'Panther',
  'Wizard', 'Ninja', 'Pirate', 'Ghost', 'Ranger',
  'Titan', 'Spark', 'Comet', 'Bolt', 'Ace',
  'Sage', 'Raven', 'Lion', 'Cobra', 'Lynx',
  'Otter', 'Badger', 'Shark', 'Eagle', 'Jaguar',
  'Mantis', 'Hydra', 'Golem', 'Sphinx', 'Griffin',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateNickname(): string {
  return `${pick(ADJECTIVES)}${pick(NOUNS)}`;
}

export function generateAvatarSeed(): string {
  return crypto.randomUUID().slice(0, 8);
}
