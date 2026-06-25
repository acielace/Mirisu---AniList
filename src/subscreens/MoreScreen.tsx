import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';

export default function MoreScreen() {
  const { theme } = useAppContext();
  const navigation = useNavigation<any>(); 

  const bgColor = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('My List')} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={26} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: textColor }]}>More</Text>
      </View>

      <View style={styles.content}>
        
        <TouchableOpacity style={styles.plainRow} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color={textColor} />
          <Text style={[styles.menuText, { color: textColor }]}>Settings</Text>
          <Ionicons name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.plainRow} onPress={() => navigation.navigate('DataStorage')}>
          <Ionicons name="server-outline" size={24} color={textColor} />
          <Text style={[styles.menuText, { color: textColor }]}>Data and Storage</Text>
          <Ionicons name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>
        
        {/* FIX: Now navigates to the brand new About Screen! */}
        <TouchableOpacity style={styles.plainRow} onPress={() => navigation.navigate('About')}>
          <Ionicons name="information-circle-outline" size={24} color={textColor} />
          <Text style={[styles.menuText, { color: textColor }]}>About</Text>
          <Ionicons name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, marginBottom: 15, marginTop: 5 },
  headerText: { fontSize: 22, marginLeft: 10, fontWeight: 'bold' },
  content: { paddingHorizontal: 15 },
  plainRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  menuText: { flex: 1, fontSize: 16, marginLeft: 15, fontWeight: '500' }
});