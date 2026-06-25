export interface AnimeEntry {
  id: string;
  title: string;
  rating: number; 
  status: string; 
  categories: string[]; 
  comments: string;
  imageUri?: string | null;
  season: number;
  episode: number;
  description?: string;
  genres?: string[]; // NEW: Added to store the genres fetched from AniList
}