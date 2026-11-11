import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image, KeyboardAvoidingView, Platform, Animated, Dimensions, Keyboard, BackHandler, Easing, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAppContext } from '../context/AppContext';

// Detail screen as a transparentModal: the navigator does NO animating
// (animation: 'none') and this root is fully transparent, so pushing/popping
// is visually a no-op — all motion is the sheet's own slide. Three doors:
//   { animeId }  → edit a saved entry (mutators write to context, live)
//   { draft }    → ADD mode: API data from AddScreen's grid, or a blank
//                  draft from the "Add Manually" button. Nothing is saved
//                  until the Save button — drafts live in local state.

// Layout knobs — tune these together:
const HERO_HEIGHT = 400;  // cover art height
const FADE_HEIGHT = 160;  // how much of the cover's bottom fades out
const OVERLAP = 120;      // how far the title block rides up into the fade
const SCRIM_STRENGTH = 0.45; // how dark the readability wash gets at the bottom
const SLIDE_DURATION = 300; // matches the old Modal slide speed

interface DraftAnime {
  title: string;
  imageUri: string | null;
  description: string;
  genres: string[];
  seasonLabel?: string;  // "Winter 2026" — absent for Kitsu/manual drafts
  airStatus?: string;    // "Airing" / "Completed" / "Coming Soon" / ...
}

// Normalized shape the whole render works against. Deliberately NOT `any` —
// a typed view object is what gives every callback below its contextual types.
interface DetailAnime {
  id: string;
  title: string;
  status: string;
  categories: string[];
  rating: number;
  season: number;
  episode: number;
  comments: string;
  imageUri: string | null;
  description: string;
  genres: string[];
  seasonLabel?: string;
  airStatus?: string;
}

