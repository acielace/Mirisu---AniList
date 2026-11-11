import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, Keyboard, Animated, useWindowDimensions, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppContext } from '../context/AppContext';
import { ANILIST_URL, KITSU_ANIME_URL, TRACE_MOE_URL } from '../constants';

// PHASE 2 is wired: ONE TAP on a cover navigates straight to AnimeDetail in
// draft mode. The "Add Manually" button opens a blank draft. The toast on save
// watches the list grow. The header CAMERA button (installed via setOptions,
// no App.tsx changes) reverse-image-searches via trace.moe — the upload goes
// through XHR (RN's legacy networking path), because this RN build's new fetch
// rejects both data: URLs and FormData file parts.

interface AnimeSuggestion {
  mal_id: number | string; // AniList sends numbers, Kitsu sends strings
  title: string;
  title_english: string;
  images: { jpg: { image_url?: string; large_image_url?: string } };
  synopsis: string;
  genres: string[];
  seasonLabel?: string;    // "Winter 2026" — AniList only, absent on Kitsu results
  airStatus?: string;      // "Airing" / "Completed" / "Coming Soon" / ...
}

// One match from trace.moe — a recognized anime scene.
interface TraceMatch {
  anilistId: number;
  title: string;
  episode: number | null;
  similarity: number;      // 0..1
  previewUrl: string | null; // trace.moe's thumbnail of the matched frame
}

// AniList enum → display labels (used for the detail screen's info row).
const SEASON_LABELS: Record<string, string> = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };
const AIR_STATUS_LABELS: Record<string, string> = {
  RELEASING: 'Airing',
  FINISHED: 'Completed',
  NOT_YET_RELEASED: 'Coming Soon',
  CANCELLED: 'Cancelled',
  HIATUS: 'Hiatus',
};

