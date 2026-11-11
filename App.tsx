import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Animated, Platform } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

import ListScreen from './src/screens/ListScreen';
import AddScreen from './src/screens/AddScreen';
import RecentScreen from './src/screens/RecentScreen';
import AnimeDetailScreen from './src/screens/AnimeDetailScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EditCategoriesScreen from './src/subscreens/EditCategoriesScreen';
import MoreScreen from './src/subscreens/MoreScreen';
import DataStorageScreen from './src/subscreens/DataStorageScreen';
import SettingsScreen from './src/subscreens/SettingsScreen';
import AboutScreen from './src/subscreens/AboutScreen';

import ErrorBoundary from './src/components/ErrorBoundary';
import ReleaseCalendar from './src/components/ReleaseCalendar';
import { AppProvider, useAppContext } from './src/context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAccessFramework } from 'expo-file-system/legacy';

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const {
    theme, themePref, setThemePref, accentColor,
    sortBy, setSortBy, isAscending, setIsAscending,
    displayMode, setDisplayMode, isSearchActive, setIsSearchActive,
    selectedGenres, setSelectedGenres, animeList,
    isListEditMode, setIsListEditMode
  } = useAppContext();

  const navigation = useNavigation<any>();

  const [filterVisible, setFilterVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const bgColor    = theme === 'Dark' ? '#000'     : '#fff';
  const textColor  = theme === 'Dark' ? '#fff'     : '#000';
  const cardColor  = theme === 'Dark' ? '#1A1A1A'  : '#f0f0f0';
  const borderColor = theme === 'Dark' ? '#333'    : '#ddd';

  const filterAnim = useRef(new Animated.Value(800)).current;

  const openSheet = (setVis: Function, animValue: Animated.Value) => {
    setVis(true);
    Animated.timing(animValue, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeSheet = (setVis: Function, animValue: Animated.Value) => {
    Animated.timing(animValue, { toValue: 800, duration: 250, useNativeDriver: true }).start(() => setVis(false));
  };

  const availableGenres = Array.from(new Set(animeList.flatMap(a => a.genres || []))).sort();

  return (
    <>
      {/* FILTER SHEET */}
      <Modal animationType="fade" transparent={true} visible={filterVisible} onRequestClose={() => closeSheet(setFilterVisible, filterAnim)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => closeSheet(setFilterVisible, filterAnim)}>
          <Animated.View onStartShouldSetResponder={() => true} style={[styles.sheetContent, { backgroundColor: cardColor, borderColor, transform: [{ translateY: filterAnim }] }]}>
            <View style={styles.dragIndicator} />
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={[styles.sectionTitle, { color: textColor }]}>Sort</Text>
              <View style={styles.row}>
                {['Alphabetically', 'Stars', 'Date Added'].map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.optionButton, styles.sortButton, sortBy === item && { backgroundColor: accentColor, borderColor: accentColor }]}
                    onPress={() => sortBy === item ? setIsAscending(!isAscending) : setSortBy(item)}
                  >
                    <Text style={[styles.optionText, sortBy === item ? { color: '#fff' } : { color: textColor }]}>{item}</Text>
                    {sortBy === item && <Ionicons name={isAscending ? "arrow-up" : "arrow-down"} size={14} color="#fff" style={{ marginLeft: 5 }} />}
                  </TouchableOpacity>
                ))}
              </View>

              {availableGenres.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Filter by Genre</Text>
                  <View style={styles.row}>
                    {availableGenres.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <TouchableOpacity
                          key={genre}
                          style={[styles.optionButton, isSelected && { backgroundColor: accentColor, borderColor: accentColor }]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedGenres(selectedGenres.filter(g => g !== genre));
                            } else {
                              setSelectedGenres([...selectedGenres, genre]);
                            }
                          }}
                        >
                          <Text style={[styles.optionText, isSelected ? { color: '#fff' } : { color: textColor }]}>{genre}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.sectionTitle, { color: textColor }]}>Display</Text>
              <View style={styles.row}>
                {['List', 'Compact Grid', 'Text Only'].map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.optionButton, displayMode === item && { backgroundColor: accentColor, borderColor: accentColor }]}
                    onPress={() => setDisplayMode(item as 'List' | 'Compact Grid' | 'Text Only')}
                  >
                    <Text style={[styles.optionText, displayMode === item ? { color: '#fff' } : { color: textColor }]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { color: textColor }]}>Theme</Text>
              <View style={styles.row}>
                {(['System', 'Dark', 'Light'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.optionButton, themePref === t && { backgroundColor: accentColor, borderColor: accentColor }]}
                    onPress={() => setThemePref(t)}
                  >
                    <Text style={[styles.optionText, themePref === t ? { color: '#fff' } : { color: textColor }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* THREE DOTS MENU */}
      <Modal animationType="fade" transparent={true} visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlayFade} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuPopup, { backgroundColor: cardColor, borderColor }]}>

            {/* NEW EDIT LIST BUTTON */}
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setIsListEditMode(!isListEditMode); }}>
              <Ionicons name="checkbox-outline" size={20} color={textColor} />
              <Text style={[styles.menuItemText, { color: textColor }]}>{isListEditMode ? 'Exit Edit Mode' : 'Edit List'}</Text>
            </TouchableOpacity>

            {/* These two navigate through 'Tabs' because this menu sits ABOVE the
                Tab.Navigator — its navigation object is the root STACK's, and a
                bare-name navigate only searches upward, never into nested
                navigators. Don't "simplify" these back to navigate('More'). */}
            <TouchableOpacity style={[styles.menuItem, { marginTop: 15 }]} onPress={() => { setMenuVisible(false); navigation.navigate('Tabs', { screen: 'More' }); }}>
              <Ionicons name="grid-outline" size={20} color={textColor} />
              <Text style={[styles.menuItemText, { color: textColor }]}>More</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { marginTop: 15 }]} onPress={() => { setMenuVisible(false); navigation.navigate('Tabs', { screen: 'EditCategories' }); }}>
              <Ionicons name="layers-outline" size={20} color={textColor} />
              <Text style={[styles.menuItemText, { color: textColor }]}>Categories</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* RELEASE CALENDAR */}
      <ReleaseCalendar visible={calendarVisible} onClose={() => setCalendarVisible(false)} />

      <Tab.Navigator
        initialRouteName="My List"
        screenOptions={({ route }) => ({
          headerRight: () => {
            if (route.name !== 'My List') return null;
            return (
              <View style={styles.headerRightContainer}>
                <TouchableOpacity onPress={() => setIsSearchActive(!isSearchActive)} style={styles.headerIcon}>
                  <Ionicons name={isSearchActive ? "close-circle" : "search-outline"} size={24} color={textColor} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCalendarVisible(true)} style={styles.headerIcon}>
                  <Ionicons name="calendar-outline" size={24} color={textColor} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openSheet(setFilterVisible, filterAnim)} style={styles.headerIcon}>
                  <Ionicons name="options-outline" size={24} color={textColor} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerIcon}>
                  <Ionicons name="ellipsis-vertical" size={24} color={textColor} />
                </TouchableOpacity>
              </View>
            );
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'help';
            if (route.name === 'My List') iconName = focused ? 'list' : 'list-outline';
            else if (route.name === 'Recent') iconName = focused ? 'time' : 'time-outline';
            else if (route.name === 'Add Anime') iconName = focused ? 'add-circle' : 'add-circle-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: accentColor,
          tabBarInactiveTintColor: '#888',
          tabBarStyle: { backgroundColor: bgColor, borderTopColor: borderColor },
          headerStyle: { backgroundColor: bgColor, elevation: 0, shadowColor: 'transparent' },
          headerTintColor: textColor,
        })}
      >
        <Tab.Screen name="Recent" component={RecentScreen} />
        <Tab.Screen name="My List" component={ListScreen} />
        <Tab.Screen name="Add Anime" component={AddScreen} />
        <Tab.Screen name="EditCategories" component={EditCategoriesScreen} options={{ tabBarItemStyle: { display: 'none' }, tabBarStyle: { display: 'none' }, headerShown: false }} />
        <Tab.Screen name="More" component={MoreScreen} options={{ tabBarItemStyle: { display: 'none' }, tabBarStyle: { display: 'none' }, headerShown: false }} />
        <Tab.Screen name="DataStorage" component={DataStorageScreen} options={{ tabBarItemStyle: { display: 'none' }, tabBarStyle: { display: 'none' }, headerShown: false }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarItemStyle: { display: 'none' }, tabBarStyle: { display: 'none' }, headerShown: false }} />
        <Tab.Screen name="About" component={AboutScreen} options={{ tabBarItemStyle: { display: 'none' }, tabBarStyle: { display: 'none' }, headerShown: false }} />
      </Tab.Navigator>
    </>
  );
}

