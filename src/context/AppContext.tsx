import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useColorScheme, AppState } from 'react-native'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnimeEntry } from '../types';

type ThemePref = 'Dark' | 'Light' | 'System';
type Theme = 'Dark' | 'Light';
type DisplayMode = 'List' | 'Compact Grid' | 'Text Only';

interface AppContextType {
  themePref: ThemePref; setThemePref: (t: ThemePref) => void;
  theme: Theme; 
  displayMode: DisplayMode; setDisplayMode: (m: DisplayMode) => void;
  sortBy: string; setSortBy: (s: string) => void;
  isAscending: boolean; setIsAscending: (b: boolean) => void;
  isSearchActive: boolean; setIsSearchActive: (b: boolean) => void;
  searchQuery: string; setSearchQuery: (q: string) => void;
  
  selectedGenres: string[]; setSelectedGenres: (genres: string[]) => void;

  customCategories: string[]; setCustomCategories: (cats: string[]) => void;
  hiddenCategories: string[]; setHiddenCategories: (cats: string[]) => void;
  animeList: AnimeEntry[]; setAnimeList: (list: AnimeEntry[]) => void;
  storageUri: string; setStorageUri: (uri: string) => void; 
  backupFrequency: string; setBackupFrequency: (freq: string) => void; 
  accentColor: string; setAccentColor: (color: string) => void;
  nsfwFilter: boolean; setNsfwFilter: (enabled: boolean) => void;
  isDataLoaded: boolean; 

  // NEW FOLDER & EDIT STATES
  isListEditMode: boolean; setIsListEditMode: (b: boolean) => void;
  folders: string[]; setFolders: (folders: string[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Persistence -----------------------------------------------------------
// Each persisted value saves itself SAVE_DELAY_MS after its LAST change, so a burst of taps
// (e.g. holding an episode counter) becomes one write instead of one write per tap, and only
// the key that actually changed is written.
const SAVE_DELAY_MS = 500;

// Formats must match what's already stored on existing installs: some keys are raw strings,
// others are JSON. Changing either would make previously saved data unreadable.
const asJson = (v: unknown) => JSON.stringify(v);
const asRaw = (v: string) => v;

function usePersist<T>(key: string, value: T, enabled: boolean, serialize: (v: T) => string) {
  const latest = useRef(value);
  const dirty = useRef(false);
  const skipFirstRun = useRef(true);

  const write = useCallback(async () => {
    if (!dirty.current) return; // already flushed (e.g. on background) — nothing pending
    dirty.current = false;
    try {
      await AsyncStorage.setItem(key, serialize(latest.current));
    } catch (error) {
      console.error(`Failed to save ${key}`, error);
    }
  }, [key, serialize]);

  useEffect(() => {
    latest.current = value;
    if (!enabled) return; // don't overwrite stored data with defaults before the load finishes
    if (skipFirstRun.current) {
      // The first enabled run is just the freshly loaded values; nothing new to save.
      skipFirstRun.current = false;
      return;
    }
    dirty.current = true;
    const timer = setTimeout(write, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value, enabled, write]);

  // A pending write must not be lost if the user leaves the app inside the debounce window.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && dirty.current) write();
    });
    return () => {
      subscription.remove();
      if (dirty.current) write();
    };
  }, [write]);
}

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const systemTheme = useColorScheme(); 
  const [themePref, setThemePref] = useState<ThemePref>('Dark');
  
  const theme: Theme = themePref === 'System' ? (systemTheme === 'dark' ? 'Dark' : 'Light') : themePref;

  const [displayMode, setDisplayMode] = useState<DisplayMode>('List');
  const [sortBy, setSortBy] = useState('Date Added'); 
  const [isAscending, setIsAscending] = useState(false); 
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [animeList, setAnimeList] = useState<AnimeEntry[]>([]);
  
  const [storageUri, setStorageUri] = useState(''); 
  const [backupFrequency, setBackupFrequency] = useState('Off'); 
  const [accentColor, setAccentColor] = useState('#4FA4FF'); 
  const [nsfwFilter, setNsfwFilter] = useState(false);

  // NEW
  const [isListEditMode, setIsListEditMode] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);

  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedAnime = await AsyncStorage.getItem('@anilist_data');
        const storedCategories = await AsyncStorage.getItem('@anilist_categories');
        const storedHidden = await AsyncStorage.getItem('@anilist_hidden');
        const storedThemePref = await AsyncStorage.getItem('@anilist_themePref');
        const storedUri = await AsyncStorage.getItem('@anilist_storageUri'); 
        const storedFreq = await AsyncStorage.getItem('@anilist_backupFreq'); 
        const storedAccent = await AsyncStorage.getItem('@anilist_accentColor');
        const storedNsfw = await AsyncStorage.getItem('@anilist_nsfw');
        const storedFolders = await AsyncStorage.getItem('@anilist_folders'); // NEW

        if (storedAnime) setAnimeList(JSON.parse(storedAnime));
        if (storedCategories) setCustomCategories(JSON.parse(storedCategories));
        if (storedHidden) setHiddenCategories(JSON.parse(storedHidden));
        if (storedThemePref) setThemePref(storedThemePref as ThemePref);
        if (storedUri) setStorageUri(storedUri); 
        if (storedFreq) setBackupFrequency(storedFreq); 
        if (storedAccent) setAccentColor(storedAccent);
        if (storedNsfw) setNsfwFilter(JSON.parse(storedNsfw));
        if (storedFolders) setFolders(JSON.parse(storedFolders)); // NEW
        
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setIsDataLoaded(true); 
      }
    };
    loadData();
  }, []); 

  usePersist('@anilist_data', animeList, isDataLoaded, asJson);
  usePersist('@anilist_categories', customCategories, isDataLoaded, asJson);
  usePersist('@anilist_hidden', hiddenCategories, isDataLoaded, asJson);
  usePersist('@anilist_themePref', themePref, isDataLoaded, asRaw);
  usePersist('@anilist_storageUri', storageUri, isDataLoaded, asRaw);
  usePersist('@anilist_backupFreq', backupFrequency, isDataLoaded, asRaw);
  usePersist('@anilist_accentColor', accentColor, isDataLoaded, asRaw);
  usePersist('@anilist_nsfw', nsfwFilter, isDataLoaded, asJson);
  usePersist('@anilist_folders', folders, isDataLoaded, asJson);

  return (
    <AppContext.Provider value={{ 
      themePref, setThemePref, theme, 
      displayMode, setDisplayMode, sortBy, setSortBy, isAscending, setIsAscending, 
      isSearchActive, setIsSearchActive, searchQuery, setSearchQuery,
      selectedGenres, setSelectedGenres, 
      customCategories, setCustomCategories, hiddenCategories, setHiddenCategories,
      animeList, setAnimeList, storageUri, setStorageUri, 
      backupFrequency, setBackupFrequency, accentColor, setAccentColor,
      nsfwFilter, setNsfwFilter, isDataLoaded,
      isListEditMode, setIsListEditMode, folders, setFolders // NEW
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};