export default function AddScreen() {
  const { theme, accentColor, nsfwFilter, animeList, isDataLoaded } = useAppContext();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();

  // FIXED cover width — the same technique ListScreen's grid uses. Cells must
  // NOT use flex:1 in a numColumns grid, or 1–2 results stretch to fill the row.
  const cardWidth = (width - 50) / 3;

  const [title, setTitle] = useState('');
  const [suggestions, setSuggestions] = useState<AnimeSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // --- Reverse image search (trace.moe) state ---
  const [imageSearchVisible, setImageSearchVisible] = useState(false);
  const [imageMatches, setImageMatches] = useState<TraceMatch[]>([]);
  const [isTracing, setIsTracing] = useState(false);
  const [traceFailed, setTraceFailed] = useState(false);
  const [traceError, setTraceError] = useState('');
  const lastImageUri = useRef<string | null>(null);

  // --- Toast (on save) — same machinery as the old AddScreen ---
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-50)).current;

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

  // The list growing = something was saved from the detail screen's add mode.
  const prevListLength = useRef<number | null>(null);
  useEffect(() => {
    if (!isDataLoaded) return;
    if (prevListLength.current !== null && animeList.length > prevListLength.current) {
      showToast(`Saved ${animeList[animeList.length - 1].title} to your list!`);
    }
    prevListLength.current = animeList.length;
  }, [animeList, isDataLoaded]);

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const inputBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  // --- REVERSE IMAGE SEARCH (trace.moe) ---

  const promptImageSource = () => {
    Alert.alert(
      'Search by Image',
      'Find an anime with a screenshot or photo?',
      [
        { text: 'Take Photo', onPress: () => pickSearchImage(true) },
        { text: 'Choose from Gallery', onPress: () => pickSearchImage(false) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // No crop/edit step — the image goes to trace.moe exactly as taken or picked.
  const pickSearchImage = async (useCamera: boolean) => {
    // Camera permission is requested automatically by expo-image-picker.
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });

    if (!result.canceled && result.assets && result.assets[0]?.uri) {
      setImageMatches([]);
      setImageSearchVisible(true);
      runTraceSearch(result.assets[0].uri);
    }
  };

  // The upload, two transports, ordered by how much WE control:
  //   1. XHR + FormData — routes through RN's LEGACY networking module (the
  //      decade-old file-upload path), NOT the new fetch stack that rejected
  //      FormData file parts. We pick the field name: 'image', matching what
  //      trace.moe's own web uploader sends.
  //   2. expo-file-system's NATIVE multipart upload — pure OkHttp, no JS
  //      networking at all. (The native module picks the field name itself.)
  const traceSearch = async (imageUri: string): Promise<any> => {
    const isPng = imageUri.toLowerCase().includes('.png');
    const mimeType = isPng ? 'image/png' : 'image/jpeg';
    const fileName = isPng ? 'search.png' : 'search.jpg';
    const url = `${TRACE_MOE_URL}?anilistInfo&cutBorders`;

    // Transport 1: XHR + FormData through the legacy networking module.
    try {
      return await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.timeout = 25000;
        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (xhr.status < 200 || xhr.status >= 300 || parsed?.error) {
              reject(new Error(parsed?.error || `HTTP ${xhr.status}`));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error(`HTTP ${xhr.status}: non-JSON response`));
          }
        };
        xhr.onerror = () => reject(new Error('network error'));
        xhr.ontimeout = () => reject(new Error('timed out after 25s'));

        const formData = new FormData();
        formData.append('image', { uri: imageUri, name: fileName, type: mimeType } as any);
        xhr.send(formData);
      });
    } catch (xhrError: any) {
      // Transport 2: native multipart upload — no fetch, no XHR, just OkHttp.
      try {
        const result = await FileSystem.uploadAsync(url, imageUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        });
        const json = JSON.parse(result.body);
        if (result.status < 200 || result.status >= 300 || json?.error) {
          throw new Error(json?.error || `HTTP ${result.status}`);
        }
        return json;
      } catch (nativeError: any) {
        throw new Error(`xhr upload failed: ${xhrError?.message ?? xhrError} | native upload failed: ${nativeError?.message ?? nativeError}`);
      }
    }
  };

  const runTraceSearch = async (imageUri: string) => {
    lastImageUri.current = imageUri;
    setIsTracing(true);
    setTraceFailed(false);
    setTraceError('');
    try {
      const json = await traceSearch(imageUri);

      const raw: any[] = Array.isArray(json.result) ? json.result : [];
      const matches: TraceMatch[] = raw
        .filter((r: any) => !(nsfwFilter && r.anilist?.isAdult))
        .sort((a: any, b: any) => (b.similarity ?? 0) - (a.similarity ?? 0))
        .slice(0, 5)
        .map((r: any) => {
          const ep = r.episode;
          const episodeNum = typeof ep === 'number' ? ep : (typeof ep === 'string' && ep ? parseInt(ep, 10) : NaN);
          return {
            anilistId: r.anilist?.id ?? 0,
            title: r.anilist?.title?.english || r.anilist?.title?.romaji || 'Unknown',
            episode: isNaN(episodeNum) ? null : episodeNum,
            similarity: r.similarity ?? 0,
            previewUrl: r.image ?? null,
          };
        });
      setImageMatches(matches);
    } catch (error: any) {
      console.log('trace.moe search error:', error);
      setTraceError(String(error?.message ?? error));
      setTraceFailed(true);
    } finally {
      setIsTracing(false);
    }
  };

  // Fetch full AniList data for the match, then open the add screen — the same
  // draft path as tapping a grid cover.
  const selectImageMatch = async (match: TraceMatch) => {
    if (match.anilistId === 0) {
      setImageSearchVisible(false);
      Keyboard.dismiss();
      navigation.navigate('AnimeDetail', { draft: { title: match.title, imageUri: null, description: '', genres: [] } });
      return;
    }
    setIsTracing(true);
    try {
      const query = `
        query ($id: Int) {
          Page (page: 1, perPage: 1) {
            media (id: $id, type: ANIME) {
              id
              title { romaji english }
              coverImage { large }
              description(asHtml: false)
              genres
              season
              seasonYear
              status
            }
          }
        }
      `;
      const response = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { id: match.anilistId } }),
      });
      const json = await response.json();
      const anime = json.data?.Page?.media?.[0];
      if (json.errors || !anime) throw new Error('AniList lookup failed');

      const suggestion: AnimeSuggestion = {
        mal_id: anime.id,
        title_english: anime.title.english || anime.title.romaji,
        title: anime.title.romaji,
        images: { jpg: { image_url: anime.coverImage.large, large_image_url: anime.coverImage.large } },
        synopsis: anime.description ? anime.description.replace(/<[^>]+>/g, '') : '',
        genres: anime.genres || [],
        seasonLabel: [SEASON_LABELS[anime.season], anime.seasonYear].filter(Boolean).join(' ') || undefined,
        airStatus: AIR_STATUS_LABELS[anime.status],
      };
      setImageSearchVisible(false);
      setIsTracing(false);
      Keyboard.dismiss();
      navigation.navigate('AnimeDetail', { draft: buildDraft(suggestion) });
    } catch (error) {
      console.log('AniList image-match lookup error:', error);
      // Title is all we reliably have — open the draft anyway, don't strand the user.
      setImageSearchVisible(false);
      setIsTracing(false);
      Keyboard.dismiss();
      navigation.navigate('AnimeDetail', { draft: { title: match.title, imageUri: null, description: '', genres: [] } });
    }
  };

  // Install the camera button in THIS tab's header — setOptions from the screen
  // itself, so App.tsx needs no changes. Re-registered on theme/nsfw changes.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={promptImageSource} style={styles.cameraButton}>
          <Ionicons name="camera-outline" size={24} color={textColor} />
        </TouchableOpacity>
      ),
    });
  }, [textColor, nsfwFilter]);

  useEffect(() => {
    const q = title.trim();
    // 1–2 characters: still mid-word — leave the grid alone (same <3 rule as before)
    if (q.length > 0 && q.length < 3) return;

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);

      // Default grid: recent releases — newest by start date (airing or finished).
      const fetchRecentFromAniList = async (): Promise<{ ok: boolean; data: any[] }> => {
        try {
          const query = `
            query {
              Page (page: 1, perPage: 30) {
                media (type: ANIME, sort: START_DATE_DESC, status_in: [RELEASING, FINISHED]${nsfwFilter ? ', isAdult: false' : ''}) {
                  id
                  title { romaji english }
                  coverImage { large }
                  description(asHtml: false)
                  genres
                  season
                  seasonYear
                  status
                }
              }
            }
          `;
          const response = await fetch(ANILIST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query })
          });
          const json = await response.json();
          if (json.errors) {
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
              genres: anime.genres || [],
              seasonLabel: [SEASON_LABELS[anime.season], anime.seasonYear].filter(Boolean).join(' ') || undefined,
              airStatus: AIR_STATUS_LABELS[anime.status]
            }));
            return { ok: true, data: mappedData };
          }
          return { ok: false, data: [] };
        } catch (error) {
          console.log("AniList network error:", error);
          return { ok: false, data: [] };
        }
      };

      // Primary search source. ok:false means AniList itself failed — the only
      // condition that triggers the Kitsu fallback below.
      const fetchFromAniList = async (): Promise<{ ok: boolean; data: any[] }> => {
        try {
          const query = `
            query ($search: String) {
              Page (page: 1, perPage: 30) {
                media (search: $search, type: ANIME${nsfwFilter ? ', isAdult: false' : ''}) {
                  id
                  title { romaji english }
                  coverImage { large }
                  description(asHtml: false)
                  genres
                  season
                  seasonYear
                  status
                }
              }
            }
          `;
          const response = await fetch(ANILIST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { search: title.trim() } })
          });
          const json = await response.json();
          if (json.errors) {
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
              genres: anime.genres || [],
              seasonLabel: [SEASON_LABELS[anime.season], anime.seasonYear].filter(Boolean).join(' ') || undefined,
              airStatus: AIR_STATUS_LABELS[anime.status]
            }));
            return { ok: true, data: mappedData };
          }
          return { ok: false, data: [] };
        } catch (error) {
          console.log("AniList network error:", error);
          return { ok: false, data: [] };
        }
      };

      // Fallback source, only ever called when AniList itself failed.
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

      const aniListResult = q.length === 0
        ? await fetchRecentFromAniList()
        : await fetchFromAniList();

      if (aniListResult.ok) {
        setSuggestions(aniListResult.data);
        setApiUnavailable(false);
      } else if (q.length === 0) {
        setSuggestions([]);
        setApiUnavailable(true);
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

  // --- The doors into AnimeDetail's add mode ---
  const buildDraft = (anime: AnimeSuggestion) => ({
    title: anime.title_english || anime.title,
    imageUri: anime.images.jpg.large_image_url || anime.images.jpg.image_url || null,
    description: anime.synopsis || '',
    genres: anime.genres || [],
    seasonLabel: anime.seasonLabel,
    airStatus: anime.airStatus,
  });

  // ONE TOUCH: a single tap opens the add screen with that anime's data.
  const handleCoverPress = (anime: AnimeSuggestion) => {
    Keyboard.dismiss();
    navigation.navigate('AnimeDetail', { draft: buildDraft(anime) });
  };

  // Manual add: blank draft, title pre-filled with the current search text.
  const handleCustomAdd = () => {
    Keyboard.dismiss();
    navigation.navigate('AnimeDetail', {
      draft: { title: title.trim(), imageUri: null, description: '', genres: [] },
    });
  };

  // One definition, used in both empty states below.
  const renderCustomAddButton = () => (
    <TouchableOpacity style={[styles.customAddButton, { borderColor: accentColor }]} onPress={handleCustomAdd}>
      <Ionicons name="add-circle-outline" size={20} color={accentColor} />
      <Text style={[styles.customAddText, { color: accentColor }]}>
        {title.trim() ? `Add "${title.trim()}" Manually` : 'Add Anime Manually'}
      </Text>
    </TouchableOpacity>
  );

  const isIdle = title.trim().length < 3;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>

      {/* SEARCH BAR — pinned at top; keyboard can never cover it, so no KAV needed */}
      <View style={styles.searchSection}>
        <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor }]}>
          {isSearching ? (
            <ActivityIndicator size="small" color={accentColor} style={styles.searchIcon} />
          ) : (
            <Ionicons name="search-outline" size={18} color="#888" style={styles.searchIcon} />
          )}
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Search anime..."
            placeholderTextColor="#888"
            value={title}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            onChangeText={setTitle}
          />
          {title.length > 0 && (
            <TouchableOpacity style={styles.clearIcon} onPress={() => setTitle('')}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* COVER GRID */}
      <FlatList
        data={suggestions}
        numColumns={3}
        keyExtractor={(anime) => String(anime.mal_id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.grid}
        ListHeaderComponent={
          <Text style={[styles.gridLabel, { color: '#888' }]}>
            {isIdle ? 'Recent Releases' : `Results for "${title.trim()}"`}
          </Text>
        }
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={accentColor} />
            </View>
          ) : apiUnavailable ? (
            <View style={styles.centerState}>
              <Ionicons name="cloud-offline-outline" size={28} color="#888" style={{ marginBottom: 8 }} />
              <Text style={styles.stateText}>Anime search is temporarily unavailable.</Text>
              <Text style={[styles.stateText, { fontSize: 12, marginBottom: 12 }]}>Try again in a bit, or add it manually.</Text>
              <TouchableOpacity
                onPress={() => setRetryCount(c => c + 1)}
                style={[styles.retryButton, { borderColor: accentColor }]}
              >
                <Ionicons name="refresh" size={14} color={accentColor} style={{ marginRight: 6 }} />
                <Text style={{ color: accentColor, fontSize: 13, fontWeight: 'bold' }}>Retry</Text>
              </TouchableOpacity>
              {renderCustomAddButton()}
            </View>
          ) : (
            <View style={styles.centerState}>
              <Text style={styles.stateText}>No results found.</Text>
              <Text style={[styles.stateText, { fontSize: 12 }]}>Not showing up? Add it yourself.</Text>
              {renderCustomAddButton()}
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85} style={[styles.cell, { width: cardWidth }]} onPress={() => handleCoverPress(item)}>
            <View style={[styles.coverWrap, { backgroundColor: inputBg }]}>
              <Image
                source={{ uri: item.images.jpg.large_image_url || item.images.jpg.image_url }}
                style={styles.cover}
              />
              <View style={styles.titleBar}>
                <Text style={styles.coverTitle} numberOfLines={2}>
                  {item.title_english || item.title}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* --- Image Matches Modal (reverse image search) --- */}
      <Modal visible={imageSearchVisible} animationType="slide" transparent={false} onRequestClose={() => setImageSearchVisible(false)}>
        <SafeAreaView style={[styles.imageModal, { backgroundColor: bgColor }]}>
          <View style={[styles.imageModalHeader, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={() => setImageSearchVisible(false)} style={{ padding: 5 }}>
              <Ionicons name="close" size={28} color={textColor} />
            </TouchableOpacity>
            <Text style={[styles.imageModalTitle, { color: textColor }]}>Image Matches</Text>
            <View style={{ width: 28 }} />
          </View>

          {isTracing ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={accentColor} />
              <Text style={[styles.stateText, { marginTop: 12 }]}>Searching the scene...</Text>
            </View>
          ) : traceFailed ? (
            <View style={styles.centerState}>
              <Ionicons name="cloud-offline-outline" size={28} color="#888" style={{ marginBottom: 8 }} />
              <Text style={styles.stateText}>Couldn't search this image.</Text>
              {traceError ? (
                // The REAL error, selectable so it can be copied and pasted.
                <Text selectable style={[styles.stateText, { fontSize: 11, marginBottom: 12, paddingHorizontal: 20 }]}>
                  {traceError}
                </Text>
              ) : (
                <Text style={[styles.stateText, { fontSize: 12, marginBottom: 12 }]}>Check your connection and try again.</Text>
              )}
              <TouchableOpacity
                onPress={() => { if (lastImageUri.current) runTraceSearch(lastImageUri.current); }}
                style={[styles.retryButton, { borderColor: accentColor }]}
              >
                <Ionicons name="refresh" size={14} color={accentColor} style={{ marginRight: 6 }} />
                <Text style={{ color: accentColor, fontSize: 13, fontWeight: 'bold' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : imageMatches.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="help-circle-outline" size={40} color="#888" />
              <Text style={[styles.stateText, { marginTop: 10 }]}>Couldn't identify this image.</Text>
              <Text style={[styles.stateText, { fontSize: 12 }]}>Works best on a clear screenshot of an actual anime scene.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 15 }}>
              {imageMatches.map((match: TraceMatch, idx: number) => (
                <TouchableOpacity
                  key={`${match.anilistId}-${idx}`}
                  style={[styles.matchRow, { backgroundColor: inputBg, borderColor }]}
                  onPress={() => selectImageMatch(match)}
                >
                  {match.previewUrl ? (
                    <Image source={{ uri: match.previewUrl }} style={styles.matchPreview} />
                  ) : (
                    <View style={[styles.matchPreview, { backgroundColor: borderColor, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="image-outline" size={22} color="#888" />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.matchTitle, { color: textColor }]} numberOfLines={1}>{match.title}</Text>
                    <Text style={styles.matchSub}>
                      {match.episode !== null ? `Episode ${match.episode}  •  ` : ''}{Math.round(match.similarity * 100)}% match
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#888" />
                </TouchableOpacity>
              ))}
              <Text style={styles.traceCredit}>Scene recognition by trace.moe</Text>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

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
  searchSection: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10 },
  searchIcon: { paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16 },
  clearIcon: { paddingHorizontal: 12 },
  grid: { paddingHorizontal: 10, paddingBottom: 30 },
  gridLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 5, marginBottom: 4 },
  cell: { margin: 5 },
  coverWrap: { borderRadius: 8, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 2 / 3 },
  titleBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 6, paddingVertical: 5 },
  coverTitle: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 13 },
  centerState: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  stateText: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 4 },
  retryButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  customAddButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', padding: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 16 },
  customAddText: { marginLeft: 8, fontSize: 14, fontWeight: '600' },

  // Header camera button (installed via setOptions)
  cameraButton: { paddingHorizontal: 10, paddingVertical: 4, marginRight: 20 },

  // Image matches modal
  imageModal: { flex: 1 },
  imageModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1 },
  imageModalTitle: { fontSize: 18, fontWeight: 'bold' },
  matchRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  matchPreview: { width: 96, height: 54, borderRadius: 6 },
  matchTitle: { fontSize: 15, fontWeight: 'bold' },
  matchSub: { fontSize: 12, color: '#888', marginTop: 3 },
  traceCredit: { color: '#888', fontSize: 11, textAlign: 'center', marginTop: 8 },

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
});