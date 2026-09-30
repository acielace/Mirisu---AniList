import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView, Modal, Image, ActivityIndicator, Animated, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAppContext } from '../context/AppContext';
import { UPDATE_URL, TRUSTED_DOWNLOAD_PREFIX } from '../constants';
import { useNavigation } from '@react-navigation/native';

// Single source of truth is app.json's "expo.version" field — no second hardcoded string to drift.
const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export default function AboutScreen() {
  const { theme, accentColor } = useAppContext();
  const navigation = useNavigation<any>();

  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({ version: '', changelog: [] as string[], url: '', sha256: '' });

  const [easterEggVisible, setEasterEggVisible] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinValue = useRef(new Animated.Value(0)).current;

  const bgColor = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const rowBgColor = theme === 'Dark' ? '#212124' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  const handleCheckForUpdates = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(UPDATE_URL);
      const data = await response.json();
      
      if (data.latestVersion > CURRENT_VERSION) {
        // Refuse to surface a download link that doesn't live under our own GitHub Releases.
        if (typeof data.downloadUrl !== 'string' || !data.downloadUrl.startsWith(TRUSTED_DOWNLOAD_PREFIX)) {
          console.log('Rejected update: untrusted downloadUrl:', data.downloadUrl);
          Alert.alert(
            'Update Blocked',
            'The update link does not point to the official Mirisu releases page, so it was blocked for your safety.'
          );
          return;
        }

        setUpdateInfo({
          version: String(data.latestVersion),
          changelog: Array.isArray(data.changelog) ? data.changelog.map(String) : [],
          url: data.downloadUrl,
          sha256: typeof data.sha256 === 'string' ? data.sha256 : '',
        });
        setUpdateModalVisible(true);
      } else {
        Alert.alert("Up to Date", "Mirisu is running the latest version.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not check for updates. Please check your connection.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleVersionPress = () => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= 5) {
      setEasterEggVisible(true);
      Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
      setTimeout(() => { setEasterEggVisible(false); spinValue.setValue(0); }, 5000);
    } else {
      clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 1000);
    }
  };

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('More')} style={{ padding: 10 }}><Ionicons name="arrow-back" size={26} color={textColor} /></TouchableOpacity>
        <Text style={[styles.headerText, { color: textColor }]}>About</Text>
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20 }}>
        <Image source={require('../../assets/splash_logo.png')} style={{ width: 120, height: 120, borderRadius: 30, marginBottom: 15 }} />
        <Text style={{ color: textColor, fontSize: 28, fontWeight: 'bold' }}>Mirisu</Text>
        <TouchableOpacity activeOpacity={1} onPress={handleVersionPress} style={{ padding: 10 }}><Text style={{ color: '#888', fontSize: 16 }}>Version {CURRENT_VERSION}</Text></TouchableOpacity>

        <View style={{ width: '100%', marginTop: 40, borderTopWidth: 1, borderColor: 'rgba(150,150,150,0.1)' }}>
          <TouchableOpacity style={styles.aboutRow} onPress={handleCheckForUpdates} disabled={isScanning}>
            <Ionicons name="cloud-download-outline" size={24} color={accentColor} style={{ marginRight: 15 }} />
            <Text style={[styles.menuTitle, { color: textColor }]}>Check for updates</Text>
            {isScanning ? <ActivityIndicator color={accentColor} size="small" /> : <Ionicons name="chevron-forward" size={20} color="#888" />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.aboutRow} onPress={() => setWhatsNewVisible(true)}>
            <Ionicons name="sparkles-outline" size={24} color={accentColor} style={{ marginRight: 15 }} />
            <Text style={[styles.menuTitle, { color: textColor }]}>What's New</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* UPDATE MODAL */}
      <Modal visible={updateModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.sheetContent, { backgroundColor: bgColor, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Update v{updateInfo.version} Available!</Text>
            <Text style={{ color: textColor, marginBottom: 10 }}>What's new:</Text>
            {updateInfo.changelog.map((item, i) => <Text key={i} style={{ color: '#888' }}>• {item}</Text>)}

            {updateInfo.sha256 ? (
              <View style={{ marginTop: 15 }}>
                <Text style={{ color: textColor, fontWeight: 'bold', marginBottom: 4 }}>SHA-256 checksum</Text>
                <Text selectable style={{ color: '#888', fontSize: 11 }}>{updateInfo.sha256}</Text>
                <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                  Optional: compare this against the downloaded file with any SHA-256 checker before installing.
                </Text>
              </View>
            ) : null}
            
            <View style={{ flexDirection: 'row', marginTop: 20, gap: 10 }}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setUpdateModalVisible(false)}><Text style={{ color: '#888' }}>Later</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: accentColor }]} onPress={() => Linking.openURL(updateInfo.url)}><Text style={{ color: '#fff' }}>Download Now</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ... (Existing Easter Egg and What's New Modal code here) ... */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5 },
  headerText: { fontSize: 22, marginLeft: 10, fontWeight: 'bold' },
  aboutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  menuTitle: { flex: 1, fontSize: 16, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  sheetContent: { padding: 20, borderRadius: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalBtn: { padding: 15, borderRadius: 10, flex: 1, alignItems: 'center' }
});