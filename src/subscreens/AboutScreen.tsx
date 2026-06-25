import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Platform, StatusBar, ScrollView, Modal, Image, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';

export default function AboutScreen() {
  const { theme, accentColor } = useAppContext();
  const navigation = useNavigation<any>();

  // Screen/Modal States
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Easter Egg States
  const [easterEggVisible, setEasterEggVisible] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinValue = useRef(new Animated.Value(0)).current;

  // Theme Colors
  const bgColor = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const rowBgColor = theme === 'Dark' ? '#212124' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  // --- EASTER EGG LOGIC ---
  const handleVersionPress = () => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);

    if (clickCount.current >= 5) {
      setEasterEggVisible(true);
      clickCount.current = 0;
      
      Animated.loop(
        Animated.timing(spinValue, { toValue: 1, duration: 2000, useNativeDriver: true })
      ).start();

      setTimeout(() => {
        setEasterEggVisible(false);
        spinValue.setValue(0);
      }, 5000);
    } else {
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 1000);
    }
  };

  // --- UPDATE SCANNER LOGIC ---
  const handleCheckForUpdates = () => {
    setIsScanning(true);
    
    // Simulating the time it takes to check the server
    setTimeout(() => {
      setIsScanning(false);
      Alert.alert("Up to Date", "Mirisu is currently running the latest version. No new updates found.");
      
      /* NOTE FOR DEPLOYMENT: 
        When you deploy the app, you will replace the Alert above with a fetch request 
        that reads your main code (like a version.json file on GitHub). Example:
        
        const response = await fetch('https://your-domain.com/version.json');
        const liveData = await response.json();
        if (liveData.version > "1.0.0") {
            // Trigger your update download modal here!
        }
      */
    }, 1500);
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('More')} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={26} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: textColor }]}>About</Text>
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, paddingBottom: 50 }}>
        
        {/* --- LOGO & EASTER EGG TRIGGER --- */}
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Image source={require('../../assets/luxion.png')} style={{ width: 120, height: 120, borderRadius: 30, marginBottom: 15 }} />
          <Text style={{ color: textColor, fontSize: 28, fontWeight: 'bold' }}>Mirisu</Text>
          
          <TouchableOpacity activeOpacity={1} onPress={handleVersionPress} style={{ padding: 10 }}>
            <Text style={{ color: '#888', fontSize: 16 }}>Version 1.0.0</Text>
          </TouchableOpacity>
        </View>

        <View style={{ width: '100%', marginTop: 40, borderTopWidth: 1, borderColor: 'rgba(150,150,150,0.1)' }}>
          
          {/* --- CHECK FOR UPDATES BUTTON --- */}
          <TouchableOpacity style={styles.aboutRow} onPress={handleCheckForUpdates} disabled={isScanning}>
            <Ionicons name="cloud-download-outline" size={24} color={accentColor} style={{ marginRight: 15 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: textColor, marginBottom: 0 }]}>Check for updates</Text>
            </View>
            {isScanning ? (
              <ActivityIndicator color={accentColor} size="small" />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#888" />
            )}
          </TouchableOpacity>

          {/* --- WHAT'S NEW BUTTON --- */}
          <TouchableOpacity style={styles.aboutRow} onPress={() => setWhatsNewVisible(true)}>
            <Ionicons name="sparkles-outline" size={24} color={accentColor} style={{ marginRight: 15 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: textColor, marginBottom: 0 }]}>What's New</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* --- EASTER EGG OVERLAY --- */}
      {easterEggVisible && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
          <Animated.Image 
            source={require('../../assets/luxion.png')} 
            style={{ width: 250, height: 250, borderRadius: 60, transform: [{ rotate: spin }] }} 
          />
          <Text style={{ color: accentColor, fontSize: 24, fontWeight: 'bold', marginTop: 30 }}>You found the secret!</Text>
        </View>
      )}

      {/* --- WHAT'S NEW MODAL --- */}
      <Modal animationType="slide" transparent={false} visible={whatsNewVisible} onRequestClose={() => setWhatsNewVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setWhatsNewVisible(false)} style={{ padding: 10 }}>
              <Ionicons name="arrow-down" size={26} color={textColor} />
            </TouchableOpacity>
            <Text style={[styles.headerText, { color: textColor }]}>Features</Text>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ color: accentColor, fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>Current Features</Text>
            
            {[
              { title: 'Anime Tracking', desc: 'Easily sort anime into Watched, Will Watch, and Dropped lists.' },
              { title: 'Custom Categories', desc: 'Create your own lists like "Favorites" or "Summer 2026".' },
              { title: 'Luxion AI Assistant', desc: 'Your personal AI companion that recommends anime and knows your list.' },
              { title: 'Smart Filtering', desc: 'Filter your entire list instantly by specific genres.' },
              { title: 'Custom Themes', desc: 'Switch between Light/Dark mode and choose your own accent color.' },
              { title: 'Multiple Layouts', desc: 'View your collection in a Grid, List, or minimal Text format.' },
              { title: 'Offline Storage', desc: 'All your data is saved securely on your local device.' }
            ].map((feat, idx) => (
              <View key={idx} style={{ flexDirection: 'row', marginBottom: 15, paddingLeft: 5 }}>
                <Text style={{ color: textColor, fontSize: 18, marginRight: 10, marginTop: -2 }}>•</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold', marginBottom: 2 }}>{feat.title}</Text>
                  <Text style={{ color: '#888', fontSize: 14, lineHeight: 20 }}>{feat.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, marginBottom: 15, marginTop: 5 },
  headerText: { fontSize: 22, marginLeft: 10, fontWeight: 'bold' },
  aboutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' }, 
  menuTitle: { fontSize: 16, fontWeight: '500', marginBottom: 4 }
});