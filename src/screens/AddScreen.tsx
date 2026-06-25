import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppContext } from '../context/AppContext'; 

export default function AddScreen() {
  const { animeList, setAnimeList, theme, accentColor, nsfwFilter } = useAppContext(); 

  const allStatuses = ['Watched', 'Will Watch', 'Dropped'];

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(allStatuses[0]); 
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(0);
  const [description, setDescription] = useState(''); 
  const [fetchedGenres, setFetchedGenres] = useState<string[]>([]); // NEW: State to hold genres

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
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
      
      try {
        // NEW: Added 'genres' to the AniList query!
        const query = `
          query ($search: String) {
            Page (page: 1, perPage: 5) {
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

        const response = await fetch('https://graphql.anilist.co', {
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
        
        if (json.data && json.data.Page && json.data.Page.media) {
          const mappedData = json.data.Page.media.map((anime: any) => ({
            mal_id: anime.id,
            title_english: anime.title.english || anime.title.romaji,
            title: anime.title.romaji,
            images: { jpg: { image_url: anime.coverImage.large, large_image_url: anime.coverImage.large } },
            synopsis: anime.description ? anime.description.replace(/<[^>]+>/g, '') : '',
            genres: anime.genres || [] // NEW: Map the fetched genres
          }));
          setSuggestions(mappedData);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.log("Error fetching anime:", error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 600); 

    return () => clearTimeout(delayDebounceFn);
  }, [title, nsfwFilter]); 

  const handleSelectAnime = (selectedAnime: any) => {
    skipSearch.current = true;
    setTitle(selectedAnime.title_english || selectedAnime.title); 
    setImageUri(selectedAnime.images.jpg.large_image_url); 
    setDescription(selectedAnime.synopsis || ''); 
    setFetchedGenres(selectedAnime.genres || []); // NEW: Save the genres when an item is selected
    setShowDropdown(false); 
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

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Hold up!', 'Please enter an anime title.');
      return;
    }
    
    // NEW: Passed the fetchedGenres array into the new AnimeEntry object
    const newAnime = {
      id: Date.now().toString(),
      title,
      status,
      categories: [status], 
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
    setRating(0);
    setComments('');
    setImageUri(null);
    setSeason(1); 
    setEpisode(0); 
    setDescription(''); 
    setFetchedGenres([]); // NEW: Clear genres for the next entry
    setShowDropdown(false);
  };

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const inputBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        
        <View style={styles.imageSection}>
          <TouchableOpacity style={[styles.imageButton, { backgroundColor: inputBg, borderColor }]} onPress={pickImage}>
            <Ionicons name="image-outline" size={24} color={accentColor} />
            <Text style={[styles.imageButtonText, { color: textColor }]}>
              {imageUri ? 'Change Cover Image' : 'Add Cover Image (Optional)'}
            </Text>
          </TouchableOpacity>
          {imageUri && <Image source={{ uri: imageUri }} style={[styles.coverImage, { backgroundColor: inputBg }]} />}
        </View>

        <View style={{ zIndex: 10 }}> 
          <Text style={[styles.label, { color: textColor }]}>Anime Title</Text>
          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor }]}>
            <TextInput 
              style={[styles.inputWithClear, { color: textColor }]} 
              placeholder="e.g., Attack on Titan" 
              placeholderTextColor="#888"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (text.length === 0) {
                  setShowDropdown(false);
                  setSuggestions([]);
                  setFetchedGenres([]); // Clear genres if user clears text manually
                }
              }}
            />
            {title.length > 0 && (
              <TouchableOpacity style={styles.clearIcon} onPress={() => { setTitle(''); setShowDropdown(false); setSuggestions([]); setFetchedGenres([]); }}>
                <Ionicons name="close-circle" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>

          {showDropdown && (
            <View style={[styles.dropdown, { backgroundColor: inputBg, borderColor }]}>
              {isSearching ? (
                <View style={{ padding: 20 }}><ActivityIndicator color={accentColor} /></View>
              ) : suggestions.length > 0 ? (
                suggestions.map((anime) => (
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
                      {/* Optional: Show a preview of the genres in the dropdown itself */}
                      {anime.genres && anime.genres.length > 0 && (
                        <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }} numberOfLines={1}>
                          {anime.genres.join(', ')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={{ padding: 15, alignItems: 'center' }}>
                  <Text style={{ color: '#888', marginBottom: 4 }}>No results found.</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>You can still add it manually!</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <Text style={[styles.label, { color: textColor, marginTop: 20 }]}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
          {allStatuses.map((s) => (
            <TouchableOpacity 
              key={s} 
              style={[
                styles.statusButton, 
                { backgroundColor: inputBg, borderColor }, 
                status === s && { backgroundColor: accentColor, borderColor: accentColor }
              ]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.statusText, status === s && styles.statusTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {status !== 'Will Watch' && (
          <>
            <Text style={[styles.label, { color: textColor }]}>Progress</Text>
            <View style={styles.progressContainer}>
              <View style={[styles.counterCard, { backgroundColor: inputBg, borderColor }]}>
                <Text style={[styles.counterLabel, { color: textColor }]}>Season</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity onPress={() => setSeason(Math.max(1, season - 1))}><Ionicons name="remove-circle" size={32} color="#888" /></TouchableOpacity>
                  <Text style={[styles.counterValue, { color: textColor }]}>{season}</Text>
                  <TouchableOpacity onPress={() => setSeason(season + 1)}><Ionicons name="add-circle" size={32} color={accentColor} /></TouchableOpacity>
                </View>
              </View>

              <View style={[styles.counterCard, { backgroundColor: inputBg, borderColor }]}>
                <Text style={[styles.counterLabel, { color: textColor }]}>Episode</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity onPress={() => setEpisode(Math.max(0, episode - 1))}><Ionicons name="remove-circle" size={32} color="#888" /></TouchableOpacity>
                  <Text style={[styles.counterValue, { color: textColor }]}>{episode}</Text>
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  imageSection: { alignItems: 'center', marginTop: 10, marginBottom: 10 },
  imageButton: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', width: '100%', justifyContent: 'center' },
  imageButtonText: { marginLeft: 8, fontSize: 16, fontWeight: '500' },
  coverImage: { width: 150, height: 200, borderRadius: 8, marginTop: 15 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8 },
  inputWithClear: { flex: 1, padding: 14, fontSize: 16 },
  clearIcon: { paddingHorizontal: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 16 },
  progressContainer: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  counterCard: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 15, alignItems: 'center' },
  counterLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, opacity: 0.8 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterValue: { fontSize: 22, fontWeight: 'bold', width: 30, textAlign: 'center' },
  dropdown: { position: 'absolute', top: 85, left: 0, right: 0, borderWidth: 1, borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  dropdownImage: { width: 40, height: 60, borderRadius: 4, marginRight: 10 },
  dropdownText: { flex: 1, fontSize: 14, fontWeight: 'bold' },
  textArea: { height: 100, textAlignVertical: 'top' },
  statusButton: { paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderRadius: 8, marginRight: 10, alignItems: 'center' },
  statusText: { color: '#888', fontWeight: '600' },
  statusTextActive: { color: '#FFF' },
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