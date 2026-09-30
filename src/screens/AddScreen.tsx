import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator, Animated, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppContext } from '../context/AppContext';
import { ANILIST_URL, KITSU_ANIME_URL } from '../constants'; 

export default function AddScreen() {
  const { animeList, setAnimeList, theme, accentColor, nsfwFilter, customCategories = [] } = useAppContext(); 

  const allStatuses = ['Watched', 'Will Watch', 'Dropped'];

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(''); 
  const [subCategory, setSubCategory] = useState(''); 
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(0);
  const [description, setDescription] = useState(''); 
  const [fetchedGenres, setFetchedGenres] = useState<string[]>([]);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFromApi, setSelectedFromApi] = useState(false); 
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const [showDropdown, setShowDropdown] = useState(false); 
  const [statusDropdownVisible, setStatusDropdownVisible] = useState(false);
  const [subCategoryDropdownVisible, setSubCategoryDropdownVisible] = useState(false);
  
  const skipSearch = useRef(false);

  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-50)).current; 

  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }

    if (title.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);

      // Primary source. Returns ok:true only on a genuine successful AniList response
      // (including a real zero-result search) — ok:false means AniList itself failed,
      // which is the only condition that should trigger the fallback below.
      const fetchFromAniList = async (): Promise<{ ok: boolean; data: any[] }> => {
        try {
          const query = `
            query ($search: String) {
              Page (page: 1, perPage: 15) {
                media (search: $search, type: ANIME${nsfwFilter ? ', isAdult: false' : ''}) {
                  id
                  title { romaji english }
                  coverImage { large }
                  description(asHtml: false)
                  genres
                }
              }
            }
          `;

          const response = await fetch(ANILIST_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: query,
              variables: { search: title.trim() }
            })
          });

          const json = await response.json();

          if (json.errors) {
            // AniList's own API returns this shape when their servers are in a degraded/disabled
            // state (documented behavior, not something wrong with our request).
            console.log("AniList API error:", json.errors[0]?.message || json.errors);
            return { ok: false, data: [] };
          }

          if (json.data && json.data.Page && Array.isArray(json.data.Page.media)) {
            const mappedData = json.data.Page.media.map((anime: any) => ({
              mal_id: anime.id,
              title_english: anime.title.english || anime.title.romaji,
              title: anime.title.romaji,
              images: { jpg: { image_url: anime.coverImage.large, large_image_url: anime.coverImage.large } },
              synopsis: anime.description ? anime.description.replace(/<[^>]+>/g, '') : '',
              genres: anime.genres || []
            }));
            return { ok: true, data: mappedData };
          }

          return { ok: false, data: [] };
        } catch (error) {
          console.log("AniList network error:", error);
          return { ok: false, data: [] };
        }
      };

      // Fallback source, only ever called when AniList itself failed. Kitsu has its own
      // hosted database (unlike Jikan, which scrapes MyAnimeList's live site in real time),
      // so it isn't subject to the same upstream-scraping failures we just hit.
      const fetchFromKitsu = async (): Promise<{ ok: boolean; data: any[] }> => {
        try {
          const kitsuUrl = `${KITSU_ANIME_URL}?filter[text]=${encodeURIComponent(title.trim())}&page[limit]=15`;
          const kitsuResponse = await fetch(kitsuUrl, {
            headers: { 'Accept': 'application/vnd.api+json' }
          });
          const kitsuJson = await kitsuResponse.json();

          if (kitsuJson.data && Array.isArray(kitsuJson.data)) {
            const filtered = nsfwFilter
              ? kitsuJson.data.filter((anime: any) => !anime.attributes?.nsfw)
              : kitsuJson.data;

            const mappedData = filtered.map((anime: any) => {
              const attrs = anime.attributes || {};
              return {
                mal_id: anime.id,
                title_english: attrs.titles?.en || attrs.canonicalTitle,
                title: attrs.canonicalTitle,
                images: {
                  jpg: {
                    image_url: attrs.posterImage?.medium,
                    large_image_url: attrs.posterImage?.large
                  }
                },
                synopsis: attrs.synopsis || '',
                // Kitsu only returns genres via a separate related-resource lookup (JSON:API
                // "include"), which isn't worth the added complexity for a fallback path that's
                // rarely used — leaving this empty just means the genre pills won't show for
                // anime picked while AniList is down, not a functional problem.
                genres: []
              };
            });
            return { ok: true, data: mappedData };
          }

          console.log("Kitsu fallback returned an unexpected response shape:", kitsuJson);
          return { ok: false, data: [] };
        } catch (error) {
          console.log("Kitsu fallback network error:", error);
          return { ok: false, data: [] };
        }
      };

      const aniListResult = await fetchFromAniList();

      if (aniListResult.ok) {
        setSuggestions(aniListResult.data);
        setApiUnavailable(false);
      } else {
        const kitsuResult = await fetchFromKitsu();
        if (kitsuResult.ok) {
          setSuggestions(kitsuResult.data);
          setApiUnavailable(false);
        } else {
          setSuggestions([]);
          setApiUnavailable(true);
        }
      }

      setIsSearching(false);
    }, 600); 

    return () => clearTimeout(delayDebounceFn);
  }, [title, nsfwFilter, retryCount]); 

  const handleSelectAnime = (selectedAnime: any) => {
    skipSearch.current = true;
    setTitle(selectedAnime.title_english || selectedAnime.title); 
    setImageUri(selectedAnime.images.jpg.large_image_url || null); 
    setDescription(selectedAnime.synopsis || ''); 
    setFetchedGenres(selectedAnime.genres || []); 
    setShowDropdown(false); 
    setSelectedFromApi(true); 
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

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

  const performSave = () => {
    const savedCategories = subCategory ? [status, subCategory] : [status];

    const newAnime = {
      id: Date.now().toString(),
      title,
      status,
      categories: savedCategories, 
      rating: status === 'Will Watch' ? 0 : rating,
      comments: status === 'Will Watch' ? '' : comments,
      imageUri,
      season: status === 'Will Watch' ? 1 : season, 
      episode: status === 'Will Watch' ? 0 : episode, 
      description,
      genres: fetchedGenres 
    };

    setAnimeList([...animeList, newAnime]);
    showToast(`Saved ${title} to your list!`);
    
    setTitle('');
    setStatus('');
    setSubCategory('');
    setRating(0);
    setComments('');
    setImageUri(null);
    setSeason(1); 
    setEpisode(0); 
    setDescription(''); 
    setFetchedGenres([]); 
    setShowDropdown(false);
    setStatusDropdownVisible(false);
    setSubCategoryDropdownVisible(false);
    setSelectedFromApi(false);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Hold up!', 'Please enter an anime title.');
      return;
    }
    if (!status) {
      Alert.alert('Hold up!', 'Please select a Status (Watched, Will Watch, or Dropped).');
      return;
    }

    // Exact-match check only (trimmed, case-insensitive) — deliberately not fuzzy, so e.g.
    // "Naruto" and "Naruto Shippuden" are treated as different entries, not duplicates.
    const isDuplicate = animeList.some(
      (a) => a.title.trim().toLowerCase() === title.trim().toLowerCase()
    );

    if (isDuplicate) {
      Alert.alert(
        'Already in Your List',
        `"${title.trim()}" appears to already be on your list. Do you want to add it anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: performSave }
        ]
      );
      return;
    }

    performSave();
  };

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const inputBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: bgColor }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ScrollView contentContainerStyle allows flexGrow to fill the screen */}
      <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" scrollEnabled={!showDropdown}>
        
        {/* Tapping anywhere empty in this wrapper will close keyboard & dropdowns */}
        <TouchableWithoutFeedback 
          onPress={() => {
            Keyboard.dismiss();
            setShowDropdown(false);
            setStatusDropdownVisible(false);
            setSubCategoryDropdownVisible(false);
          }}
        >
          <View style={styles.innerContainer}>
            
            <View style={styles.imageSection}>
              {(!selectedFromApi || !imageUri) && (
                <TouchableOpacity style={[styles.imageButton, { backgroundColor: inputBg, borderColor }]} onPress={pickImage}>
                  <Ionicons name="image-outline" size={24} color={accentColor} />
                  <Text style={[styles.imageButtonText, { color: textColor }]}>
                    {imageUri ? 'Change Cover Image' : 'Add Cover Image (Optional)'}
                  </Text>
                </TouchableOpacity>
              )}
              {imageUri && <Image source={{ uri: imageUri }} style={[styles.coverImage, { backgroundColor: inputBg, marginTop: (!selectedFromApi || !imageUri) ? 15 : 0 }]} />}
            </View>

            <View style={{ zIndex: 10, elevation: 10 }}> 
              <Text style={[styles.label, { color: textColor }]}>Anime Title</Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor }]}>
                <TextInput 
                  style={[styles.inputWithClear, { color: textColor }]} 
                  placeholder="e.g., Attack on Titan" 
                  placeholderTextColor="#888"
                  value={title}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    setShowDropdown(false);
                    Keyboard.dismiss();
                  }}
                  onChangeText={(text) => {
                    setTitle(text);
                    setSelectedFromApi(false); 
                    if (text.length === 0) {
                      setShowDropdown(false);
                      setSuggestions([]);
                      setFetchedGenres([]);
                      setImageUri(null); 
                      setDescription(''); 
                    }
                  }}
                />
                {title.length > 0 && (
                  <TouchableOpacity style={styles.clearIcon} onPress={() => { 
                    setTitle(''); 
                    setShowDropdown(false); 
                    setSuggestions([]); 
                    setFetchedGenres([]); 
                    setImageUri(null);
                    setDescription('');
                    setSelectedFromApi(false); 
                  }}>
                    <Ionicons name="close-circle" size={20} color="#888" />
                  </TouchableOpacity>
                )}
              </View>

              {showDropdown && (
                <View style={[styles.dropdown, { backgroundColor: inputBg, borderColor }]}>
                  {isSearching ? (
                    <View style={{ padding: 20 }}><ActivityIndicator color={accentColor} /></View>
                  ) : suggestions.length > 0 ? (
                    <ScrollView
                      style={{ maxHeight: Dimensions.get('window').height * 0.5 }}  // ← was 410
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={true}
                    >
                      {suggestions.map((anime) => (
                        <TouchableOpacity 
                          key={anime.mal_id} 
                          style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                          onPress={() => handleSelectAnime(anime)}
                        >
                          <Image source={{ uri: anime.images.jpg.image_url }} style={styles.dropdownImage} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownText, { color: textColor }]} numberOfLines={2}>
                              {anime.title_english || anime.title}
                            </Text>
                            {anime.genres && anime.genres.length > 0 && (
                              <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }} numberOfLines={1}>
                                {anime.genres.join(', ')}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : apiUnavailable ? (
                    <View style={{ padding: 15, alignItems: 'center' }}>
                      <Ionicons name="cloud-offline-outline" size={22} color="#888" style={{ marginBottom: 6 }} />
                      <Text style={{ color: '#888', marginBottom: 4, textAlign: 'center' }}>Anime search is temporarily unavailable.</Text>
                      <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>Try again in a bit, or add it manually below.</Text>
                      <TouchableOpacity
                        onPress={() => setRetryCount((c) => c + 1)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: accentColor }}
                      >
                        <Ionicons name="refresh" size={14} color={accentColor} style={{ marginRight: 6 }} />
                        <Text style={{ color: accentColor, fontSize: 13, fontWeight: 'bold' }}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ padding: 15, alignItems: 'center' }}>
                      <Text style={{ color: '#888', marginBottom: 4 }}>No results found.</Text>
                      <Text style={{ color: '#888', fontSize: 12 }}>You can still add it manually!</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={{ zIndex: 9, elevation: 9, marginTop: 20, marginBottom: 15 }}>
              <Text style={[styles.label, { color: textColor }]}>Status</Text>
              <TouchableOpacity 
                activeOpacity={0.7}
                style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor, padding: 14, justifyContent: 'space-between' }]}
                onPress={() => {
                  setStatusDropdownVisible(!statusDropdownVisible);
                  setSubCategoryDropdownVisible(false); 
                }}
              >
                <Text style={{ color: status ? textColor : '#888', fontSize: 16 }}>
                  {status || 'Select Status'}
                </Text>
                <Ionicons name={statusDropdownVisible ? "chevron-up" : "chevron-down"} size={20} color="#888" />
              </TouchableOpacity>

              {statusDropdownVisible && (
                <View style={[styles.dropdown, { top: 80, backgroundColor: inputBg, borderColor }]}>
                  {allStatuses.map((s, index) => (
                    <TouchableOpacity 
                      key={s} 
                      style={[
                        styles.dropdownItem, 
                        { 
                          borderBottomColor: borderColor, 
                          borderBottomWidth: index === allStatuses.length - 1 ? 0 : 1,
                          justifyContent: 'space-between' 
                        }
                      ]}
                      onPress={() => {
                        setStatus(s);
                        setStatusDropdownVisible(false);
                        if (s !== 'Watched') setSubCategory(''); 
                      }}
                    >
                      <Text style={[styles.dropdownText, { color: status === s ? accentColor : textColor, paddingVertical: 4 }]}>
                        {s}
                      </Text>
                      {status === s && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {status === 'Watched' && customCategories.length > 0 && (
              <View style={{ zIndex: 8, elevation: 8, marginBottom: 15 }}>
                <Text style={[styles.label, { color: textColor }]}>Collection (Optional)</Text>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor, padding: 14, justifyContent: 'space-between' }]}
                  onPress={() => {
                    setSubCategoryDropdownVisible(!subCategoryDropdownVisible);
                    setStatusDropdownVisible(false); 
                  }}
                >
                  <Text style={{ color: subCategory ? textColor : '#888', fontSize: 16 }}>
                    {subCategory || 'Select Collection'}
                  </Text>
                  <Ionicons name={subCategoryDropdownVisible ? "chevron-up" : "chevron-down"} size={20} color="#888" />
                </TouchableOpacity>

                {subCategoryDropdownVisible && (
                  <View style={[styles.dropdown, { top: 80, backgroundColor: inputBg, borderColor }]}>
                    {['None', ...customCategories].map((cat, index) => (
                      <TouchableOpacity 
                        key={cat} 
                        style={[
                          styles.dropdownItem, 
                          { 
                            borderBottomColor: borderColor, 
                            borderBottomWidth: index === customCategories.length ? 0 : 1, 
                            justifyContent: 'space-between' 
                          }
                        ]}
                        onPress={() => {
                          setSubCategory(cat === 'None' ? '' : cat); 
                          setSubCategoryDropdownVisible(false);
                        }}
                      >
                        <Text style={[styles.dropdownText, { color: subCategory === cat ? accentColor : textColor, paddingVertical: 4 }]}>
                          {cat}
                        </Text>
                        {subCategory === cat && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={{ zIndex: 1, elevation: 1 }}>
              {status !== '' && status !== 'Will Watch' && (
                <>
                  <Text style={[styles.label, { color: textColor }]}>Progress</Text>
                  <View style={styles.progressContainer}>
                    
                    <View style={[styles.counterCard, { backgroundColor: inputBg, borderColor }]}>
                      <Text style={[styles.counterLabel, { color: textColor }]}>Season</Text>
                      <View style={styles.counterControls}>
                        <TouchableOpacity onPress={() => setSeason(Math.max(1, season - 1))}><Ionicons name="remove-circle" size={32} color="#888" /></TouchableOpacity>
                        <TextInput 
                          style={[styles.counterValue, { color: textColor, padding: 0 }]}
                          keyboardType="numeric"
                          maxLength={4}
                          value={season.toString()}
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9]/g, '');
                            setSeason(numericValue ? parseInt(numericValue, 10) : 0);
                          }}
                          onBlur={() => {
                            if (season < 1) setSeason(1);
                          }}
                        />
                        <TouchableOpacity onPress={() => setSeason(season + 1)}><Ionicons name="add-circle" size={32} color={accentColor} /></TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.counterCard, { backgroundColor: inputBg, borderColor }]}>
                      <Text style={[styles.counterLabel, { color: textColor }]}>Episode</Text>
                      <View style={styles.counterControls}>
                        <TouchableOpacity onPress={() => setEpisode(Math.max(0, episode - 1))}><Ionicons name="remove-circle" size={32} color="#888" /></TouchableOpacity>
                        <TextInput 
                          style={[styles.counterValue, { color: textColor, padding: 0 }]}
                          keyboardType="numeric"
                          maxLength={4}
                          value={episode.toString()}
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9]/g, '');
                            setEpisode(numericValue ? parseInt(numericValue, 10) : 0);
                          }}
                        />
                        <TouchableOpacity onPress={() => setEpisode(episode + 1)}><Ionicons name="add-circle" size={32} color={accentColor} /></TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.label, { color: textColor }]}>Rating</Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => setRating(star)}>
                        <Ionicons name={star <= rating ? "star" : "star-outline"} size={36} color={star <= rating ? accentColor : "#555"} />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: textColor }]}>Comments / Review</Text>
                  <TextInput 
                    style={[styles.input, styles.textArea, { backgroundColor: inputBg, borderColor, color: textColor }]} 
                    placeholder="What did you think about it?" 
                    placeholderTextColor="#888"
                    multiline 
                    value={comments}
                    onChangeText={setComments}
                  />
                </>
              )}

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: accentColor }]} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save to List</Text>
              </TouchableOpacity>
            </View>

          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* --- TOAST NOTIFICATION --- */}
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

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, // Removed padding to let wrapper fill screen
  innerContainer: { flex: 1, padding: 20 }, // Padding moved here
  imageSection: { alignItems: 'center', marginTop: 10, marginBottom: 10 },
  imageButton: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', width: '100%', justifyContent: 'center' },
  imageButtonText: { marginLeft: 8, fontSize: 16, fontWeight: '500' },
  coverImage: { width: 150, height: 200, borderRadius: 8 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8 },
  inputWithClear: { flex: 1, padding: 14, fontSize: 16 },
  clearIcon: { paddingHorizontal: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 16 },
  progressContainer: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  counterCard: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 15, alignItems: 'center' },
  counterLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, opacity: 0.8 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterValue: { fontSize: 22, fontWeight: 'bold', minWidth: 50, textAlign: 'center' },
  dropdown: { position: 'absolute', top: 85, left: 0, right: 0, borderWidth: 1, borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  dropdownImage: { width: 40, height: 60, borderRadius: 4, marginRight: 10 },
  dropdownText: { flex: 1, fontSize: 14, fontWeight: 'bold' },
  textArea: { height: 100, textAlignVertical: 'top' },
  starsContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  saveButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 50 },
  saveButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  
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
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 10,
    flexShrink: 1, 
  }
});