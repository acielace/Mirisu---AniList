import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { AnimeEntry } from '../types';

export default function RecentScreen() {
  const { animeList, theme } = useAppContext();

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const cardBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  // 1. Filter out "Will Watch" so we only get Watched and Dropped
  const recentAnime = animeList.filter(anime => anime.status === 'Watched' || anime.status === 'Dropped');

  // 2. Sort from newest to oldest using the ID (which is a timestamp)
  recentAnime.sort((a, b) => parseInt(b.id) - parseInt(a.id));

  // 3. Helper function to turn the timestamp into "Today", "Yesterday", or a Date
  const getDateCategory = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    // For older items, return something like "Oct 12, 2023"
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // 4. Group the anime by these date strings
  const groupedAnime: { [key: string]: AnimeEntry[] } = {};
  recentAnime.forEach(anime => {
    const dateLabel = getDateCategory(anime.id);
    if (!groupedAnime[dateLabel]) {
      groupedAnime[dateLabel] = [];
    }
    groupedAnime[dateLabel].push(anime);
  });

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {recentAnime.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={60} color="#888" />
          <Text style={{ color: '#888', marginTop: 10, fontSize: 16 }}>No recent activity yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {Object.keys(groupedAnime).map((dateLabel) => (
            <View key={dateLabel} style={styles.groupContainer}>
              
              {/* THE DATE HEADER (e.g., "Today", "Yesterday") */}
              <Text style={[styles.dateHeader, { color: textColor }]}>{dateLabel}</Text>
              
              {/* THE ITEMS FOR THAT DATE */}
              {groupedAnime[dateLabel].map((item) => (
                <View key={item.id} style={[styles.recentCard, { backgroundColor: cardBg, borderColor }]}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.image} />
                  ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: borderColor }]}>
                      <Ionicons name="image-outline" size={20} color="#888" />
                    </View>
                  )}
                  
                  <View style={styles.info}>
                    <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.statusText, { color: item.status === 'Dropped' ? '#FF3B30' : '#888' }]}>
                      {item.status}  •  S{item.season || 1} Ep {item.episode || 0}
                    </Text>
                  </View>

                  {/* Status Icon on the right */}
                  <Ionicons 
                    name={item.status === 'Watched' ? "checkmark-circle" : "close-circle"} 
                    size={24} 
                    color={item.status === 'Watched' ? "#34C759" : "#FF3B30"} 
                  />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  groupContainer: { marginBottom: 25 },
  dateHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginTop: 10 },
  recentCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  image: { width: 45, height: 60, borderRadius: 6 },
  imagePlaceholder: { width: 45, height: 60, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  info: { marginLeft: 15, flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  statusText: { fontSize: 13, fontWeight: '500' }
});