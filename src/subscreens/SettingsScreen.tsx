import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Platform, StatusBar, ScrollView, Switch, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage'; // NEW: Imported AsyncStorage for Luxion

const ACCENT_COLORS = [
  { hex: '#4FA4FF', name: 'Ocean Blue' },
  { hex: '#FF4F4F', name: 'Crimson Red' },
  { hex: '#4FFF88', name: 'Neon Green' },
  { hex: '#B04FFF', name: 'Lavender' },
  { hex: '#FFB04F', name: 'Sunset' }
];
export default function SettingsScreen() {
  const { 
    theme, themePref, setThemePref, 
    accentColor, setAccentColor, 
    nsfwFilter, setNsfwFilter,
    setDisplayMode, setSortBy, setIsAscending,
    setAnimeList, setCustomCategories, setHiddenCategories, setStorageUri, setBackupFrequency
  } = useAppContext();
  
  const navigation = useNavigation<any>();

  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const bgColor = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const rowBgColor = theme === 'Dark' ? '#212124' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  // Colors for the mock app UI
  const mockCardBg = theme === 'Dark' ? '#000000' : '#f8f9fa';
  const mockBoxBg = theme === 'Dark' ? '#1A1A1A' : '#ffffff';
  const mockBottomBg = theme === 'Dark' ? '#000000' : '#ffffff';
  const mockBorder = theme === 'Dark' ? '#333' : '#ddd';
  const selectionBlue = '#4FA4FF'; 

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resetModalVisible && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resetModalVisible, countdown]);

  const handleThemeChange = () => {
    Alert.alert('Theme Mode', 'Choose your app appearance:', [
      { text: 'System Default', onPress: () => setThemePref('System') },
      { text: 'Light Mode', onPress: () => setThemePref('Light') },
      { text: 'Dark Mode', onPress: () => setThemePref('Dark') },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const handleClearCache = async () => {
    try {
      const cacheDir = (FileSystem as any).cacheDirectory;
      if (!cacheDir) return;
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      for (const file of files) await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
      Alert.alert('Success', 'Image and temporary cache cleared successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear cache.');
    }
  };

  // --- NEW: FUNCTION TO CLEAR LUXION CHAT ---
  const handleClearLuxionChat = () => {
    Alert.alert(
      'Clear Luxion Chat',
      'Are you sure you want to delete your conversation history with Luxion?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@luxion_history');
              Alert.alert('Success', "Luxion's memory has been wiped clean!");
            } catch (error) {
              Alert.alert('Error', 'Failed to clear Luxion chat history.');
            }
          }
        }
      ]
    );
  };

  const executeFactoryReset = async () => {
    setAnimeList([]);
    setCustomCategories([]);
    setHiddenCategories([]);
    setThemePref('System');
    setAccentColor('#4FA4FF');
    setNsfwFilter(false);
    setDisplayMode('List');
    setSortBy('Date Added');
    setIsAscending(false);
    setStorageUri('');
    setBackupFrequency('Off');
    
    // Also wipe Luxion on factory reset
    await AsyncStorage.removeItem('@luxion_history');

    setResetModalVisible(false);
    Alert.alert('Factory Reset Complete', 'All data and settings have been completely wiped.');
    navigation.navigate('My List' as never);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('More')} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={26} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: textColor }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 30 }}>
        
        <Text style={[styles.subheading, { color: accentColor }]}>Appearance & UI</Text>
        
        <TouchableOpacity style={styles.plainRow} onPress={handleThemeChange}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Theme Mode</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>{themePref} (Currently: {theme})</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.colorPickerContainer}>
          <Text style={[styles.menuTitle, { color: textColor, marginBottom: 4 }]}>Accent Color</Text>
          <Text style={[styles.menuSubtext, { color: '#888', marginBottom: 15 }]}>Choose your app's primary color</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ overflow: 'visible' }}>
            {ACCENT_COLORS.map(colorObj => {
              const isSelected = accentColor === colorObj.hex;
              
              return (
                <View key={colorObj.hex} style={styles.colorCardWrapper}>
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity 
                      activeOpacity={0.9} 
                      onPress={() => setAccentColor(colorObj.hex)}
                      style={[
                        styles.mockPhoneCard, 
                        { backgroundColor: mockCardBg, borderColor: isSelected ? selectionBlue : borderColor, borderWidth: isSelected ? 3 : 1 }
                      ]}
                    >
                      {/* Mock Header (My List + Icons) */}
                      <View style={styles.mockHeader}>
                        <View style={[styles.mockTitlePill, { backgroundColor: textColor }]} />
                        <View style={styles.mockHeaderIcons}>
                          <View style={[styles.mockIcon, { backgroundColor: textColor }]} />
                          <View style={[styles.mockIcon, { backgroundColor: textColor }]} />
                          <View style={[styles.mockIcon, { backgroundColor: textColor }]} />
                        </View>
                      </View>

                      {/* Mock Tabs */}
                      <View style={[styles.mockTabsRow, { borderBottomColor: mockBorder }]}>
                        <View style={styles.mockTab}>
                          <View style={[styles.mockTabText, { backgroundColor: colorObj.hex }]} />
                          <View style={[styles.mockTabIndicator, { backgroundColor: colorObj.hex }]} />
                        </View>
                        <View style={styles.mockTab}><View style={[styles.mockTabText, { backgroundColor: '#888' }]} /></View>
                        <View style={styles.mockTab}><View style={[styles.mockTabText, { backgroundColor: '#888' }]} /></View>
                      </View>

                      {/* Mock List Items */}
                      <View style={styles.mockListContainer}>
                        {[1, 2].map((i) => (
                          <View key={i} style={[styles.mockListItem, { backgroundColor: mockBoxBg, borderColor: mockBorder, borderWidth: 1 }]}>
                            <View style={[styles.mockListImg, { backgroundColor: '#555' }]} />
                            <View style={styles.mockListInfo}>
                              <View style={[styles.mockListLineLong, { backgroundColor: textColor }]} />
                              <View style={styles.mockListLineShort} />
                              <View style={styles.mockListStars}>
                                <View style={[styles.mockStar, { backgroundColor: colorObj.hex }]} />
                                <View style={[styles.mockStar, { backgroundColor: colorObj.hex }]} />
                                <View style={[styles.mockStar, { backgroundColor: colorObj.hex }]} />
                                <View style={[styles.mockStar, { backgroundColor: '#555' }]} />
                                <View style={[styles.mockStar, { backgroundColor: '#555' }]} />
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Mock Bottom Nav */}
                      <View style={[styles.mockBottomNav, { backgroundColor: mockBottomBg, borderTopColor: mockBorder }]}>
                        <View style={styles.mockNavItem}>
                          <View style={[styles.mockNavIcon, { backgroundColor: '#888' }]} />
                          <View style={[styles.mockNavText, { backgroundColor: '#888' }]} />
                        </View>
                        <View style={styles.mockNavItem}>
                          <View style={[styles.mockNavIcon, { backgroundColor: colorObj.hex }]} />
                          <View style={[styles.mockNavText, { backgroundColor: colorObj.hex }]} />
                        </View>
                        <View style={styles.mockNavItem}>
                          <View style={[styles.mockNavIcon, { backgroundColor: '#888' }]} />
                          <View style={[styles.mockNavText, { backgroundColor: '#888' }]} />
                        </View>
                      </View>

                    </TouchableOpacity>

                    {/* Blue Checkmark for Selection */}
                    {isSelected && (
                      <View style={styles.checkmarkBadge}>
                        <Ionicons name="checkmark-circle" size={24} color={selectionBlue} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.colorNameLabel, { color: textColor }]}>{colorObj.name}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <Text style={[styles.subheading, { color: accentColor }]}>Content Filtering</Text>

        <View style={styles.plainRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>NSFW / Adult Content Filter</Text>
            <Text style={[styles.menuSubtext, { color: '#888', marginRight: 10 }]}>Hide 18+ content from searches.</Text>
          </View>
          <Switch 
            value={nsfwFilter} 
            onValueChange={setNsfwFilter}
            trackColor={{ false: '#767577', true: accentColor }}
            thumbColor={'#f4f3f4'}
          />
        </View>

        <Text style={[styles.subheading, { color: accentColor }]}>Advanced / System</Text>

        <TouchableOpacity style={styles.plainRow} onPress={handleClearCache}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Clear Image Cache</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>Free up storage space by deleting temporary files.</Text>
          </View>
        </TouchableOpacity>

        {/* --- NEW: LUXION CLEAR BUTTON --- */}
        <TouchableOpacity style={styles.plainRow} onPress={handleClearLuxionChat}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Clear Luxion Chat</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>Delete your conversation with the AI to start fresh.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.plainRow} onPress={() => { setCountdown(5); setResetModalVisible(true); }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: '#FF3B30', fontWeight: 'bold' }]}>Factory Reset All Data</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>WARNING: Deletes your entire anime list and all settings permanently.</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>

      {/* FACTORY RESET WARNING MODAL */}
      <Modal animationType="fade" transparent={true} visible={resetModalVisible} onRequestClose={() => setResetModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: rowBgColor, borderColor }]}>
            <Ionicons name="warning" size={40} color="#FF3B30" style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={[styles.modalTitle, { color: textColor, textAlign: 'center' }]}>Are you completely sure?</Text>
            <Text style={{ color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
              This will irreversibly delete your entire Anime List, wipe all custom categories, and restore the app to factory settings.
            </Text>
            
            <TouchableOpacity 
              style={[styles.resetButton, countdown > 0 ? { backgroundColor: '#555' } : { backgroundColor: '#FF3B30' }]} 
              disabled={countdown > 0}
              onPress={executeFactoryReset}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                {countdown > 0 ? `Confirm Reset (${countdown}s)` : 'Yes, Delete Everything'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setResetModalVisible(false)}>
              <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, marginBottom: 15, marginTop: 5 },
  headerText: { fontSize: 22, marginLeft: 10, fontWeight: 'bold' },
  subheading: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 20, marginBottom: 5, marginLeft: 5 },
  plainRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  menuTitle: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  menuSubtext: { fontSize: 13, lineHeight: 18 },
  
  colorPickerContainer: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  colorCardWrapper: { alignItems: 'center', marginRight: 20, marginTop: 5, overflow: 'visible' },
  mockPhoneCard: { width: 85, height: 140, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  
  mockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingTop: 8, paddingBottom: 4 },
  mockTitlePill: { width: 22, height: 4, borderRadius: 2 },
  mockHeaderIcons: { flexDirection: 'row', gap: 2 },
  mockIcon: { width: 3, height: 3, borderRadius: 1.5 },
  
  mockTabsRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 4 },
  mockTab: { flex: 1, alignItems: 'center' },
  mockTabText: { width: 16, height: 3, borderRadius: 1.5, marginTop: 4 },
  mockTabIndicator: { width: 24, height: 1.5, borderRadius: 1, marginTop: 3 },
  
  mockListContainer: { padding: 4, flex: 1 },
  mockListItem: { flexDirection: 'row', borderRadius: 4, padding: 3, marginBottom: 4 },
  mockListImg: { width: 18, height: 24, borderRadius: 2 },
  mockListInfo: { marginLeft: 4, flex: 1, justifyContent: 'center' },
  mockListLineLong: { width: '90%', height: 2.5, borderRadius: 1.5, marginBottom: 2.5 },
  mockListLineShort: { width: '60%', height: 2, borderRadius: 1, backgroundColor: '#888', marginBottom: 3 },
  mockListStars: { flexDirection: 'row', gap: 1 },
  mockStar: { width: 3, height: 3, borderRadius: 1.5 },

  mockBottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1 },
  mockNavItem: { alignItems: 'center', gap: 1.5 },
  mockNavIcon: { width: 6, height: 6, borderRadius: 3 },
  mockNavText: { width: 10, height: 2, borderRadius: 1 },

  checkmarkBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12, zIndex: 10 },
  colorNameLabel: { marginTop: 12, fontSize: 13, fontWeight: '600' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 12, padding: 25, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  resetButton: { padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  cancelButton: { padding: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#888' }
});