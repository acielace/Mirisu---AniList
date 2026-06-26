import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Animated, Image, Alert, Platform } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import ListScreen from './src/screens/ListScreen';
import AddScreen from './src/screens/AddScreen';
import RecentScreen from './src/screens/RecentScreen'; 
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EditCategoriesScreen from './src/subscreens/EditCategoriesScreen';
import MoreScreen from './src/subscreens/MoreScreen';
import DataStorageScreen from './src/subscreens/DataStorageScreen'; 
import SettingsScreen from './src/subscreens/SettingsScreen'; 
import AboutScreen from './src/subscreens/AboutScreen';

import { AppProvider, useAppContext } from './src/context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { 
    theme, themePref, setThemePref, accentColor,
    sortBy, setSortBy, isAscending, setIsAscending, 
    displayMode, setDisplayMode, isSearchActive, setIsSearchActive,
    selectedGenres, setSelectedGenres, animeList 
  } = useAppContext();

  const navigation = useNavigation<any>();

  const [filterVisible, setFilterVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const bgColor = theme === 'Dark' ? '#000' : '#fff';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const cardColor = theme === 'Dark' ? '#1A1A1A' : '#f0f0f0';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

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
                    {sortBy === item && <Ionicons name={isAscending ? "arrow-up" : "arrow-down"} size={14} color="#fff" style={{marginLeft: 5}} />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* MULTI-SELECT GENRE FILTER */}
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
                <TouchableOpacity 
                  style={[styles.optionButton, themePref === 'System' && { backgroundColor: accentColor, borderColor: accentColor }]} 
                  onPress={() => setThemePref('System')}
                >
                  <Text style={[styles.optionText, themePref === 'System' ? { color: '#fff' } : { color: textColor }]}>System</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.optionButton, themePref === 'Dark' && { backgroundColor: accentColor, borderColor: accentColor }]} 
                  onPress={() => setThemePref('Dark')}
                >
                  <Text style={[styles.optionText, themePref === 'Dark' ? { color: '#fff' } : { color: textColor }]}>Dark</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.optionButton, themePref === 'Light' && { backgroundColor: accentColor, borderColor: accentColor }]} 
                  onPress={() => setThemePref('Light')}
                >
                  <Text style={[styles.optionText, themePref === 'Light' ? { color: '#fff' } : { color: textColor }]}>Light</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* THREE DOTS MENU */}
      <Modal animationType="fade" transparent={true} visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlayFade} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuPopup, { backgroundColor: cardColor, borderColor }]}>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate('More'); }}>
              <Ionicons name="grid-outline" size={20} color={textColor} />
              <Text style={[styles.menuItemText, { color: textColor }]}>More</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.menuItem, { marginTop: 15 }]} onPress={() => { setMenuVisible(false); navigation.navigate('EditCategories'); }}>
              <Ionicons name="layers-outline" size={20} color={textColor} />
              <Text style={[styles.menuItemText, { color: textColor }]}>Categories</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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

// Main App Wrapper handling Splash Screen
function MainApp() {
  const { isDataLoaded, theme } = useAppContext();
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const bgColor = theme === 'Dark' ? '#000' : '#fff';

  useEffect(() => {
    if (isDataLoaded) {
      // Fade the splash screen out
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setShowSplash(false);
        });
      }, 2500);
    }
  }, [isDataLoaded]);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>

      {showSplash && (
        <Animated.View 
          style={[
            StyleSheet.absoluteFill, 
            { 
              backgroundColor: bgColor, 
              justifyContent: 'center', 
              alignItems: 'center', 
              zIndex: 9999,
              opacity: fadeAnim 
            }
          ]}
        >
          <Image 
            source={require('./assets/splash_logo.png')} 
            style={{ width: 140, height: 140, borderRadius: 40 }} 
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <MainApp />
      </AppProvider>
    </SafeAreaProvider>
  );
}

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
  menuItemText: { marginLeft: 10, fontSize: 16, fontWeight: '500' }
});