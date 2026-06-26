import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Alert, Platform, StatusBar, Modal, ScrollView, AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Expo SDK 52: import the whole namespace, then type the SAF sub-object ────
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

// ---------------------------------------------------------------------------
// StorageAccessFramework type shim
// expo-file-system ships SAF on the runtime object but the bundled .d.ts in
// some SDK 52 releases doesn't re-export it from the top-level namespace.
// Casting through `unknown` is the TS-safe alternative to @ts-ignore.
// ---------------------------------------------------------------------------
interface SAF {
  requestDirectoryPermissionsAsync(): Promise<{ granted: boolean; directoryUri: string }>;
  createFileAsync(dirUri: string, fileName: string, mimeType: string): Promise<string>;
}

interface FileSystemExtended {
  documentDirectory: string | null;
  cacheDirectory: string | null;
  directories: {
    document: string;
    cache: string;
  };
  writeAsStringAsync(uri: string, contents: string): Promise<void>;
  readAsStringAsync(uri: string): Promise<string>;
  StorageAccessFramework: SAF;
}

const FS = FileSystem as unknown as FileSystemExtended;

const StorageAccessFramework = FS.StorageAccessFramework;

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

export default function DataStorageScreen() {
  const {
    theme, animeList, customCategories, hiddenCategories,
    storageUri, setStorageUri, backupFrequency, setBackupFrequency,
    setAnimeList, setCustomCategories, setHiddenCategories,
  } = useAppContext();

  const navigation = useNavigation<any>();
  const [freqModalVisible, setFreqModalVisible] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);

  // ── Keep a stable ref to animeList so the AppState listener never
  //    needs to be re-registered just because the list changed. ──────────────
  const animeListRef = useRef(animeList);
  useEffect(() => { animeListRef.current = animeList; }, [animeList]);

  const customCategoriesRef = useRef(customCategories);
  useEffect(() => { customCategoriesRef.current = customCategories; }, [customCategories]);

  const hiddenCategoriesRef = useRef(hiddenCategories);
  useEffect(() => { hiddenCategoriesRef.current = hiddenCategories; }, [hiddenCategories]);

  // ── Theme helpers ──────────────────────────────────────────────────────────
  const bgColor     = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor   = theme === 'Dark' ? '#fff'    : '#000';
  const rowBgColor  = theme === 'Dark' ? '#212124' : '#fff';
  const borderColor = theme === 'Dark' ? '#333'    : '#ddd';
  const lighterBlue = '#4FA4FF';

  // ── Load persisted last-backup time on mount ───────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('@anilist_last_backup').then(val => {
      if (val) setLastBackupTime(parseInt(val, 10));
    });
  }, []);

  // ── Select storage folder (Android only) ──────────────────────────────────
  const handleSelectStorage = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Notice', 'Direct folder selection is only supported on Android.');
      return;
    }
    try {
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        setStorageUri(permissions.directoryUri);
        await AsyncStorage.setItem('@mirisu_storage_uri', permissions.directoryUri);
        Alert.alert('Storage Set', 'Backups will now be saved to this folder.');
      } else {
        Alert.alert('Permission Denied', 'You must allow access to a folder to save backups there.');
      }
        } catch (e) {
          console.error('SAF folder picker error:', e);
          Alert.alert('System Error', `Could not open folder picker: ${String(e)}`);
        }
  };

  // ── Create backup ──────────────────────────────────────────────────────────
  const handleCreateBackup = useCallback(async (isAuto = false) => {
    try {
      const backupData = JSON.stringify({
        animeList: animeListRef.current,
        customCategories: customCategoriesRef.current,
        hiddenCategories: hiddenCategoriesRef.current,
        timestamp: Date.now(),
      });

      const now   = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileName = `Mirisu_Backup_${dateStr}_${timeStr}.json`;

      // ── Path 1: Write directly to user-selected SAF folder ────────────────
      if (Platform.OS === 'android' && storageUri) {
        try {
          const newFileUri = await StorageAccessFramework.createFileAsync(
            storageUri, fileName, 'application/json',
          );
          await FileSystem.writeAsStringAsync(newFileUri, backupData);

          const ts = Date.now();
          setLastBackupTime(ts);
          await AsyncStorage.setItem('@anilist_last_backup', ts.toString());

          if (!isAuto) Alert.alert('Success', 'Backup saved to your selected folder!');
          return;
        } catch (err) {
          // SAF write failed — fall through to share sheet
          console.warn('SAF write failed, falling back to share sheet.', err);
        }
      }

      // ── Path 2: Auto-backups have no share UI, so bail out silently ───────
      if (isAuto) return;

      // ── Path 3: Share sheet fallback ──────────────────────────────────────
      // documentDirectory is string | null in SDK 52 types; narrow it first.
      const baseDir = FS.directories?.document ?? FS.directories?.cache;
      if (!baseDir) throw new Error('File system not ready');

      const tempUri = `${baseDir}${fileName}`;
      await FS.writeAsStringAsync(tempUri, backupData);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(tempUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save Backup File',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
      } catch (error) {
        if (!isAuto) Alert.alert('Backup Failed', `Error: ${String(error)}`);
        console.error('Backup error:', error);
      }   
  }, [storageUri]); // storageUri is the only *external* dep; list data comes from refs

  // ── Restore backup ────────────────────────────────────────────────────────
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
        'Restore Backup',
        'This will overwrite your current list and categories. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore', style: 'destructive', onPress: () => {
              setAnimeList(parsedData.animeList);
              if (parsedData.customCategories) setCustomCategories(parsedData.customCategories);
              if (parsedData.hiddenCategories)  setHiddenCategories(parsedData.hiddenCategories);
              Alert.alert('Success', 'Data restored successfully!');
            },
          },
        ],
      );
    } catch {
      Alert.alert('Restore Failed', 'Could not read the backup file.');
    }
  };

  // ── Set backup frequency + persist it ────────────────────────────────────
  const handleSetFrequency = async (option: string) => {
    setBackupFrequency(option);
    setFreqModalVisible(false);
    await AsyncStorage.setItem('@mirisu_backup_frequency', option);
  };

  // ── Auto-backup logic ─────────────────────────────────────────────────────
  // Uses stable refs for list data → this effect only re-runs when the
  // *scheduling* inputs change (frequency, storageUri, lastBackupTime).
  useEffect(() => {
    const checkAutoBackup = () => {
      if (backupFrequency === 'Off' || !storageUri) return;

      const thresholdHours = HOURS_MAP[backupFrequency as FrequencyOption] ?? Infinity;
      if (thresholdHours === Infinity) return;

      const hoursPassed = (Date.now() - (lastBackupTime ?? 0)) / (1000 * 60 * 60);
      if (hoursPassed >= thresholdHours) {
        handleCreateBackup(true);
      }
    };

    checkAutoBackup();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') checkAutoBackup();
    });

    return () => subscription.remove();
  }, [backupFrequency, storageUri, lastBackupTime, handleCreateBackup]);

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
    <SafeAreaView style={[styles.root, { backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>

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
          onPress={() => handleCreateBackup(false)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Create Backup</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>
              Export your current data to save it securely.
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
              Restore data from a previously exported backup file.
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
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  radioText: { fontSize: 16, marginLeft: 15 },
  cancelBtn: { alignSelf: 'flex-end', marginTop: 15 },
});