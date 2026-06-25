import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native'; 
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
  
  // NEW: State to track which genres are currently selected in the filter
  selectedGenres: string[]; setSelectedGenres: (genres: string[]) => void;

  customCategories: string[]; setCustomCategories: (cats: string[]) => void;
  hiddenCategories: string[]; setHiddenCategories: (cats: string[]) => void;
  animeList: AnimeEntry[]; setAnimeList: (list: AnimeEntry[]) => void;
  storageUri: string; setStorageUri: (uri: string) => void; 
  backupFrequency: string; setBackupFrequency: (freq: string) => void; 
  accentColor: string; setAccentColor: (color: string) => void;
  nsfwFilter: boolean; setNsfwFilter: (enabled: boolean) => void;
  isDataLoaded: boolean; 
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const systemTheme = useColorScheme(); 
  const [themePref, setThemePref] = useState<ThemePref>('Dark');
  
  const theme: Theme = themePref === 'System' ? (systemTheme === 'dark' ? 'Dark' : 'Light') : themePref;

  const [displayMode, setDisplayMode] = useState<DisplayMode>('List');
  const [sortBy, setSortBy] = useState('Date Added'); 
  const [isAscending, setIsAscending] = useState(false); 
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // NEW: Initialize the genre filter as an empty array (shows all by default)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [animeList, setAnimeList] = useState<AnimeEntry[]>([]);
  
  const [storageUri, setStorageUri] = useState(''); 
  const [backupFrequency, setBackupFrequency] = useState('Off'); 
  const [accentColor, setAccentColor] = useState('#4FA4FF'); 
  const [nsfwFilter, setNsfwFilter] = useState(false);

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

        if (storedAnime) setAnimeList(JSON.parse(storedAnime));
        if (storedCategories) setCustomCategories(JSON.parse(storedCategories));
        if (storedHidden) setHiddenCategories(JSON.parse(storedHidden));
        if (storedThemePref) setThemePref(storedThemePref as ThemePref);
        if (storedUri) setStorageUri(storedUri); 
        if (storedFreq) setBackupFrequency(storedFreq); 
        if (storedAccent) setAccentColor(storedAccent);
        if (storedNsfw) setNsfwFilter(JSON.parse(storedNsfw));
        
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setIsDataLoaded(true); 
      }
    };
    loadData();
  }, []); 

  useEffect(() => {
    const saveData = async () => {
      if (!isDataLoaded) return; 
      try {
        await AsyncStorage.setItem('@anilist_data', JSON.stringify(animeList));
        await AsyncStorage.setItem('@anilist_categories', JSON.stringify(customCategories));
        await AsyncStorage.setItem('@anilist_hidden', JSON.stringify(hiddenCategories));
        await AsyncStorage.setItem('@anilist_themePref', themePref);
        await AsyncStorage.setItem('@anilist_storageUri', storageUri); 
        await AsyncStorage.setItem('@anilist_backupFreq', backupFrequency); 
        await AsyncStorage.setItem('@anilist_accentColor', accentColor);
        await AsyncStorage.setItem('@anilist_nsfw', JSON.stringify(nsfwFilter));
      } catch (error) {
        console.error("Failed to save data", error);
      }
    };
    saveData();
  }, [animeList, customCategories, hiddenCategories, themePref, storageUri, backupFrequency, accentColor, nsfwFilter, isDataLoaded]);

  return (
    <AppContext.Provider value={{ 
      themePref, setThemePref, theme, 
      displayMode, setDisplayMode, sortBy, setSortBy, isAscending, setIsAscending, 
      isSearchActive, setIsSearchActive, searchQuery, setSearchQuery,
      selectedGenres, setSelectedGenres, // NEW: Provided the state to the rest of the app
      customCategories, setCustomCategories, hiddenCategories, setHiddenCategories,
      animeList, setAnimeList, storageUri, setStorageUri, 
      backupFrequency, setBackupFrequency, accentColor, setAccentColor,
      nsfwFilter, setNsfwFilter, isDataLoaded
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