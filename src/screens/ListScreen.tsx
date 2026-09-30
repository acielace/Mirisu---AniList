import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, useWindowDimensions, FlatList, Image, Modal, Animated, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  
  const { width } = useWindowDimensions(); 

  const allTabs = ['Watched', 'Will Watch', 'Dropped', ...customCategories]
                    .filter(cat => !hiddenCategories.includes(cat));
  const [activeTab, setActiveTab] = useState<string>('Watched');

  // Multi-Selection and Folder States
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<string[]>([]);
  const [manageFoldersVisible, setManageFoldersVisible] = useState(false);
  const [assignFolderVisible, setAssignFolderVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const [deleteModeId, setDeleteModeId] = useState<string | null>(null);
  const [viewAnime, setViewAnime] = useState<AnimeEntry | null>(null);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

  const [isEditingComment, setIsEditingComment] = useState(false);
  const [tempComment, setTempComment] = useState('');

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

  useEffect(() => {
    setIsEditingComment(false);
    if (viewAnime) {
      setTempComment(viewAnime.comments || '');
    }
  }, [viewAnime]);

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

    Object.keys(folderMap).forEach(folderName => {
      finalDisplayData.push({ 
        isFolder: true, 
        id: `folder_${folderName}`, 
        title: folderName, 
        items: folderMap[folderName] 
      });
    });
    finalDisplayData.push(...standalones);
  }

  finalDisplayData.sort((a, b) => {
    let result = 0;
    if (sortBy === 'Alphabetically') {
      result = (a.title || '').localeCompare(b.title || '');
    } else if (sortBy === 'Stars') {
      const ratingA = a.isFolder ? 0 : a.rating; 
      const ratingB = b.isFolder ? 0 : b.rating;
      result = ratingA - ratingB;
    } else if (sortBy === 'Date Added') {
      // Use statusUpdatedAt (last status change) when available, falling back to id (creation time).
      const idA = a.isFolder ? Math.max(...a.items.map((i:any)=>parseInt(i.statusUpdatedAt || i.id))) : parseInt(a.statusUpdatedAt || a.id);
      const idB = b.isFolder ? Math.max(...b.items.map((i:any)=>parseInt(i.statusUpdatedAt || i.id))) : parseInt(b.statusUpdatedAt || b.id);
      result = idA - idB;
    }
    return isAscending ? result : -result;
  });

  // --- ACTIONS ---
  const toggleSelection = (id: string) => {
    if (selectedAnimeIds.includes(id)) {
      setSelectedAnimeIds(selectedAnimeIds.filter(itemId => itemId !== id));
    } else {
      setSelectedAnimeIds([...selectedAnimeIds, id]);
    }
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
    setAssignFolderVisible(false);
    showToast(`Moved to ${folderName}`);
  };

  const toggleCategory = (cat: string) => {
    if (!viewAnime) return;
    const currentCats = viewAnime.categories || [viewAnime.status];
    let newCats;
    if (currentCats.includes(cat)) { newCats = currentCats.filter(c => c !== cat); } 
    else { newCats = [...currentCats, cat]; }
    if (!newCats.includes(viewAnime.status)) { newCats.push(viewAnime.status); }

    const updatedAnime = { ...viewAnime, categories: newCats };
    setViewAnime(updatedAnime);
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? updatedAnime : a));
  };

  const updateProgress = (type: 'season' | 'episode', amount: number) => {
    if (!viewAnime) return;
    const newValue = Math.max(type === 'season' ? 1 : 0, (viewAnime[type] || 0) + amount);
    const updatedAnime = { ...viewAnime, [type]: newValue };
    setViewAnime(updatedAnime);
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? updatedAnime : a));
  };

  const setExactProgress = (type: 'season' | 'episode', value: number) => {
    if (!viewAnime) return;
    const updatedAnime = { ...viewAnime, [type]: value };
    setViewAnime(updatedAnime);
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? updatedAnime : a));
  };

  const updateRating = (newRating: number) => {
    if (!viewAnime) return;
    const updatedAnime = { ...viewAnime, rating: newRating };
    setViewAnime(updatedAnime);
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? updatedAnime : a));
  };

  const saveComment = () => {
    if (!viewAnime) return;
    const updatedAnime = { ...viewAnime, comments: tempComment };
    setViewAnime(updatedAnime);
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? updatedAnime : a));
    setIsEditingComment(false);
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
        setViewAnime(item);
        setIsSynopsisExpanded(false); 
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
          {/* Inner stroke for selection */}
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
              {item.isFolder ? `${item.items.length} Entries` : (item.status !== 'Will Watch' ? `S${item.season || 1} • Ep ${item.episode || 0}` : '')}
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
        {item.items.slice(0, 3).map((anime: any, idx: number) => (
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
          { width: isGrid ? cardWidth : 'auto', backgroundColor: cardBg, borderColor }
        ]}
        onPress={handlePress} onLongPress={handleLongPress} delayLongPress={400} activeOpacity={isDeleting ? 1 : 0.7}
      >
        {/* Inner stroke for selection so layout doesn't jump */}
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
            <Text style={{ color: '#888', fontSize: 12, marginTop: isGrid ? 0 : 4, fontWeight: 'bold' }}>{item.items.length} Entries</Text>
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

        {isListEditMode && !item.isFolder && (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: cardBg, borderRadius: 12, zIndex: 12 }}>
            <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? accentColor : '#888'} />
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

      {/* SEARCH OR EDIT ACTION BAR */}
      {/* Hidden when actively viewing inside a folder */}
      {isListEditMode && !activeFolder ? (
        <View style={[styles.editBar, { backgroundColor: cardBg, borderColor }]}>
          <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>{selectedAnimeIds.length} Selected</Text>
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setManageFoldersVisible(true)}>
              <Ionicons name="folder-outline" size={28} color={textColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              if (selectedAnimeIds.length === 0) { 
                setCustomAlert({ visible: true, title: 'Hold up!', message: 'Select some anime first!', type: 'alert' }); 
                return; 
              }
              if (folders.length === 0) setManageFoldersVisible(true);
              else setAssignFolderVisible(true);
            }}>
              <Ionicons name="add" size={32} color={accentColor} />
            </TouchableOpacity>
          </View>
        </View>
      ) : isSearchActive && !activeFolder && (
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
          
          {isListEditMode ? (
            <TouchableOpacity 
              style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(255,59,48,0.1)' }}
              onPress={() => {
                if (selectedAnimeIds.length === 0) { 
                  setCustomAlert({ visible: true, title: 'Hold up!', message: 'Select an anime to remove first!', type: 'alert' }); 
                  return; 
                }
                setAnimeList(animeList.map(a => selectedAnimeIds.includes(a.id) ? { ...a, folder: undefined } : a));
                setSelectedAnimeIds([]);
                showToast('Removed from folder');
              }}
            >
              <Ionicons name="remove-circle" size={20} color="#FF3B30" />
              {/* Shows exactly how many are selected to be removed */}
              <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: 'bold', marginLeft: 6 }}>Remove ({selectedAnimeIds.length})</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: textColor, fontSize: 16, marginLeft: 'auto', fontWeight: 'bold' }}>{activeFolder}</Text>
          )}
        </View>
      )}

      {/* MAIN LIST */}
      <FlatList
        key={displayMode} 
        data={finalDisplayData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={displayMode === 'Compact Grid' ? 3 : 1}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={displayMode === 'Compact Grid' ? styles.gridRow : undefined}
        showsVerticalScrollIndicator={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={60} color="#888" />
            <Text style={{ color: '#888', marginTop: 10, fontSize: 16 }}>No entries found here.</Text>
          </View>
        }
      />

      <LuxionChat />

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

      {/* --- Manage Folders Modal --- */}
      <Modal visible={manageFoldersVisible} animationType="fade" transparent={true} onRequestClose={() => setManageFoldersVisible(false)}>
        <TouchableOpacity style={styles.modalOverlayFade} activeOpacity={1} onPress={() => setManageFoldersVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[styles.bottomSheet, { backgroundColor: cardBg, borderColor }]}>
              
              <View style={styles.dragIndicator} />
              
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: textColor }]}>Manage Folders</Text>
              </View>
              
              <View style={[styles.inputWrapper, { backgroundColor: bgColor, borderColor, marginBottom: 20 }]}>
                <TextInput 
                  style={[styles.inputWithClear, { color: textColor }]}
                  placeholder="New Folder Name..."
                  placeholderTextColor="#888"
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                />
                <TouchableOpacity onPress={handleCreateFolder} style={{ paddingRight: 15 }}>
                  <Ionicons name="add-circle" size={28} color={accentColor} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 300 }}>
                {folders.length === 0 ? (
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No folders created yet.</Text>
                ) : (
                  folders.map((folder) => (
                    <View key={folder} style={[styles.folderListItem, { borderBottomColor: borderColor }]}>
                      <Ionicons name="folder" size={24} color={accentColor} />
                      <Text style={{ color: textColor, fontSize: 16, flex: 1, marginLeft: 15 }}>{folder}</Text>
                      <TouchableOpacity onPress={() => handleDeleteFolder(folder)}>
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>

            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* --- Assign Folder Modal --- */}
      <Modal visible={assignFolderVisible} animationType="fade" transparent={true} onRequestClose={() => setAssignFolderVisible(false)}>
        <TouchableOpacity style={styles.modalOverlayFade} activeOpacity={1} onPress={() => setAssignFolderVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[styles.bottomSheet, { backgroundColor: cardBg, borderColor }]}>
              
              <View style={styles.dragIndicator} />
              
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: textColor }]}>Move to Folder</Text>
              </View>

              <ScrollView style={{ maxHeight: 300 }}>
                {folders.map((folder) => (
                  <TouchableOpacity key={folder} style={[styles.folderListItem, { borderBottomColor: borderColor }]} onPress={() => assignToFolder(folder)}>
                    <Ionicons name="folder" size={24} color={accentColor} />
                    <Text style={{ color: textColor, fontSize: 16, flex: 1, marginLeft: 15 }}>{folder}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#888" />
                  </TouchableOpacity>
                ))}
              </ScrollView>

            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* --- Details Modal --- */}
      <Modal visible={!!viewAnime} animationType="slide" transparent={false} onRequestClose={() => setViewAnime(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <TouchableOpacity onPress={() => setViewAnime(null)} style={styles.closeBtn}><Ionicons name="chevron-down" size={28} color={textColor} /></TouchableOpacity>
              <Text style={[styles.modalHeaderText, { color: textColor }]}>Details</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <View style={[styles.modalImageContainer, { backgroundColor: cardBg, borderColor }]}>
                {viewAnime?.imageUri ? <Image source={{ uri: viewAnime.imageUri }} style={styles.modalImage} /> : <Ionicons name="image-outline" size={60} color="#888" />}
              </View>

              <Text style={[styles.modalTitle, { color: textColor }]}>{viewAnime?.title}</Text>
              
              {viewAnime?.genres && viewAnime.genres.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 }}>
                  {viewAnime.genres.map((genre, idx) => (
                    <View key={idx} style={[styles.modalGenrePill, { borderColor: accentColor, backgroundColor: cardBg }]}>
                      <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{genre}</Text>
                    </View>
                  ))}
                </View>
              )}

              {viewAnime?.status !== 'Will Watch' && (
                <View style={styles.modalStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => updateRating(star)}>
                      <Ionicons 
                        name={star <= (viewAnime?.rating || 0) ? "star" : "star-outline"} 
                        size={36} 
                        color={star <= (viewAnime?.rating || 0) ? accentColor : "#555"} 
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {viewAnime?.description ? (
                <View style={{ marginBottom: 25 }}>
                  <Text style={[styles.modalSectionTitle, { color: textColor, marginTop: 0 }]}>Synopsis</Text>
                  <Text 
                    style={{ color: textColor, opacity: 0.8, lineHeight: 22 }}
                    numberOfLines={isSynopsisExpanded ? undefined : 3}
                  >
                    {viewAnime.description}
                  </Text>
                  <TouchableOpacity onPress={() => setIsSynopsisExpanded(!isSynopsisExpanded)} style={{ marginTop: 8 }}>
                    <Text style={{ color: accentColor, fontWeight: 'bold' }}>{isSynopsisExpanded ? 'Show Less' : 'Read More'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {viewAnime?.status !== 'Will Watch' && (
                <>
                  <Text style={[styles.modalSectionTitle, { color: textColor, marginTop: 0 }]}>Progress</Text>
                  <View style={styles.modalProgressContainer}>
                    <View style={[styles.modalProgressBox, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={{ color: '#888', fontWeight: 'bold', marginBottom: 5 }}>Season</Text>
                      <View style={styles.modalProgressControls}>
                        <TouchableOpacity onPress={() => updateProgress('season', -1)}><Ionicons name="remove-circle" size={28} color="#888" /></TouchableOpacity>
                        <TextInput 
                          style={[styles.modalProgressValue, { color: textColor, padding: 0 }]}
                          keyboardType="numeric"
                          maxLength={4}
                          value={(viewAnime?.season || 1).toString()}
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9]/g, '');
                            setExactProgress('season', numericValue ? parseInt(numericValue, 10) : 0);
                          }}
                          onBlur={() => {
                            if (!viewAnime?.season || viewAnime.season < 1) setExactProgress('season', 1);
                          }}
                        />
                        <TouchableOpacity onPress={() => updateProgress('season', 1)}><Ionicons name="add-circle" size={28} color={accentColor} /></TouchableOpacity>
                      </View>
                    </View>
                    <View style={[styles.modalProgressBox, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={{ color: '#888', fontWeight: 'bold', marginBottom: 5 }}>Episode</Text>
                      <View style={styles.modalProgressControls}>
                        <TouchableOpacity onPress={() => updateProgress('episode', -1)}><Ionicons name="remove-circle" size={28} color="#888" /></TouchableOpacity>
                        <TextInput 
                          style={[styles.modalProgressValue, { color: textColor, padding: 0 }]}
                          keyboardType="numeric"
                          maxLength={4}
                          value={(viewAnime?.episode || 0).toString()}
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9]/g, '');
                            setExactProgress('episode', numericValue ? parseInt(numericValue, 10) : 0);
                          }}
                        />
                        <TouchableOpacity onPress={() => updateProgress('episode', 1)}><Ionicons name="add-circle" size={28} color={accentColor} /></TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </>
              )}

              <Text style={[styles.modalSectionTitle, { color: textColor }]}>Add to Category</Text>
              {customCategories.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
                  {customCategories.map(cat => { 
                    const isActive = (viewAnime?.categories || []).includes(cat);
                    return (
                      <TouchableOpacity 
                        key={cat} 
                        style={[styles.tagPill, { backgroundColor: isActive ? accentColor : cardBg, borderColor: isActive ? accentColor : borderColor }]}
                        onPress={() => toggleCategory(cat)}
                      >
                        <Text style={[styles.tagText, { color: isActive ? '#fff' : textColor }]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={{ color: '#888', fontStyle: 'italic', marginBottom: 25, marginTop: 5 }}>No custom categories added. You can add them from the top right menu!</Text>
              )}

              {viewAnime?.status !== 'Will Watch' && (
                <View style={{ marginBottom: 40 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 10 }}>
                    <Text style={[styles.modalSectionTitle, { color: textColor, margin: 0 }]}>My Review</Text>
                    {!isEditingComment ? (
                      <TouchableOpacity onPress={() => setIsEditingComment(true)} style={{ padding: 5 }}>
                        <Ionicons name="pencil" size={20} color={accentColor} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={saveComment} style={{ padding: 5 }}>
                        <Text style={{ color: accentColor, fontWeight: 'bold', fontSize: 16 }}>Save</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {isEditingComment ? (
                    <TextInput 
                      style={[styles.input, styles.textArea, { backgroundColor: cardBg, borderColor, color: textColor }]} 
                      placeholder="Change your mind? Write a new review..." 
                      placeholderTextColor="#888"
                      multiline 
                      value={tempComment}
                      onChangeText={setTempComment}
                      autoFocus
                    />
                  ) : (
                    viewAnime?.comments ? (
                      <View style={[styles.reviewBox, { backgroundColor: cardBg, borderColor }]}>
                        <Text style={{ color: textColor, fontSize: 16, lineHeight: 24 }}>{viewAnime.comments}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.reviewBox, { backgroundColor: cardBg, borderColor, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' }]} 
                        onPress={() => setIsEditingComment(true)}
                      >
                        <Text style={{ color: '#888', fontStyle: 'italic' }}>Tap here to add a review...</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              )}

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
  
  editBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 15, marginBottom: 0, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, height: 50 },
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
  modalGenrePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginHorizontal: 4, marginBottom: 8 },

  modalOverlayFade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  dragIndicator: { width: 40, height: 5, backgroundColor: '#888', borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, borderWidth: 1, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold' },
  folderListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },

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

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1 },
  closeBtn: { padding: 5 },
  modalHeaderText: { fontSize: 18, fontWeight: 'bold' },
  modalImageContainer: { width: '100%', height: 350, borderRadius: 12, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  modalTitle: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  modalStars: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 25 },
  modalSectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  
  modalProgressContainer: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  modalProgressBox: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  modalProgressControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  modalProgressValue: { fontSize: 20, fontWeight: 'bold', minWidth: 50, textAlign: 'center' },

  tagScroll: { marginBottom: 25 },
  tagPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginRight: 10 },
  tagText: { fontWeight: 'bold', fontSize: 14 },
  reviewBox: { padding: 15, borderRadius: 12, borderWidth: 1, minHeight: 100 },

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