// Single place for every external endpoint / model name the app depends on.
// When a service changes (URL moves, model gets deprecated), edit it here only.

// --- Anime data sources ---
export const ANILIST_URL = 'https://graphql.anilist.co';
export const KITSU_ANIME_URL = 'https://kitsu.io/api/edge/anime';

// --- Luxion (AI chat) ---
// Cloudflare Worker proxy — holds the Groq key server-side so it never ships in the app bundle.
export const LUXION_PROXY_URL = 'https://fancy-sky-af41luxion-proxy.gabbycasera1219.workers.dev';
// Shared secret the Worker checks before spending Groq quota. Set in .env as EXPO_PUBLIC_PROXY_SECRET.
// (Expo only inlines EXPO_PUBLIC_ vars when accessed as a literal process.env.EXPO_PUBLIC_*.)
export const LUXION_PROXY_SECRET = process.env.EXPO_PUBLIC_PROXY_SECRET ?? '';
// Primary model. The fallback model lives in the Cloudflare Worker code, not here.
export const LUXION_MODEL = 'openai/gpt-oss-120b';

// --- Self-update ---
export const UPDATE_URL = 'https://raw.githubusercontent.com/acielace/Mirisu---AniList/refs/heads/main/version.json';
// Only URLs under our own GitHub Releases are trusted as an update download source.
export const TRUSTED_DOWNLOAD_PREFIX = 'https://github.com/acielace/Mirisu---AniList/releases/';