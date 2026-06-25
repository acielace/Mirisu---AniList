import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Platform, StatusBar, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';

import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

const FREQUENCY_OPTIONS = ['Off', 'Every 1 hour', 'Every 3 hours', 'Every 6 hours', 'Every 12 hours', 'Daily', 'Every 2 days', 'Weekly'];

export default function DataStorageScreen() {
  const { 
    theme, animeList, customCategories, hiddenCategories, 
    storageUri, setStorageUri, backupFrequency, setBackupFrequency, 
    setAnimeList, setCustomCategories, setHiddenCategories 
  } = useAppContext();
  
  const navigation = useNavigation<any>();
  const [freqModalVisible, setFreqModalVisible] = useState(false);

  const bgColor = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const rowBgColor = theme === 'Dark' ? '#212124' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';
  
  // FIX: Changed to a lighter, nicer blue
  const lighterBlue = '#4FA4FF';

  const handleSelectStorage = () => {
    Alert.alert(
      'Storage Location',
      'In this version of the app, backups are temporarily saved to a secure internal folder, then you choose where to permanently save them using the Share menu.'
    );
  };

  const handleCreateBackup = async () => {
    try {
      const backupData = JSON.stringify({
        animeList, customCategories, hiddenCategories, timestamp: Date.now()
      });

      const fileName = `AniList_Backup_${new Date().toISOString().split('T')[0]}.json`;
      const baseDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
      
      if (!baseDir) { Alert.alert('Error', 'File system is not ready.'); return; }
      
      const fileUri = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, backupData);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Save Backup File' });
      } else {
        Alert.alert('Sharing Unavailable', 'Your device does not support file sharing.');
      }
    } catch (error) {
      Alert.alert('Backup Failed', 'An error occurred while creating the backup.');
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
        let parsedData;
        try { parsedData = JSON.parse(fileContent); } catch (e) { Alert.alert('Invalid File', 'This file is not a valid JSON backup.'); return; }

        if (parsedData && parsedData.animeList && Array.isArray(parsedData.animeList)) {
          Alert.alert('Restore Backup', 'This will overwrite your current list and categories. Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Restore', style: 'destructive', onPress: () => {
                  setAnimeList(parsedData.animeList);
                  if (parsedData.customCategories) setCustomCategories(parsedData.customCategories);
                  if (parsedData.hiddenCategories) setHiddenCategories(parsedData.hiddenCategories);
                  Alert.alert('Success', 'Data restored successfully!');
              }}
          ]);
        } else { Alert.alert('Invalid File', 'This file does not contain AniList backup data.'); }
      }
    } catch (error) { Alert.alert('Restore Failed', 'Could not read the backup file.'); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      
      <View style={styles.header}>
        {/* FIX: Explicitly navigate to 'More' instead of goBack() */}
        <TouchableOpacity onPress={() => navigation.navigate('More')} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={26} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: textColor }]}>Data and Storage</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 30 }}>
        
        {/* FIX: Storage Location is now container-less */}
        <TouchableOpacity style={styles.plainRow} onPress={handleSelectStorage}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Storage Location</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]} numberOfLines={1}>Default Internal Storage (Use Share to export)</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.subheading, { color: lighterBlue }]}>Backup and Restore</Text>

        <TouchableOpacity style={[styles.menuRow, { backgroundColor: rowBgColor, borderColor }]} onPress={handleCreateBackup}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Create Backup</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>Export your current data to save it securely.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuRow, { backgroundColor: rowBgColor, borderColor }]} onPress={handleRestoreBackup}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Restore Backup</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>Restore data from a previously exported backup file.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuRow, { backgroundColor: rowBgColor, borderColor }]} onPress={() => setFreqModalVisible(true)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: textColor }]}>Automatic backup frequency</Text>
            <Text style={[styles.menuSubtext, { color: '#888' }]}>{backupFrequency}</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={freqModalVisible} onRequestClose={() => setFreqModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFreqModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: rowBgColor, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Automatic backup frequency</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {FREQUENCY_OPTIONS.map((option) => (
                <TouchableOpacity key={option} style={styles.radioRow} onPress={() => { setBackupFrequency(option); setFreqModalVisible(false); }}>
                  <Ionicons name={backupFrequency === option ? "radio-button-on" : "radio-button-off"} size={24} color={backupFrequency === option ? lighterBlue : '#888'} />
                  <Text style={[styles.radioText, { color: textColor }]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 15 }} onPress={() => setFreqModalVisible(false)}>
              <Text style={{ color: lighterBlue, fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, marginBottom: 15, marginTop: 5 },
  headerText: { fontSize: 22, marginLeft: 10, fontWeight: 'bold' },
  // FIX: Added plainRow for the containerless storage location
  plainRow: { paddingVertical: 12, marginBottom: 10 },
  menuRow: { padding: 18, borderRadius: 12, marginBottom: 12, borderWidth: 1, justifyContent: 'center' },
  menuTitle: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  menuSubtext: { fontSize: 13, lineHeight: 18 },
  subheading: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 20, marginBottom: 15, marginLeft: 5 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 12, padding: 20, borderWidth: 1, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  radioText: { fontSize: 16, marginLeft: 15 }
});