// ── Root Stack ─────────────────────────────────────────────────────────────────
// The tabs live INSIDE this stack; AnimeDetail pushes on top of everything.
// Because the stack keeps the tabs rendered behind it, closing the detail
// screen slides down over the REAL list — and goBack() always returns to
// wherever you came from. No hidden-tab tricks, no black void, no Recent.
function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="AnimeDetail"
        component={AnimeDetailScreen}
        options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

// ── First Launch Storage Modal ────────────────────────────────────────────────
function FirstLaunchModal() {
  const { theme, accentColor, setStorageUri } = useAppContext();
  const [visible, setVisible] = useState(false);

  const bgColor    = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor  = theme === 'Dark' ? '#fff'    : '#000';
  const subColor   = '#888';
  const cardColor  = theme === 'Dark' ? '#212124' : '#fff';
  const borderColor = theme === 'Dark' ? '#333'   : '#ddd';

  useEffect(() => {
    AsyncStorage.getItem('@mirisu_first_launch').then(val => {
      if (val === null) setVisible(true);
    });
  }, []);

  const dismiss = async () => {
    await AsyncStorage.setItem('@mirisu_first_launch', 'done');
    setVisible(false);
  };

  const handleSelectFolder = async () => {
    if (Platform.OS !== 'android') {
      await dismiss();
      return;
    }
    try {
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        // AppContext persists this under @anilist_storageUri.
        setStorageUri(permissions.directoryUri);
      }
    } catch (e) {
      console.error('First launch SAF error:', e);
    }
    await dismiss();
  };

  const handleSkip = async () => {
    await dismiss();
  };

  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleSkip}>
      <View style={firstLaunchStyles.overlay}>
        <View style={[firstLaunchStyles.card, { backgroundColor: cardColor, borderColor }]}>

          <View style={[firstLaunchStyles.iconCircle, { backgroundColor: accentColor + '22' }]}>
            <Ionicons name="folder-open-outline" size={36} color={accentColor} />
          </View>

          <Text style={[firstLaunchStyles.title, { color: textColor }]}>
            Choose a Backup Folder
          </Text>
          <Text style={[firstLaunchStyles.subtitle, { color: subColor }]}>
            Pick a folder where Mirisu can automatically save backups of your list. You can change this anytime in Data and Storage.
          </Text>

          <TouchableOpacity
            style={[firstLaunchStyles.primaryBtn, { backgroundColor: accentColor }]}
            onPress={handleSelectFolder}
          >
            <Ionicons name="folder-open-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={firstLaunchStyles.primaryBtnText}>Select a Folder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[firstLaunchStyles.secondaryBtn, { borderColor }]}
            onPress={handleSkip}
          >
            <Text style={[firstLaunchStyles.secondaryBtnText, { color: subColor }]}>
              Skip for Now
            </Text>
          </TouchableOpacity>

          <Text style={[firstLaunchStyles.hint, { color: subColor }]}>
            Skipping means backups will use the Share sheet instead.
          </Text>

        </View>
      </View>
    </Modal>
  );
}

// ── Main App Wrapper ──────────────────────────────────────────────────────────
function MainApp() {
  const { isDataLoaded } = useAppContext();

  useEffect(() => {
    if (isDataLoaded) {
      const timer = setTimeout(async () => {
        await SplashScreen.hideAsync();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isDataLoaded]);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <RootStack />
      </NavigationContainer>
      <FirstLaunchModal />
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <MainApp />
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerRightContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  headerIcon: { paddingHorizontal: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalOverlayFade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, borderWidth: 1, maxHeight: '85%' },
  dragIndicator: { width: 40, height: 5, backgroundColor: '#888', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#888' },
  sortButton: { flexDirection: 'row', alignItems: 'center' },
  optionText: { fontWeight: '600', fontSize: 14 },
  menuPopup: { position: 'absolute', top: 60, right: 20, padding: 15, borderRadius: 12, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  menuItemText: { marginLeft: 10, fontSize: 16, fontWeight: '500' },
});

const firstLaunchStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});