import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, useWindowDimensions, FlatList, Image, Modal, SafeAreaView, Animated, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { AnimeEntry } from '../types';
import LuxionChat from '../components/LuxionChat';

export default function ListScreen() {
  const { 
    theme, isSearchActive, searchQuery, setSearchQuery, 
    sortBy, isAscending, displayMode, customCategories, animeList, setAnimeList, hiddenCategories,
    accentColor, selectedGenres 
  } = useAppContext();
  
  const { width } = useWindowDimensions(); 

  const allTabs = ['Watched', 'Will Watch', 'Dropped', ...customCategories]
                    .filter(cat => !hiddenCategories.includes(cat));
  const [activeTab, setActiveTab] = useState<string>('Watched');

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

  useEffect(() => {
    if (!allTabs.includes(activeTab)) setActiveTab('Watched');
  }, [customCategories]);

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

  let filteredData = animeList.filter(anime => {
    const activeCats = anime.categories || [anime.status];
    return activeCats.includes(activeTab);
  });

  if (selectedGenres && selectedGenres.length > 0) {
    filteredData = filteredData.filter(anime => {
      if (!anime.genres || anime.genres.length === 0) return false;
      return selectedGenres.every(genre => anime.genres!.includes(genre));
    });
  }

  if (isSearchActive && searchQuery.trim() !== '') {
    filteredData = filteredData.filter(anime => anime.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  filteredData.sort((a, b) => {
    let result = 0;
    if (sortBy === 'Alphabetically') result = a.title.localeCompare(b.title);
    else if (sortBy === 'Stars') result = a.rating - b.rating;
    else if (sortBy === 'Date Added') result = parseInt(a.id) - parseInt(b.id); 
    return isAscending ? result : -result;
  });

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const tabBg = theme === 'Dark' ? '#000' : '#fff';
  const cardBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  const toggleCategory = (cat: string) => {
    if (!viewAnime) return;
    const currentCats = viewAnime.categories || [viewAnime.status];
    let newCats;

    if (currentCats.includes(cat)) {
      newCats = currentCats.filter(c => c !== cat);
    } else {
      newCats = [...currentCats, cat];
    }

    if (!newCats.includes(viewAnime.status)) {
      newCats.push(viewAnime.status);
    }

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
    };

    setAnimeList(animeList.map(a => a.id === movingAnime.id ? updatedAnime : a));
    setMovingAnime(null);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderItem = ({ item }: { item: AnimeEntry }) => {
    const isGrid = displayMode === 'Compact Grid';
    const isTextOnly = displayMode === 'Text Only'; 
    const isDeleting = deleteModeId === item.id;
    const isWillWatch = item.status === 'Will Watch'; 

    const s = item.season || 1;
    const e = item.episode || 0;
    const progressText = `S${s} • Ep ${e}`;

    const handlePress = () => {
      if (isDeleting) {
        setDeleteModeId(null); 
      } else {
        setViewAnime(item);
        setIsSynopsisExpanded(false); 
      }
    };

    const handleLongPress = () => {
      if (isDeleting) {
        setDeleteModeId(null); 
      } else {
        setDeleteModeId(item.id); 
      }
    };

    if (isTextOnly) {
      return (
        <TouchableOpacity 
          style={[styles.textOnlyCard, { backgroundColor: cardBg, borderColor }]}
          onPress={handlePress} onLongPress={handleLongPress} delayLongPress={400}
        >
          <View style={{ flex: 1, opacity: isDeleting ? 0 : 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.textOnlyTitle, { color: textColor, flex: 1 }]} numberOfLines={1}>{item.title}</Text>
              <Text style={{ color: '#888', fontSize: 11, marginLeft: 10 }}>{formatDate(item.id)}</Text>
            </View>
            {item.status !== 'Will Watch' && <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{progressText}</Text>}
          </View>

          {isDeleting && (
            <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', borderRadius: 8, overflow: 'hidden' }]}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center' }} 
                onPress={() => setAnimeList(animeList.filter(a => a.id !== item.id))}
                onLongPress={handleLongPress} delayLongPress={400}
              >
                <Ionicons name="trash" size={20} color="#fff" />
              </TouchableOpacity>
              {isWillWatch && (
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

    return (
      <TouchableOpacity 
        style={[isGrid ? styles.gridCard : styles.listCard, { width: isGrid ? cardWidth : 'auto', backgroundColor: cardBg, borderColor }]}
        onPress={handlePress} onLongPress={handleLongPress} delayLongPress={400} activeOpacity={isDeleting ? 1 : 0.7}
      >
        <View style={isGrid ? { width: '100%', height: 140 } : { width: 60, height: 80 }}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={isGrid ? styles.gridImage : styles.listImage} />
          ) : (
            <View style={[isGrid ? styles.gridImagePlaceholder : styles.listImagePlaceholder, { backgroundColor: borderColor }]}><Ionicons name="image-outline" size={isGrid ? 30 : 24} color="#888" /></View>
          )}
        </View>

        {isGrid && (
          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{formatDate(item.id)}</Text>
          </View>
        )}
        
        <View style={isGrid ? styles.gridInfo : styles.listInfo}>
          {!isGrid ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={[styles.listTitle, { color: textColor, flex: 1, marginRight: 10 }]} numberOfLines={1}>{item.title}</Text>
              <Text style={{ color: '#888', fontSize: 11 }}>{formatDate(item.id)}</Text>
            </View>
          ) : (
            <Text style={[styles.gridTitle, { color: textColor }]} numberOfLines={2}>{item.title}</Text>
          )}
          
          {!isGrid && <Text style={[styles.listStatus, { color: '#888' }]}>{item.status !== 'Will Watch' ? `${progressText}  |  ` : ''}{item.categories?.join(', ') || item.status}</Text>}
          {isGrid && item.status !== 'Will Watch' && <Text style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>{progressText}</Text>}
          
          {item.genres && item.genres.length > 0 && (
            <View style={isGrid ? styles.gridGenreContainer : styles.listGenreContainer}>
              {item.genres.slice(0, isGrid ? 2 : 3).map((genre, idx) => (
                <View key={idx} style={[styles.genrePill, { borderColor: accentColor }]}>
                  <Text style={{ color: textColor, fontSize: isGrid ? 9 : 11 }} numberOfLines={1}>{genre}</Text>
                </View>
              ))}
              {item.genres.length > (isGrid ? 2 : 3) && (
                <Text style={{ color: '#888', fontSize: isGrid ? 9 : 11, alignSelf: 'center' }}>
                  +{item.genres.length - (isGrid ? 2 : 3)}
                </Text>
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
        </View>

        {isDeleting && (
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', borderRadius: isGrid ? 8 : 12, overflow: 'hidden' }]}>
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: 'rgba(255, 59, 48, 0.95)', justifyContent: 'center', alignItems: 'center' }} 
              onPress={() => setAnimeList(animeList.filter(a => a.id !== item.id))}
              onLongPress={handleLongPress} delayLongPress={400}
            >
              <Ionicons name="trash" size={isGrid ? 32 : 24} color="#fff" />
              {isGrid && <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontWeight: 'bold' }}>Delete</Text>}
            </TouchableOpacity>

            {isWillWatch && (
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

      {isSearchActive && (
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

      <FlatList
        key={displayMode} 
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={displayMode === 'Compact Grid' ? 3 : 1}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={displayMode === 'Compact Grid' ? styles.gridRow : undefined}
        showsVerticalScrollIndicator={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={60} color="#888" />
            <Text style={{ color: '#888', marginTop: 10, fontSize: 16 }}>No anime in {activeTab} yet.</Text>
          </View>
        }
      />

      <LuxionChat />

      {/* --- Details Modal --- */}
      <Modal visible={!!viewAnime} animationType="slide" transparent={false} onRequestClose={() => setViewAnime(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <TouchableOpacity onPress={() => setViewAnime(null)} style={styles.closeBtn}><Ionicons name="chevron-down" size={28} color={textColor} /></TouchableOpacity>
              <Text style={[styles.modalHeaderText, { color: textColor }]}>Details</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
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
                        <Text style={[styles.modalProgressValue, { color: textColor }]}>{viewAnime?.season || 1}</Text>
                        <TouchableOpacity onPress={() => updateProgress('season', 1)}><Ionicons name="add-circle" size={28} color={accentColor} /></TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={[styles.modalProgressBox, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={{ color: '#888', fontWeight: 'bold', marginBottom: 5 }}>Episode</Text>
                      <View style={styles.modalProgressControls}>
                        <TouchableOpacity onPress={() => updateProgress('episode', -1)}><Ionicons name="remove-circle" size={28} color="#888" /></TouchableOpacity>
                        <Text style={[styles.modalProgressValue, { color: textColor }]}>{viewAnime?.episode || 0}</Text>
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
        <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <TouchableOpacity onPress={() => setMovingAnime(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={textColor} /></TouchableOpacity>
              <Text style={[styles.modalHeaderText, { color: textColor }]}>Update Status</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
              
              <Text style={{ color: '#888', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 }}>Moving Anime</Text>
              <Text style={[styles.modalTitle, { color: textColor, textAlign: 'left', marginBottom: 25 }]}>{movingAnime?.title}</Text>

              <Text style={[styles.formLabel, { color: textColor }]}>New Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
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
                        <Text style={[styles.counterValue, { color: textColor }]}>{moveSeason}</Text>
                        <TouchableOpacity onPress={() => setMoveSeason(moveSeason + 1)}><Ionicons name="add-circle" size={32} color={accentColor} /></TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.counterCard, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.counterLabel, { color: textColor }]}>Episode</Text>
                      <View style={styles.counterControls}>
                        <TouchableOpacity onPress={() => setMoveEpisode(Math.max(0, moveEpisode - 1))}><Ionicons name="remove-circle" size={32} color="#888" /></TouchableOpacity>
                        <Text style={[styles.counterValue, { color: textColor }]}>{moveEpisode}</Text>
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
  modalProgressValue: { fontSize: 20, fontWeight: 'bold', minWidth: 24, textAlign: 'center' },

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
  counterValue: { fontSize: 22, fontWeight: 'bold', width: 30, textAlign: 'center' },
  starsContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  input: { borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top', marginBottom: 20 },
  saveButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 50 },
  saveButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});