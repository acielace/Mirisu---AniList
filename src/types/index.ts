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
  folder?: string; // Add this line!
  statusUpdatedAt?: string; // Timestamp of the last status change (e.g. Will Watch -> Watched). Falls back to id (creation time) when unset.
}