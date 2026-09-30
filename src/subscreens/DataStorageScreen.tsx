import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Platform, Modal, ScrollView, AppState,
  AppStateStatus, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnimeEntry } from '../types';

import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

// ---------------------------------------------------------------------------

const FREQUENCY_OPTIONS = [
  'Off', 'Every 1 hour', 'Every 3 hours', 'Every 6 hours',
  'Every 12 hours', 'Daily', 'Every 2 days', 'Weekly',
] as const;
type FrequencyOption = typeof FREQUENCY_OPTIONS[number];

const HOURS_MAP: Record<FrequencyOption, number> = {
  'Off': Infinity,
  'Every 1 hour': 1,
  'Every 3 hours': 3,
  'Every 6 hours': 6,
  'Every 12 hours': 12,
  'Daily': 24,
  'Every 2 days': 48,
  'Weekly': 168,
};

const AUTO_BACKUP_FILENAME = 'Mirisu_Backup_Auto.json';

export default function DataStorageScreen() {
  const {
    theme, animeList, customCategories, hiddenCategories,
    storageUri, setStorageUri, backupFrequency, setBackupFrequency,
    setAnimeList, setCustomCategories, setHiddenCategories,
  } = useAppContext();

  const navigation = useNavigation<any>();
  const [freqModalVisible, setFreqModalVisible]     = useState(false);
  const [saveModalVisible, setSaveModalVisible]     = useState(false);
  const [lastBackupTime, setLastBackupTime]         = useState<number | null>(null);

  // Default filename shown in the rename input
  const buildDefaultFileName = () => {
    const now     = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `Mirisu_Backup_${dateStr}_${timeStr}`;
  };

  const [backupFileName, setBackupFileName] = useState(buildDefaultFileName);

  // Stable refs so AppState listener never re-registers due to list changes
  const animeListRef = useRef(animeList);
  useEffect(() => { animeListRef.current = animeList; }, [animeList]);

  const customCategoriesRef = useRef(customCategories);
  useEffect(() => { customCategoriesRef.current = customCategories; }, [customCategories]);

  const hiddenCategoriesRef = useRef(hiddenCategories);
  useEffect(() => { hiddenCategoriesRef.current = hiddenCategories; }, [hiddenCategories]);

  // ── Theme helpers ─────────────────────────────────────────────────────────
  const bgColor      = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor    = theme === 'Dark' ? '#fff'    : '#000';
  const rowBgColor   = theme === 'Dark' ? '#212124' : '#fff';
  const borderColor  = theme === 'Dark' ? '#333'    : '#ddd';
  const inputBgColor = theme === 'Dark' ? '#2a2a2e' : '#f0f0f0';
  const lighterBlue  = '#4FA4FF';

  // ── Load persisted last-backup time on mount ──────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('@anilist_last_backup').then(val => {
      if (val) setLastBackupTime(parseInt(val, 10));
    });
  }, []);

  // ── Select storage folder (Android only) ─────────────────────────────────
  const handleSelectStorage = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Notice', 'Direct folder selection is only supported on Android.');
      return;
    }
    try {
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        // AppContext persists this under @anilist_storageUri.
        setStorageUri(permissions.directoryUri);
        Alert.alert('Storage Set', 'Backups will now be saved to this folder.');
      } else {
        Alert.alert('Permission Denied', 'You must allow access to a folder to save backups there.');
      }
    } catch (e) {
      console.error('SAF folder picker error:', e);
      Alert.alert('System Error', `Could not open folder picker: ${String(e)}`);
    }
  };

  // ── Open the Save Backup modal (manual only) ──────────────────────────────
  const handleOpenSaveModal = () => {
    setBackupFileName(buildDefaultFileName());
    setSaveModalVisible(true);
  };

  // ── Execute the actual save after user confirms name + folder ─────────────
  const handleConfirmSave = async () => {
    setSaveModalVisible(false);

    // Sanitise filename: strip illegal characters, trim whitespace
    const rawName  = backupFileName.trim().replace(/[\\/:*?"<>|]/g, '_');
    const fileName = (rawName.length > 0 ? rawName : buildDefaultFileName()) + '.json';

    const backupData = JSON.stringify({
      animeList:        animeListRef.current,
      customCategories: customCategoriesRef.current,
      hiddenCategories: hiddenCategoriesRef.current,
      timestamp:        Date.now(),
    });

    if (Platform.OS === 'android') {
      // Always open the folder picker so the user chooses where to save
      try {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          // User cancelled the folder picker — fall through to share sheet
          await _shareBackup(backupData, fileName);
          return;
        }

        const newFileUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri, fileName, 'application/json',
        );
        await FileSystem.writeAsStringAsync(newFileUri, backupData);

        const ts = Date.now();
        setLastBackupTime(ts);
        await AsyncStorage.setItem('@anilist_last_backup', ts.toString());

        Alert.alert('Saved', `"${fileName}" saved successfully.`);
      } catch (err) {
        console.warn('SAF save failed, falling back to share sheet.', err);
        await _shareBackup(backupData, fileName);
      }
    } else {
      // iOS / other: share sheet only
      await _shareBackup(backupData, fileName);
    }
  };

  // ── Share sheet helper (fallback for non-Android or SAF failure) ──────────
  const _shareBackup = async (backupData: string, fileName: string) => {
    try {
      const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!baseDir) throw new Error('File system not ready');

      const tempUri = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(tempUri, backupData);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(tempUri, {
          mimeType:    'application/json',
          dialogTitle: 'Save Backup File',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error) {
      Alert.alert('Backup Failed', `Error: ${String(error)}`);
      console.error('Share backup error:', error);
    }
  };

  // ── Auto-backup (uses pre-set storageUri, no folder picker) ──────────────
  const handleAutoBackup = useCallback(async () => {
    try {
      const backupData = JSON.stringify({
        animeList:        animeListRef.current,
        customCategories: customCategoriesRef.current,
        hiddenCategories: hiddenCategoriesRef.current,
        timestamp:        Date.now(),
      });

      if (Platform.OS === 'android' && storageUri) {
        try {
          // Delete the previous auto-backup file to avoid accumulation
          const lastAutoUri = await AsyncStorage.getItem('@mirisu_last_auto_backup_uri');
          if (lastAutoUri) {
            try {
              await FileSystem.deleteAsync(lastAutoUri, { idempotent: true });
            } catch {
              // If delete fails, continue anyway
            }
          }

          const newFileUri = await StorageAccessFramework.createFileAsync(
            storageUri, AUTO_BACKUP_FILENAME, 'application/json',
          );
          await FileSystem.writeAsStringAsync(newFileUri, backupData);
          await AsyncStorage.setItem('@mirisu_last_auto_backup_uri', newFileUri);

          const ts = Date.now();
          setLastBackupTime(ts);
          await AsyncStorage.setItem('@anilist_last_backup', ts.toString());
        } catch (err) {
          console.warn('Auto-backup SAF write failed.', err);
        }
      }
    } catch (error) {
      console.error('Auto-backup error:', error);
    }
  }, [storageUri]);

  // ── Restore backup (merge, not overwrite) ────────────────────────────────
  const handleRestoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);

      let parsedData: any;
      try {
        parsedData = JSON.parse(fileContent);
      } catch {
        Alert.alert('Invalid File', 'This file is not a valid JSON backup.');
        return;
      }

      if (!parsedData?.animeList || !Array.isArray(parsedData.animeList)) {
        Alert.alert('Invalid File', 'This file does not contain Mirisu backup data.');
        return;
      }

      Alert.alert(
        'Merge Backup',
        'Entries from the backup that do not exist in your current list will be added. Your existing entries will not be changed. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge', onPress: () => {
              // Merge animeList by id
              const currentIds  = new Set(animeListRef.current.map((e: AnimeEntry) => e.id));
              const newEntries: AnimeEntry[] = (parsedData.animeList as AnimeEntry[])
                .filter((e: AnimeEntry) => !currentIds.has(e.id));
              setAnimeList([...animeListRef.current, ...newEntries]);

              // Merge customCategories by union
              if (parsedData.customCategories && Array.isArray(parsedData.customCategories)) {
                setCustomCategories(Array.from(
                  new Set([...customCategoriesRef.current, ...parsedData.customCategories])
                ));
              }

              // Merge hiddenCategories by union
              if (parsedData.hiddenCategories && Array.isArray(parsedData.hiddenCategories)) {
                setHiddenCategories(Array.from(
                  new Set([...hiddenCategoriesRef.current, ...parsedData.hiddenCategories])
                ));
              }

              Alert.alert(
                'Merge Complete',
                `${newEntries.length} new ${newEntries.length === 1 ? 'entry' : 'entries'} added from backup.`,
              );
            },
          },
        ],
      );
    } catch {
      Alert.alert('Restore Failed', 'Could not read the backup file.');
    }
  };

  // ── Set backup frequency (AppContext persists it under @anilist_backupFreq) ─
  const handleSetFrequency = (option: string) => {
    setBackupFrequency(option);
    setFreqModalVisible(false);
  };

  // ── Auto-backup scheduling ────────────────────────────────────────────────
  useEffect(() => {
    const checkAutoBackup = () => {
      if (backupFrequency === 'Off' || !storageUri) return;

      const thresholdHours = HOURS_MAP[backupFrequency as FrequencyOption] ?? Infinity;
      if (thresholdHours === Infinity) return;

      const hoursPassed = (Date.now() - (lastBackupTime ?? 0)) / (1000 * 60 * 60);
      if (hoursPassed >= thresholdHours) handleAutoBackup();
    };

    checkAutoBackup();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') checkAutoBackup();
    });

    return () => subscription.remove();
  }, [backupFrequency, storageUri, lastBackupTime, handleAutoBackup]);

  // ── Display helpers ───────────────────────────────────────────────────────
  const displayStorageUri = storageUri
    ? decodeURIComponent(storageUri.split('%3A').pop() ?? 'Custom Folder Selected')
    : 'Default Internal Storage (Use Share to export)';

  const freqSubtext = backupFrequency === 'Off'
    ? 'Off'
    : storageUri
      ? `${backupFrequency} (Active)`
      : `${backupFrequency} (Requires Storage Location)`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bgColor }]}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('More')} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={26} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: textColor }]}>Data and Storage</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        <TouchableOpacity style={styles.plainRow} onPress={handleSelectStorage}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Storage Location</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]} numberOfLines={1}>
              {displayStorageUri}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.subheading, { color: lighterBlue }]}>Backup and Restore</Text>

        <TouchableOpacity
          style={[styles.menuRow, { backgroundColor: rowBgColor, borderColor }]}
          onPress={handleOpenSaveModal}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Create Backup</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>
              Choose a name and folder to save your backup.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuRow, { backgroundColor: rowBgColor, borderColor }]}
          onPress={handleRestoreBackup}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Restore Backup</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>
              Merge entries from a backup file into your current list.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuRow, { backgroundColor: rowBgColor, borderColor }]}
          onPress={() => setFreqModalVisible(true)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Automatic backup frequency</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>{freqSubtext}</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Save Backup Modal ─────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={saveModalVisible}
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSaveModalVisible(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: rowBgColor, borderColor }]}
            // Prevent taps inside the card from closing the modal
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: textColor }]}>Save Backup</Text>

            <Text style={[styles.inputLabel, { color: '#888' }]}>File name</Text>
            <View style={[styles.inputRow, { backgroundColor: inputBgColor, borderColor }]}>
              <TextInput
                style={[styles.textInput, { color: textColor }]}
                value={backupFileName}
                onChangeText={setBackupFileName}
                placeholder="Enter file name"
                placeholderTextColor="#666"
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Text style={[styles.inputSuffix, { color: '#666' }]}>.json</Text>
            </View>

            <Text style={[styles.inputHint, { color: '#666' }]}>
              Tap Save to choose where on your device to store this file.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelModalBtn, { borderColor }]}
                onPress={() => setSaveModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: '#888' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.saveModalBtn, { backgroundColor: lighterBlue }]}
                onPress={handleConfirmSave}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Frequency Modal ───────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={freqModalVisible}
        onRequestClose={() => setFreqModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFreqModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: rowBgColor, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Automatic backup frequency</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {FREQUENCY_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.radioRow}
                  onPress={() => handleSetFrequency(option)}
                >
                  <Ionicons
                    name={backupFrequency === option ? 'radio-button-on' : 'radio-button-off'}
                    size={24}
                    color={backupFrequency === option ? lighterBlue : '#888'}
                  />
                  <Text style={[styles.radioText, { color: textColor }]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setFreqModalVisible(false)}
            >
              <Text style={{ color: lighterBlue, fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 5,
    marginBottom: 15, marginTop: 5,
  },
  headerText: { fontSize: 22, marginLeft: 10, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 15, paddingBottom: 30 },
  plainRow: { paddingVertical: 12, marginBottom: 10 },
  menuRow: {
    padding: 18, borderRadius: 12,
    marginBottom: 12, borderWidth: 1, justifyContent: 'center',
  },
  menuTitle: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  menuSubtext: { fontSize: 13, lineHeight: 18 },
  subheading: {
    fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase',
    marginTop: 20, marginBottom: 15, marginLeft: 5,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '85%', borderRadius: 12,
    padding: 20, borderWidth: 1, maxHeight: '70%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },

  // Save modal inputs
  inputLabel: { fontSize: 13, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10,
  },
  textInput: { flex: 1, fontSize: 15 },
  inputSuffix: { fontSize: 14, marginLeft: 4 },
  inputHint: { fontSize: 12, lineHeight: 18, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: {
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10,
  },
  cancelModalBtn: { borderWidth: 1 },
  saveModalBtn: {},
  modalBtnText: { fontSize: 15, fontWeight: '600' },

  // Frequency modal
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  radioText: { fontSize: 16, marginLeft: 15 },
  cancelBtn: { alignSelf: 'flex-end', marginTop: 15 },
});