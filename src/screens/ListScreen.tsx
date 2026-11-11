import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, useWindowDimensions, FlatList, Image, Modal, Animated, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppContext } from '../context/AppContext';
import { AnimeEntry } from '../types';
import LuxionChat from '../components/LuxionChat';

export default function ListScreen() {
  const { 
    theme, isSearchActive, searchQuery, setSearchQuery, 
    sortBy, isAscending, displayMode, customCategories, animeList, setAnimeList, hiddenCategories,
    accentColor, selectedGenres, 
    isListEditMode, setIsListEditMode, folders, setFolders 
  } = useAppContext();
  
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions(); 

  const allTabs = ['Watched', 'Will Watch', 'Dropped', ...customCategories]
                    .filter(cat => !hiddenCategories.includes(cat));
  const [activeTab, setActiveTab] = useState<string>('Watched');

  // Multi-Selection and Folder States
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<string[]>([]);
  const [manageFoldersVisible, setManageFoldersVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const [deleteModeId, setDeleteModeId] = useState<string | null>(null);

  const [movingAnime, setMovingAnime] = useState<AnimeEntry | null>(null);
  const [moveStatus, setMoveStatus] = useState('');
  const [moveRating, setMoveRating] = useState(0);
  const [moveComments, setMoveComments] = useState('');
  const [moveSeason, setMoveSeason] = useState(1);
  const [moveEpisode, setMoveEpisode] = useState(0);

  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const [tabMeasurements, setTabMeasurements] = useState<{ [key: string]: { x: number; width: number } }>({});

  // --- Custom Alert & Toast States ---
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-50)).current; 

  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    confirmText?: string;
    onConfirm?: () => void;
  }>({ visible: false, title: '', message: '', type: 'alert' });

  const showToast = (message: string) => {
    setToastMessage(message);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(toastTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }) 
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(toastTranslateY, { toValue: -50, duration: 300, useNativeDriver: true }) 
        ]).start();
      }, 2500); 
    });
  };

  // Edit mode action bar — slides up from below the screen when editing starts.
  const editBarAnim = useRef(new Animated.Value(160)).current;
  useEffect(() => {
    Animated.timing(editBarAnim, {
      toValue: isListEditMode ? 0 : 160,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isListEditMode]);

  // Manage Folders sheet — same slide-up pattern as the filter sheet.
  const folderSheetAnim = useRef(new Animated.Value(800)).current;

  const openManageFolders = () => {
    setManageFoldersVisible(true);
    Animated.timing(folderSheetAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeManageFolders = () => {
    setRenamingFolder(null);
    Animated.timing(folderSheetAnim, { toValue: 800, duration: 250, useNativeDriver: true }).start(() => setManageFoldersVisible(false));
  };

  useEffect(() => {
    if (!isListEditMode) setSelectedAnimeIds([]);
  }, [isListEditMode]);

  useEffect(() => {
    if (!allTabs.includes(activeTab)) setActiveTab('Watched');
    setActiveFolder(null); 
  }, [customCategories, activeTab]);

  useEffect(() => {
    setSelectedAnimeIds([]);
  }, [activeFolder]);

  useEffect(() => {
    const measurement = tabMeasurements[activeTab];
    if (measurement) {
      Animated.parallel([
        Animated.timing(indicatorPosition, { toValue: measurement.x, duration: 250, useNativeDriver: false }),
        Animated.timing(indicatorWidth, { toValue: measurement.width, duration: 250, useNativeDriver: false }),
      ]).start();
    }
  }, [activeTab, tabMeasurements]);

  useEffect(() => {
    if (movingAnime) {
      setMoveStatus(movingAnime.status === 'Will Watch' ? 'Watched' : movingAnime.status);
      setMoveRating(movingAnime.rating || 0);
      setMoveComments(movingAnime.comments || '');
      setMoveSeason(movingAnime.season || 1);
      setMoveEpisode(movingAnime.episode || 0);
    }
  }, [movingAnime]);

  const isScrollable = allTabs.length > 3;
  const tabWidth = isScrollable ? undefined : width / allTabs.length;
  const gridSpacing = 10;
  const gridPadding = 15; 
  const cardWidth = (width - (gridPadding * 2) - (gridSpacing * 2)) / 3;

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const tabBg = theme === 'Dark' ? '#000' : '#fff';
  const cardBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  // --- DATA PROCESSING & GROUPING ---
  let rawData = animeList.filter(anime => {
    const activeCats = anime.categories || [anime.status];
    return activeCats.includes(activeTab);
  });

  if (selectedGenres && selectedGenres.length > 0) {
    rawData = rawData.filter(anime => {
      if (!anime.genres || anime.genres.length === 0) return false;
      return selectedGenres.every(genre => anime.genres!.includes(genre));
    });
  }

  if (isSearchActive && searchQuery.trim() !== '') {
    rawData = rawData.filter(anime => anime.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  let finalDisplayData: any[] = [];

  if (activeFolder) {
    finalDisplayData = rawData.filter(a => a.folder === activeFolder);
  } else {
    const folderMap: Record<string, AnimeEntry[]> = {};
    const standalones: AnimeEntry[] = [];
    
    rawData.forEach(anime => {
      if (anime.folder && folders.includes(anime.folder)) {
        if (!folderMap[anime.folder]) folderMap[anime.folder] = [];
        folderMap[anime.folder].push(anime);
      } else {
        standalones.push(anime);
      }
    });

    // Folders are sortable pseudo-entries mixed into the SAME sort as regular
    // anime — no pinning, no section header. The alphabetical pre-sort here is
    // only for deterministic tie-breaking (Array.sort is stable).
    // The `|| []` guards mean a malformed entry can never crash the render.
    const folderItems = Object.keys(folderMap).map(folderName => ({ 
      isFolder: true, 
      id: `folder_${folderName}`, 
      title: folderName, 
      items: folderMap[folderName] || [] 
    })).sort((a, b) => a.title.localeCompare(b.title));

    finalDisplayData = [...folderItems, ...standalones];

    // One sort for everyone — folders rank by their own rules:
    //   Alphabetically: folder name vs anime title
    //   Stars:          folders count as 0 (same as an unrated anime)
    //   Date Added:     a folder's "date" is the newest of its entries
    finalDisplayData.sort((a, b) => {
      let result = 0;
      if (sortBy === 'Alphabetically') {
        result = (a.title || '').localeCompare(b.title || '');
      } else if (sortBy === 'Stars') {
        const ratingA = a.isFolder ? 0 : (a.rating || 0);
        const ratingB = b.isFolder ? 0 : (b.rating || 0);
        result = ratingA - ratingB;
      } else if (sortBy === 'Date Added') {
        const idA = a.isFolder
          ? Math.max(...(a.items || []).map((item: any) => parseInt(item.statusUpdatedAt || item.id)))
          : parseInt(a.statusUpdatedAt || a.id);
        const idB = b.isFolder
          ? Math.max(...(b.items || []).map((item: any) => parseInt(item.statusUpdatedAt || item.id)))
          : parseInt(b.statusUpdatedAt || b.id);
        result = idA - idB;
      }
      return isAscending ? result : -result;
    });
  }

  // --- SELECTION HELPERS (for the action bar) ---
  const visibleAnimeIds: string[] = finalDisplayData
    .filter((d: any) => !d.isFolder)
    .map((d: any) => d.id);
  const allVisibleSelected = visibleAnimeIds.length > 0 && visibleAnimeIds.every((id: string) => selectedAnimeIds.includes(id));

  // --- ACTIONS ---
  const toggleSelection = (id: string) => {
    if (selectedAnimeIds.includes(id)) {
      setSelectedAnimeIds(selectedAnimeIds.filter(itemId => itemId !== id));
    } else {
      setSelectedAnimeIds([...selectedAnimeIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedAnimeIds([]);
    else setSelectedAnimeIds(visibleAnimeIds);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    if (folders.includes(newFolderName.trim())) {
      setCustomAlert({ visible: true, title: 'Already Exists', message: 'A folder with this name already exists.', type: 'alert' });
      return;
    }
    setFolders([...folders, newFolderName.trim()]);
    showToast(`Created folder: ${newFolderName.trim()}`);
    setNewFolderName('');
  };

  // Renames the folder AND every entry inside it (the name is stored on each
  // entry, so nothing gets orphaned).
  const handleRenameFolder = (oldName: string) => {
    const newName = renameText.trim();
    if (!newName || newName === oldName) { setRenamingFolder(null); return; }
    if (folders.includes(newName)) {
      setCustomAlert({ visible: true, title: 'Already Exists', message: 'A folder with this name already exists.', type: 'alert' });
      return;
    }
    setFolders(folders.map(f => f === oldName ? newName : f));
    setAnimeList(animeList.map(a => a.folder === oldName ? { ...a, folder: newName } : a));
    // Insurance in case this sheet is ever opened while inside the renamed folder
    if (activeFolder === oldName) setActiveFolder(newName);
    setRenamingFolder(null);
    showToast(`Renamed to ${newName}`);
  };

  const handleDeleteFolder = (folderName: string) => {
    setCustomAlert({
      visible: true,
      title: 'Delete Folder',
      message: `Delete "${folderName}"? Your anime will NOT be deleted, they will simply be ungrouped.`,
      type: 'confirm',
      confirmText: 'Delete',
      onConfirm: () => {
        setFolders(folders.filter(f => f !== folderName));
        setAnimeList(animeList.map(a => a.folder === folderName ? { ...a, folder: undefined } : a));
        showToast(`Folder deleted.`);
      }
    });
  };

  const assignToFolder = (folderName: string) => {
    setAnimeList(animeList.map(a => selectedAnimeIds.includes(a.id) ? { ...a, folder: folderName } : a));
    setSelectedAnimeIds([]);
    setIsListEditMode(false);
    showToast(`Moved to ${folderName}`);
  };

  // Folder chip tap — one-tap grouping from the action bar.
  const quickAssign = (folderName: string) => {
    if (selectedAnimeIds.length === 0) {
      setCustomAlert({ visible: true, title: 'Hold up!', message: 'Select some anime first!', type: 'alert' });
      return;
    }
    assignToFolder(folderName);
  };

  // Multi-delete from the action bar.
  const handleDeleteSelected = () => {
    if (selectedAnimeIds.length === 0) {
      setCustomAlert({ visible: true, title: 'Hold up!', message: 'Select some anime first!', type: 'alert' });
      return;
    }
    const count = selectedAnimeIds.length;
    setCustomAlert({
      visible: true,
      title: 'Delete Anime',
      message: `Delete ${count} ${count === 1 ? 'entry' : 'entries'} from your list? This cannot be undone.`,
      type: 'confirm',
      confirmText: 'Delete',
      onConfirm: () => {
        setAnimeList(animeList.filter(a => !selectedAnimeIds.includes(a.id)));
        setSelectedAnimeIds([]);
        showToast(`Deleted ${count} ${count === 1 ? 'entry' : 'entries'}.`);
      }
    });
  };

  // Remove selected from the folder you're currently inside (action bar, edit mode).
  const removeSelectedFromFolder = () => {
    if (selectedAnimeIds.length === 0) {
      setCustomAlert({ visible: true, title: 'Hold up!', message: 'Select an anime to remove first!', type: 'alert' });
      return;
    }
    setAnimeList(animeList.map(a => selectedAnimeIds.includes(a.id) ? { ...a, folder: undefined } : a));
    setSelectedAnimeIds([]);
    showToast('Removed from folder');
  };

  const handleSaveMove = () => {
    if (!movingAnime) return;
    let updatedCats = movingAnime.categories.filter(c => c !== movingAnime.status);
    if (!updatedCats.includes(moveStatus)) updatedCats.push(moveStatus);

    const updatedAnime = {
      ...movingAnime,
      status: moveStatus,
      categories: updatedCats,
      rating: moveStatus === 'Will Watch' ? 0 : moveRating,
      comments: moveStatus === 'Will Watch' ? '' : moveComments,
      season: moveStatus === 'Will Watch' ? 1 : moveSeason,
      episode: moveStatus === 'Will Watch' ? 0 : moveEpisode,
      // Stamp the actual moment this status change happened, so sorting/dates reflect
      // "when it was watched/dropped" rather than the original creation date.
      statusUpdatedAt: Date.now().toString(),
    };
    setAnimeList(animeList.map(a => a.id === movingAnime.id ? updatedAnime : a));
    setMovingAnime(null);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }: { item: any }) => {
    const isGrid = displayMode === 'Compact Grid';
    const isTextOnly = displayMode === 'Text Only'; 
    const isDeleting = deleteModeId === item.id;
    const isSelected = selectedAnimeIds.includes(item.id);

    const handlePress = () => {
      if (isListEditMode) {
        if (item.isFolder) {
          setActiveFolder(item.title); 
        } else {
          toggleSelection(item.id);
        }
        return;
      }
      if (isDeleting) {
        setDeleteModeId(null); 
      } else if (item.isFolder) {
        setActiveFolder(item.title);
      } else {
        navigation.navigate('AnimeDetail', { animeId: item.id });
      }
    };

    const handleLongPress = () => {
      if (isListEditMode || item.isFolder) return;
      if (isDeleting) setDeleteModeId(null); 
      else setDeleteModeId(item.id); 
    };

    // 1. TEXT ONLY RENDER
    if (isTextOnly) {
      return (
        <TouchableOpacity 
          style={[styles.textOnlyCard, { backgroundColor: cardBg, borderColor }]}
          onPress={handlePress} onLongPress={handleLongPress} delayLongPress={400}
        >
          {isSelected && <View style={[StyleSheet.absoluteFill, { borderWidth: 2, borderColor: accentColor, borderRadius: 8 }]} pointerEvents="none" />}

          {isListEditMode && !item.isFolder && (
            <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? accentColor : '#888'} style={{ marginRight: 12, zIndex: 10 }} />
          )}
          <View style={{ flex: 1, opacity: isDeleting ? 0 : 1, zIndex: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.textOnlyTitle, { color: textColor, flex: 1 }]} numberOfLines={1}>
                {item.title}
              </Text>
              {!item.isFolder && <Text style={{ color: '#888', fontSize: 11, marginLeft: 10 }}>{formatDate(item.statusUpdatedAt || item.id)}</Text>}
            </View>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              {item.isFolder ? `${(item.items || []).length} Entries` : (item.status !== 'Will Watch' ? `S${item.season || 1} • Ep ${item.episode || 0}` : '')}
            </Text>
          </View>

          {isDeleting && !item.isFolder && (
            <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', zIndex: 20 }]}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center' }} 
                onPress={() => setAnimeList(animeList.filter(a => a.id !== item.id))}
                onLongPress={handleLongPress} delayLongPress={400}
              >
                <Ionicons name="trash" size={20} color="#fff" />
              </TouchableOpacity>
              {item.status === 'Will Watch' && (
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' }} 
                  onPress={() => { setMovingAnime(item); setDeleteModeId(null); }}
                  onLongPress={handleLongPress} delayLongPress={400}
                >
                  <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    }

    // 2. GRID / LIST COVER IMAGE RENDER
    const coverContent = item.isFolder ? (
      <View style={isGrid ? { width: '100%', height: 140 } : { width: 60, height: 80 }}>
        {(item.items || []).slice(0, 3).map((anime: any, idx: number) => (
          <Image 
            key={idx} 
            source={{ uri: anime.imageUri }} 
            style={[
              isGrid ? styles.gridImage : styles.listImage, 
              { position: 'absolute', top: idx*4, left: idx*4, zIndex: 3-idx, borderWidth: 1, borderColor: cardBg, backgroundColor: borderColor }
            ]} 
          />
        ))}
      </View>
    ) : (
      <View style={isGrid ? { width: '100%', height: 140 } : { width: 60, height: 80 }}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={isGrid ? styles.gridImage : styles.listImage} />
        ) : (
          <View style={[isGrid ? styles.gridImagePlaceholder : styles.listImagePlaceholder, { backgroundColor: borderColor }]}><Ionicons name="image-outline" size={isGrid ? 30 : 24} color="#888" /></View>
        )}
      </View>
    );

    // 3. GRID / LIST MAIN CARD
    return (
      <TouchableOpacity 
        style={[
          isGrid ? styles.gridCard : styles.listCard, 
          { width: isGrid ? cardWidth : 'auto', backgroundColor: cardBg, borderColor },
          isListEditMode && !item.isFolder && isSelected && { transform: [{ scale: 0.96 }] }
        ]}
        onPress={handlePress} onLongPress={handleLongPress} delayLongPress={400} activeOpacity={isDeleting ? 1 : 0.7}
      >
        {isSelected && <View style={[StyleSheet.absoluteFill, { borderWidth: 2, borderColor: accentColor, borderRadius: isGrid ? 8 : 12, zIndex: 11 }]} pointerEvents="none" />}

        {coverContent}

        {isGrid && !item.isFolder && (
          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, zIndex: 10 }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{formatDate(item.statusUpdatedAt || item.id)}</Text>
          </View>
        )}
        
        <View style={isGrid ? styles.gridInfo : styles.listInfo}>
          {!isGrid ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={[styles.listTitle, { color: textColor, flex: 1, marginRight: 10 }]} numberOfLines={1}>{item.title}</Text>
              {!item.isFolder && <Text style={{ color: '#888', fontSize: 11 }}>{formatDate(item.statusUpdatedAt || item.id)}</Text>}
            </View>
          ) : (
            <Text style={[styles.gridTitle, { color: textColor }]} numberOfLines={2}>{item.title}</Text>
          )}
          
          {item.isFolder ? (
            <Text style={{ color: '#888', fontSize: 12, marginTop: isGrid ? 0 : 4, fontWeight: 'bold' }}>{(item.items || []).length} Entries</Text>
          ) : (
            <>
              {!isGrid && <Text style={[styles.listStatus, { color: '#888' }]}>{item.status !== 'Will Watch' ? `S${item.season || 1} • Ep ${item.episode || 0}  |  ` : ''}{item.categories?.join(', ') || item.status}</Text>}
              {isGrid && item.status !== 'Will Watch' && <Text style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>S{item.season || 1} • Ep {item.episode || 0}</Text>}
              
              {item.genres && item.genres.length > 0 && (
                <View style={isGrid ? styles.gridGenreContainer : styles.listGenreContainer}>
                  {item.genres.slice(0, isGrid ? 2 : 3).map((genre: string, idx: number) => (
                    <View key={idx} style={[styles.genrePill, { borderColor: accentColor }]}>
                      <Text style={{ color: textColor, fontSize: isGrid ? 9 : 11 }} numberOfLines={1}>{genre}</Text>
                    </View>
                  ))}
                  {item.genres.length > (isGrid ? 2 : 3) && (
                    <Text style={{ color: '#888', fontSize: isGrid ? 9 : 11, alignSelf: 'center' }}>+{item.genres.length - (isGrid ? 2 : 3)}</Text>
                  )}
                </View>
              )}

              {item.status !== 'Will Watch' && (
                <View style={isGrid ? styles.starRow : styles.starRowList}>
                  {isGrid ? (
                    <><Ionicons name="star" size={14} color={accentColor} /><Text style={{ color: '#888', marginLeft: 4, fontSize: 12 }}>{item.rating}/5</Text></>
                  ) : (
                    [1, 2, 3, 4, 5].map((star) => <Ionicons key={star} name={star <= item.rating ? "star" : "star-outline"} size={16} color={star <= item.rating ? accentColor : '#555'} />)
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Selection badge — always rendered in edit mode, color-swapped only */}
        {isListEditMode && !item.isFolder && (
          <View style={[styles.selectBadge, { backgroundColor: isSelected ? accentColor : 'rgba(0,0,0,0.5)' }]}>
            <Ionicons name={isSelected ? 'checkmark' : 'ellipse-outline'} size={15} color="#fff" />
          </View>
        )}

        {isDeleting && !item.isFolder && (
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', borderRadius: isGrid ? 8 : 12, overflow: 'hidden', zIndex: 20 }]}>
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: 'rgba(255, 59, 48, 0.95)', justifyContent: 'center', alignItems: 'center' }} 
              onPress={() => setAnimeList(animeList.filter(a => a.id !== item.id))}
              onLongPress={handleLongPress} delayLongPress={400}
            >
              <Ionicons name="trash" size={isGrid ? 32 : 24} color="#fff" />
              {isGrid && <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontWeight: 'bold' }}>Delete</Text>}
            </TouchableOpacity>

            {item.status === 'Will Watch' && (
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: 'rgba(52, 199, 89, 0.95)', justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' }} 
                onPress={() => { setMovingAnime(item); setDeleteModeId(null); }}
                onLongPress={handleLongPress} delayLongPress={400}
              >
                <Ionicons name="arrow-forward-circle" size={isGrid ? 32 : 24} color="#fff" />
                {isGrid && <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontWeight: 'bold' }}>Move</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* TABS */}
      <View style={{ backgroundColor: tabBg, borderBottomColor: borderColor, borderBottomWidth: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={isScrollable ? styles.tabScrollContainer : { flexGrow: 1, position: 'relative' }}>
          {allTabs.map((tab) => (
            <TouchableOpacity 
              key={tab} 
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setTabMeasurements(prev => ({ ...prev, [tab]: { x, width } }));
              }}
              style={[styles.tabButton, { width: tabWidth, paddingHorizontal: isScrollable ? 20 : 0 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: textColor }, activeTab === tab && { color: accentColor, opacity: 1 }]}>{tab}</Text>
            </TouchableOpacity>
          ))}
          <Animated.View style={[styles.animatedIndicator, { width: indicatorWidth, transform: [{ translateX: indicatorPosition }], backgroundColor: accentColor }]} />
        </ScrollView>
      </View>

      {/* SEARCH — hidden while editing */}
      {isSearchActive && !activeFolder && !isListEditMode && (
        <View style={[styles.searchContainer, { backgroundColor: cardBg, borderColor }]}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput 
            style={[styles.searchInput, { color: textColor }]}
            placeholder={`Search ${activeTab}...`}
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      )}

      {/* ACTIVE FOLDER HEADER */}
      {activeFolder && (
        <View style={styles.activeFolderHeader}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setActiveFolder(null)}>
            <Ionicons name="arrow-back" size={20} color={accentColor} />
            <Text style={{ color: accentColor, fontSize: 16, fontWeight: 'bold', marginLeft: 10 }}>Back to {activeTab}</Text>
          </TouchableOpacity>
          <Text style={{ color: textColor, fontSize: 16, marginLeft: 'auto', fontWeight: 'bold' }}>{activeFolder}</Text>
        </View>
      )}

      {/* MAIN LIST */}
      <FlatList
        key={displayMode} 
        data={finalDisplayData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={displayMode === 'Compact Grid' ? 3 : 1}
        contentContainerStyle={[styles.listContent, { paddingBottom: isListEditMode ? 230 : 100 }]}
        columnWrapperStyle={displayMode === 'Compact Grid' ? styles.gridRow : undefined}
        showsVerticalScrollIndicator={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={60} color="#888" />
            <Text style={{ color: '#888', marginTop: 10, fontSize: 16 }}>No entries found here.</Text>
          </View>
        }
      />

      {/* Luxion's FAB hides while editing */}
      {!isListEditMode && <LuxionChat />}

      {/* --- Custom Alert Modal --- */}
      <Modal visible={customAlert.visible} animationType="fade" transparent={true} onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
        <View style={styles.modalOverlayFadeCenter}>
          <View style={[styles.alertBox, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.alertTitle, { color: textColor }]}>{customAlert.title}</Text>
            <Text style={[styles.alertMessage, { color: '#888' }]}>{customAlert.message}</Text>
            
            <View style={[styles.alertButtonContainer, { borderColor }]}>
              {customAlert.type === 'confirm' && (
                <TouchableOpacity 
                  style={[styles.alertButton, { borderRightWidth: 1, borderColor }]} 
                  onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                >
                  <Text style={[styles.alertButtonText, { color: textColor }]}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.alertButton} 
                onPress={() => {
                  if (customAlert.onConfirm) customAlert.onConfirm();
                  setCustomAlert({ ...customAlert, visible: false });
                }}
              >
                <Text style={[styles.alertButtonText, { color: customAlert.type === 'confirm' ? '#FF3B30' : accentColor, fontWeight: 'bold' }]}>
                  {customAlert.confirmText || 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Manage Folders Sheet — LuxionChat's modal structure: the backdrop
          is a SIBLING stacked above the sheet, so nothing touchable wraps the
          folder list. A tap-swallowing wrapper around the sheet is what was
          eating the list's scroll gestures. --- */}
      <Modal visible={manageFoldersVisible} animationType="fade" transparent={true} onRequestClose={closeManageFolders}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          
          {/* Backdrop — fills all the space above the sheet; tap to dismiss */}
          <TouchableOpacity style={styles.modalOverlayFade} activeOpacity={1} onPress={closeManageFolders} />

          <Animated.View style={[styles.bottomSheet, { backgroundColor: cardBg, borderColor, transform: [{ translateY: folderSheetAnim }] }]}>
            <View style={styles.dragIndicator} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: textColor }]}>Manage Folders</Text>
              <TouchableOpacity onPress={closeManageFolders} style={{ padding: 4 }}>
                <Ionicons name="close" size={26} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Create row — accent button dims until there's a name (Luxion send-button language) */}
            <View style={[styles.inputWrapper, { backgroundColor: bgColor, borderColor, marginBottom: 20 }]}>
              <TextInput 
                style={[styles.inputWithClear, { color: textColor }]}
                placeholder="New folder name..."
                placeholderTextColor="#888"
                value={newFolderName}
                onChangeText={setNewFolderName}
                onSubmitEditing={handleCreateFolder}
                returnKeyType="done"
              />
              <TouchableOpacity 
                onPress={handleCreateFolder} 
                style={[styles.createFolderBtn, { backgroundColor: newFolderName.trim() ? accentColor : '#555' }]}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Screen-relative window (~6-7 rows visible) + visible scroll indicator */}
            <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
              {folders.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <Ionicons name="folder-open-outline" size={44} color="#888" />
                  <Text style={{ color: '#888', marginTop: 10, fontSize: 15 }}>No folders yet.</Text>
                  <Text style={{ color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' }}>Name one above to start grouping your anime.</Text>
                </View>
              ) : (
                folders.map((folder) => {
                  const folderAnime = animeList.filter(a => a.folder === folder);
                  const isRenaming = renamingFolder === folder;
                  return (
                    <View key={folder} style={[styles.manageRow, { borderBottomColor: borderColor }]}>
                      {/* Live mini-stack of the folder's first three covers */}
                      <View style={styles.manageStack}>
                        {folderAnime.length === 0 ? (
                          <View style={[styles.manageThumb, { backgroundColor: borderColor, justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="folder-outline" size={16} color="#888" />
                          </View>
                        ) : folderAnime.slice(0, 3).map((a, idx) => (
                          a.imageUri ? (
                            <Image key={idx} source={{ uri: a.imageUri }} style={[styles.manageThumb, { position: 'absolute', top: idx * 3, left: idx * 3, zIndex: 3 - idx, borderWidth: 1, borderColor: cardBg }]} />
                          ) : (
                            <View key={idx} style={[styles.manageThumb, { position: 'absolute', top: idx * 3, left: idx * 3, zIndex: 3 - idx, backgroundColor: borderColor, justifyContent: 'center', alignItems: 'center' }]}>
                              <Ionicons name="image-outline" size={12} color="#888" />
                            </View>
                          )
                        ))}
                      </View>

                      {isRenaming ? (
                        <TextInput
                          style={[styles.manageRenameInput, { borderColor: accentColor, color: textColor }]}
                          value={renameText}
                          onChangeText={setRenameText}
                          autoFocus
                          onSubmitEditing={() => handleRenameFolder(folder)}
                          returnKeyType="done"
                        />
                      ) : (
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{folder}</Text>
                          <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{folderAnime.length} {folderAnime.length === 1 ? 'entry' : 'entries'}</Text>
                        </View>
                      )}

                      {isRenaming ? (
                        <TouchableOpacity onPress={() => handleRenameFolder(folder)} style={{ padding: 6, marginLeft: 8 }}>
                          <Ionicons name="checkmark-circle" size={24} color={accentColor} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => { setRenamingFolder(folder); setRenameText(folder); }} style={{ padding: 6, marginLeft: 8 }}>
                          <Ionicons name="pencil" size={20} color="#888" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDeleteFolder(folder)} style={{ padding: 6, marginLeft: 4 }}>
                        <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>

          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- Moving Anime Modal --- */}
      <Modal visible={!!movingAnime} animationType="slide" transparent={false} onRequestClose={() => setMovingAnime(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <TouchableOpacity onPress={() => setMovingAnime(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={textColor} /></TouchableOpacity>
              <Text style={[styles.modalHeaderText, { color: textColor }]}>Update Status</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              
              <Text style={{ color: '#888', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 }}>Moving Anime</Text>
              <Text style={[styles.modalTitle, { color: textColor, textAlign: 'left', marginBottom: 25 }]}>{movingAnime?.title}</Text>

              <Text style={[styles.formLabel, { color: textColor }]}>New Status</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={{ height: 50, marginBottom: 15 }}
                contentContainerStyle={{ alignItems: 'center' }}
              >
                {allTabs.map((s) => (
                  <TouchableOpacity 
                    key={s} 
                    style={[styles.statusButton, { backgroundColor: cardBg, borderColor }, moveStatus === s && { backgroundColor: accentColor, borderColor: accentColor }]}
                    onPress={() => setMoveStatus(s)}
                  >
                    <Text style={[styles.statusText, moveStatus === s && styles.statusTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {moveStatus !== 'Will Watch' && (
                <>
                  <Text style={[styles.formLabel, { color: textColor, marginTop: 10 }]}>Progress</Text>
                  <View style={styles.progressContainer}>
                    <View style={[styles.counterCard, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.counterLabel, { color: textColor }]}>Season</Text>
                      <View style={styles.counterControls}>
                        <TouchableOpacity onPress={() => setMoveSeason(Math.max(1, moveSeason - 1))}><Ionicons name="remove-circle" size={32} color="#888" /></TouchableOpacity>
                        <TextInput 
                          style={[styles.counterValue, { color: textColor, padding: 0 }]}
                          keyboardType="numeric"
                          maxLength={4}
                          value={moveSeason.toString()}
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9]/g, '');
                            setMoveSeason(numericValue ? parseInt(numericValue, 10) : 0);
                          }}
                          onBlur={() => {
                            if (moveSeason < 1) setMoveSeason(1);
                          }}
                        />
                        <TouchableOpacity onPress={() => setMoveSeason(moveSeason + 1)}><Ionicons name="add-circle" size={32} color={accentColor} /></TouchableOpacity>
                      </View>
                    </View>
                    <View style={[styles.counterCard, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.counterLabel, { color: textColor }]}>Episode</Text>
                      <View style={styles.counterControls}>
                        <TouchableOpacity onPress={() => setMoveEpisode(Math.max(0, moveEpisode - 1))}><Ionicons name="remove-circle" size={32} color="#888" /></TouchableOpacity>
                        <TextInput 
                          style={[styles.counterValue, { color: textColor, padding: 0 }]}
                          keyboardType="numeric"
                          maxLength={4}
                          value={moveEpisode.toString()}
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9]/g, '');
                            setMoveEpisode(numericValue ? parseInt(numericValue, 10) : 0);
                          }}
                        />
                        <TouchableOpacity onPress={() => setMoveEpisode(moveEpisode + 1)}><Ionicons name="add-circle" size={32} color={accentColor} /></TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.formLabel, { color: textColor }]}>Rating</Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => setMoveRating(star)}>
                        <Ionicons name={star <= moveRating ? "star" : "star-outline"} size={36} color={star <= moveRating ? accentColor : "#555"} />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.formLabel, { color: textColor }]}>Comments / Review</Text>
                  <TextInput 
                    style={[styles.input, styles.textArea, { backgroundColor: cardBg, borderColor, color: textColor }]} 
                    placeholder="What did you think about it?" 
                    placeholderTextColor="#888"
                    multiline 
                    value={moveComments}
                    onChangeText={setMoveComments}
                  />
                </>
              )}

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: accentColor }]} onPress={handleSaveMove}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* --- EDIT MODE ACTION BAR --- */}
      <Animated.View 
        pointerEvents={isListEditMode ? 'auto' : 'none'}
        style={[styles.editBar, { backgroundColor: cardBg, borderColor, transform: [{ translateY: editBarAnim }] }]}
      >
        <View style={styles.editBarTop}>
          <View style={[styles.editCountBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.editCountText}>{selectedAnimeIds.length}</Text>
          </View>
          <Text style={[styles.editBarTitle, { color: textColor }]}>Selected</Text>

          <TouchableOpacity style={styles.editBarAction} onPress={toggleSelectAll}>
            <Text style={{ color: accentColor, fontWeight: '700', fontSize: 13 }}>{allVisibleSelected ? 'None' : 'All'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBarAction} onPress={handleDeleteSelected}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.editBarDone, { backgroundColor: accentColor }]} onPress={() => setIsListEditMode(false)}>
            <Text style={styles.editBarDoneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {!activeFolder ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
            <TouchableOpacity style={[styles.folderChip, styles.newFolderChip, { borderColor: accentColor }]} onPress={openManageFolders}>
              <Ionicons name="add" size={16} color={accentColor} />
              <Text style={[styles.folderChipText, { color: accentColor }]}>New Folder</Text>
            </TouchableOpacity>
            {folders.map((f) => (
              <TouchableOpacity key={f} style={[styles.folderChip, { borderColor }]} onPress={() => quickAssign(f)}>
                <Ionicons name="folder" size={14} color={accentColor} />
                <Text style={[styles.folderChipText, { color: textColor }]} numberOfLines={1}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity style={[styles.removeFolderChip, { borderColor: '#FF3B30' }]} onPress={removeSelectedFromFolder}>
            <Ionicons name="folder-open-outline" size={14} color="#FF3B30" />
            <Text style={{ color: '#FF3B30', fontWeight: '700', fontSize: 13 }}>Remove Selected from This Folder</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* --- Toast Notification --- */}
      <Animated.View 
        pointerEvents="none" 
        style={[
          styles.toastContainer, 
          { backgroundColor: accentColor, opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }
        ]}
      >
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabScrollContainer: { paddingHorizontal: 10, position: 'relative' },
  tabButton: { paddingVertical: 14, alignItems: 'center' }, 
  tabText: { fontSize: 15, fontWeight: '600', opacity: 0.6 },
  animatedIndicator: { position: 'absolute', bottom: 0, height: 3, borderRadius: 3 }, 

  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 15, marginBottom: 0, paddingHorizontal: 15, borderRadius: 10, borderWidth: 1, height: 45 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8 },
  inputWithClear: { flex: 1, padding: 14, fontSize: 16 },

  activeFolderHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginTop: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333' },

  listContent: { padding: 15, paddingBottom: 100 }, 
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100, opacity: 0.5 },

  textOnlyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 8, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  textOnlyTitle: { fontSize: 16, fontWeight: 'bold' },

  listCard: { flexDirection: 'row', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: 'hidden', position: 'relative' },
  listImage: { width: '100%', height: '100%', borderRadius: 6 },
  listImagePlaceholder: { width: '100%', height: '100%', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  listInfo: { marginLeft: 15, flex: 1, justifyContent: 'center' },
  listTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  listStatus: { fontSize: 13, marginBottom: 4 },
  starRowList: { flexDirection: 'row', gap: 2, marginTop: 4 },

  gridRow: { gap: 10, justifyContent: 'flex-start' }, 
  gridCard: { borderRadius: 8, borderWidth: 1, marginBottom: 12, overflow: 'hidden', position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  gridInfo: { padding: 8 },
  gridTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 4, height: 32 }, 
  starRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },

  genrePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, marginRight: 4, marginBottom: 4, justifyContent: 'center', alignItems: 'center' },
  listGenreContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, marginBottom: 4 },
  gridGenreContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2, marginBottom: 4 },

  selectBadge: { position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 12 },

  // Backdrop for the manage sheet — as a SIBLING it fills all space above the sheet
  modalOverlayFade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  dragIndicator: { width: 40, height: 5, backgroundColor: '#888', borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, borderWidth: 1, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold' },

  // --- Manage Folders rows ---
  manageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  manageStack: { width: 44, height: 54, justifyContent: 'center', alignItems: 'center' },
  manageThumb: { width: 36, height: 48, borderRadius: 4 },
  manageRenameInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 15 },
  createFolderBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 8 },

  // --- CUSTOM ALERT STYLES ---
  modalOverlayFadeCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { width: '100%', maxWidth: 320, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  alertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 20, marginBottom: 10, paddingHorizontal: 20 },
  alertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20, lineHeight: 20 },
  alertButtonContainer: { flexDirection: 'row', borderTopWidth: 1 },
  alertButton: { flex: 1, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  alertButtonText: { fontSize: 16 },

  toastContainer: {
    position: 'absolute',
    top: 60, 
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 100,
    width: '90%'
  },
  toastText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 10, flexShrink: 1 },

  // --- EDIT MODE ACTION BAR ---
  editBar: { 
    position: 'absolute', left: 12, right: 12, bottom: 10, 
    borderRadius: 16, borderWidth: 1, padding: 12, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, 
    elevation: 8, zIndex: 50 
  },
  editBarTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  editCountBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  editCountText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  editBarTitle: { marginLeft: 10, fontSize: 15, fontWeight: '600', flex: 1 },
  editBarAction: { paddingHorizontal: 10, paddingVertical: 6 },
  editBarDone: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 10, marginLeft: 4 },
  editBarDoneText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  folderChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, marginRight: 8, maxWidth: 160 },
  newFolderChip: { borderStyle: 'dashed' },
  folderChipText: { marginLeft: 6, fontSize: 13, fontWeight: '600' },
  removeFolderChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },

  // Shared with AnimeDetailScreen (Moving Anime modal still uses these here)
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1 },
  closeBtn: { padding: 5 },
  modalHeaderText: { fontSize: 18, fontWeight: 'bold' },
  modalTitle: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },

  formLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  statusButton: { paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderRadius: 8, marginRight: 10, alignItems: 'center' },
  statusText: { color: '#888', fontWeight: '600' },
  statusTextActive: { color: '#FFF' },
  progressContainer: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  counterCard: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 15, alignItems: 'center' },
  counterLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, opacity: 0.8 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterValue: { fontSize: 22, fontWeight: 'bold', minWidth: 50, textAlign: 'center' },
  starsContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  input: { borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top', marginBottom: 20 },
  saveButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 50 },
  saveButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});