export default function AnimeDetailScreen() {
  const { theme, accentColor, customCategories, animeList, setAnimeList } = useAppContext();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const animeId: string | undefined = route.params?.animeId;
  const draft: DraftAnime | undefined = route.params?.draft;
  const isDraft = !!draft;

  // Existing entry (edit mode). Undefined in draft mode.
  const savedEntry = isDraft ? undefined : animeList.find(a => a.id === animeId);

  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [tempComment, setTempComment] = useState('');

  // --- Draft-mode state (add flow). Nothing here touches animeList. ---
  const [draftTitle, setDraftTitle] = useState<string>(draft?.title || '');
  const [draftStatus, setDraftStatus] = useState<string>('Will Watch');
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [draftRating, setDraftRating] = useState<number>(0);
  const [draftSeason, setDraftSeason] = useState<number>(1);
  const [draftEpisode, setDraftEpisode] = useState<number>(0);
  const [draftImageUri, setDraftImageUri] = useState<string | null>(draft?.imageUri ?? null);

  // Starts off-screen so the first frame never flashes the sheet in place.
  const slideY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const isClosing = useRef(false);

  useEffect(() => {
    setIsSynopsisExpanded(false);
    setIsEditingComment(false);
    setTempComment(savedEntry?.comments || '');
  }, [animeId]);

  // Unified view object: draft mode = virtual entry rebuilt from draft state
  // every render; edit mode = the saved entry with optional fields normalized.
  const viewAnime: DetailAnime | undefined = isDraft
    ? {
        id: 'draft', // never matches a real id — drafts are not in the list
        title: draftTitle,
        imageUri: draftImageUri,
        description: draft?.description || '',
        genres: draft?.genres || [],
        seasonLabel: draft?.seasonLabel,
        airStatus: draft?.airStatus,
        status: draftStatus,
        categories: [draftStatus, ...draftCategories],
        rating: draftStatus === 'Will Watch' ? 0 : draftRating,
        season: draftStatus === 'Will Watch' ? 1 : draftSeason,
        episode: draftStatus === 'Will Watch' ? 0 : draftEpisode,
        comments: draftStatus === 'Will Watch' ? '' : tempComment,
      }
    : savedEntry
    ? {
        id: savedEntry.id,
        title: savedEntry.title,
        status: savedEntry.status,
        categories: savedEntry.categories || [savedEntry.status],
        rating: savedEntry.rating || 0,
        season: savedEntry.season || 1,
        episode: savedEntry.episode || 0,
        comments: savedEntry.comments || '',
        imageUri: savedEntry.imageUri ?? null,
        description: savedEntry.description || '',
        genres: savedEntry.genres || [],
        // Present on entries saved since the labels update; AnimeEntry predates
        // these fields, hence the cast. Older entries just show no labels.
        seasonLabel: (savedEntry as any).seasonLabel,
        airStatus: (savedEntry as any).airStatus,
      }
    : undefined;

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const cardBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  const bgRgb = theme === 'Dark' ? 'rgba(0,0,0,' : 'rgba(248,249,250,';

  // --- Mutators: edit mode writes to context; draft mode writes to local state ---
  const toggleCategory = (cat: string) => {
    if (isDraft) {
      setDraftCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
      return;
    }
    if (!viewAnime) return;
    const currentCats = viewAnime.categories;
    let newCats;
    if (currentCats.includes(cat)) { newCats = currentCats.filter(c => c !== cat); } 
    else { newCats = [...currentCats, cat]; }
    if (!newCats.includes(viewAnime.status)) { newCats.push(viewAnime.status); }
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? { ...a, categories: newCats } : a));
  };

  const updateProgress = (type: 'season' | 'episode', amount: number) => {
    if (isDraft) {
      if (type === 'season') setDraftSeason(s => Math.max(1, s + amount));
      else setDraftEpisode(e => Math.max(0, e + amount));
      return;
    }
    if (!viewAnime) return;
    const newValue = Math.max(type === 'season' ? 1 : 0, (viewAnime[type] || 0) + amount);
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? { ...a, [type]: newValue } : a));
  };

  const setExactProgress = (type: 'season' | 'episode', value: number) => {
    if (isDraft) {
      if (type === 'season') setDraftSeason(value);
      else setDraftEpisode(value);
      return;
    }
    if (!viewAnime) return;
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? { ...a, [type]: value } : a));
  };

  const updateRating = (newRating: number) => {
    if (isDraft) { setDraftRating(newRating); return; }
    if (!viewAnime) return;
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? { ...a, rating: newRating } : a));
  };

  const saveComment = () => {
    // In draft mode tempComment IS the comment — nothing to persist yet.
    if (isDraft) { setIsEditingComment(false); return; }
    if (!viewAnime) return;
    setAnimeList(animeList.map(a => a.id === viewAnime.id ? { ...a, comments: tempComment } : a));
    setIsEditingComment(false);
  };

  // Custom cover for drafts — same picker settings as the old AddScreen.
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled) setDraftImageUri(result.assets[0].uri);
  };

  // Slide the sheet down, THEN pop — by the time goBack() runs, the screen is
  // already invisible, so the instant 'none' pop has nothing to show.
  const handleClose = () => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    Animated.timing(slideY, {
      toValue: Dimensions.get('window').height,
      duration: SLIDE_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => navigation.goBack());
  };

  // --- Save (draft mode only) — kept from the old AddScreen ---
  const performSave = () => {
    const finalTitle = draftTitle.trim();

    const newAnime = {
      id: Date.now().toString(),
      title: finalTitle,
      status: draftStatus,
      categories: [draftStatus, ...draftCategories],
      // Will Watch entries get their rating/progress/review zeroed, same as before.
      rating: draftStatus === 'Will Watch' ? 0 : draftRating,
      comments: draftStatus === 'Will Watch' ? '' : tempComment,
      imageUri: draftImageUri,
      season: draftStatus === 'Will Watch' ? 1 : draftSeason,
      episode: draftStatus === 'Will Watch' ? 0 : draftEpisode,
      description: draft?.description || '',
      genres: draft?.genres || [],
      // AniList metadata for the info row (undefined for Kitsu/manual drafts)
      seasonLabel: draft?.seasonLabel,
      airStatus: draft?.airStatus,
    };

    setAnimeList([...animeList, newAnime]);
    handleClose(); // slide back down to the Add screen
  };

  const handleSave = () => {
    if (!draftTitle.trim()) {
      Alert.alert('Hold up!', 'Please enter an anime title.');
      return;
    }

    // Exact-match check only (trimmed, case-insensitive) — deliberately not fuzzy,
    // so "Naruto" and "Naruto Shippuden" are different entries, not duplicates.
    const isDuplicate = animeList.some(
      a => a.title.trim().toLowerCase() === draftTitle.trim().toLowerCase()
    );

    if (isDuplicate) {
      Alert.alert(
        'Already in Your List',
        `"${draftTitle.trim()}" appears to already be on your list. Do you want to add it anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: performSave },
        ]
      );
      return;
    }

    performSave();
  };

  // Slide up on mount — every push is a fresh mount, so this covers every open.
  useEffect(() => {
    Animated.timing(slideY, {
      toValue: 0,
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  // Hardware back runs the same animated close instead of an instant pop.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    // Transparent root: the screen below (list OR add grid) shows through
    // everywhere the sheet isn't.
    <View style={{ flex: 1 }} pointerEvents="box-none">

      <Animated.View style={{ flex: 1, backgroundColor: bgColor, transform: [{ translateY: slideY }] }}>

        <TouchableOpacity onPress={handleClose} style={[styles.backButton, { top: insets.top + 8 }]}>
          <Ionicons name="chevron-down" size={26} color="#fff" />
        </TouchableOpacity>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

          {viewAnime ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

              {/* HERO — in add mode, tapping the art swaps it for a gallery pick */}
              <View style={{ height: HERO_HEIGHT }}>
                {isDraft ? (
                  <TouchableOpacity activeOpacity={0.85} style={{ flex: 1 }} onPress={pickImage}>
                    {viewAnime.imageUri ? (
                      <Image source={{ uri: viewAnime.imageUri }} style={styles.heroImage} />
                    ) : (
                      <View style={[styles.heroPlaceholder, { backgroundColor: cardBg }]}>
                        <Ionicons name="image-outline" size={60} color="#888" />
                        <Text style={{ color: '#888', marginTop: 10, fontSize: 13 }}>Tap to add a cover</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : viewAnime.imageUri ? (
                  <Image source={{ uri: viewAnime.imageUri }} style={styles.heroImage} />
                ) : (
                  <View style={[styles.heroPlaceholder, { backgroundColor: cardBg }]}>
                    <Ionicons name="image-outline" size={60} color="#888" />
                  </View>
                )}
                <LinearGradient
                  pointerEvents="none"
                  colors={[`${bgRgb}0)`, `${bgRgb}${SCRIM_STRENGTH})`]}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={[`${bgRgb}0)`, `${bgRgb}1)`]}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: FADE_HEIGHT }}
                />
              </View>

              {/* Title / genres / rating ride up into the fade */}
              <View style={{ marginTop: -OVERLAP, paddingHorizontal: 20 }}>

                {isDraft ? (
                  <TextInput
                    style={[styles.modalTitle, styles.draftTitleInput, { color: textColor }]}
                    value={draftTitle}
                    onChangeText={setDraftTitle}
                    multiline
                    placeholder="Anime title"
                    placeholderTextColor="#888"
                  />
                ) : (
                  <Text style={[styles.modalTitle, { color: textColor }]}>{viewAnime?.title}</Text>
                )}

                {viewAnime?.genres && viewAnime.genres.length > 0 && (
                  <View style={styles.genreRow}>
                    {viewAnime.genres.map((genre, idx) => (
                      <View key={idx} style={[styles.modalGenrePill, { borderColor: accentColor, backgroundColor: cardBg }]}>
                        <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Season + air status — e.g. "Winter 2026 • Airing" */}
                {viewAnime.seasonLabel || viewAnime.airStatus ? (
                  <View style={styles.infoRow}>
                    {viewAnime.seasonLabel ? (
                      <Text style={[styles.infoText, { color: '#888' }]}>{viewAnime.seasonLabel}</Text>
                    ) : null}
                    {viewAnime.seasonLabel && viewAnime.airStatus ? (
                      <Text style={[styles.infoText, { color: '#888' }]}>•</Text>
                    ) : null}
                    {viewAnime.airStatus ? (
                      <Text style={[styles.infoText, { color: accentColor, fontWeight: '700' }]}>{viewAnime.airStatus}</Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Status selector — add mode only */}
                {isDraft && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.modalSectionTitle, { color: textColor, marginTop: 0 }]}>Status</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {['Watched', 'Will Watch', 'Dropped'].map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.statusButton, { backgroundColor: cardBg, borderColor }, draftStatus === s && { backgroundColor: accentColor, borderColor: accentColor }]}
                          onPress={() => setDraftStatus(s)}
                        >
                          <Text style={[styles.statusText, { color: draftStatus === s ? '#fff' : textColor }]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
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
                        placeholder="What did you think about it?" 
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

                {/* Save — add mode only */}
                {isDraft && (
                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: accentColor }]} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save to List</Text>
                  </TouchableOpacity>
                )}

              </View>
            </ScrollView>
          ) : (
            <View style={[styles.notFound, { paddingTop: insets.top + 40 }]}>
              <Ionicons name="alert-circle-outline" size={50} color="#888" />
              <Text style={styles.notFoundText}>This entry could not be found — it may have been deleted.</Text>
              <TouchableOpacity style={[styles.notFoundButton, { borderColor: accentColor }]} onPress={handleClose}>
                <Text style={{ color: accentColor, fontWeight: 'bold' }}>Go Back</Text>
              </TouchableOpacity>
            </View>
          )}

        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: { position: 'absolute', left: 15, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },

  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  modalTitle: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  draftTitleInput: { padding: 0, width: '100%' },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 15 },
  infoText: { fontSize: 13, fontWeight: '600' },
  modalGenrePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginHorizontal: 4, marginBottom: 8 },
  modalStars: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 25 },

  statusButton: { paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderRadius: 8, marginRight: 10, alignItems: 'center' },
  statusText: { fontWeight: '600' },

  modalSectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  modalProgressContainer: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  modalProgressBox: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  modalProgressControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  modalProgressValue: { fontSize: 20, fontWeight: 'bold', minWidth: 50, textAlign: 'center' },
  tagScroll: { marginBottom: 25 },
  tagPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginRight: 10 },
  tagText: { fontWeight: 'bold', fontSize: 14 },
  reviewBox: { padding: 15, borderRadius: 12, borderWidth: 1, minHeight: 100 },
  input: { borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top', marginBottom: 20 },

  saveButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 50 },
  saveButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  notFoundText: { color: '#888', fontSize: 16, marginTop: 15, textAlign: 'center', lineHeight: 22 },
  notFoundButton: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1 },
});