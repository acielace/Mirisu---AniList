import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { ANILIST_URL } from '../constants';
import { AnimeEntry } from '../types';

// Release calendar for the user's own list: one AniList request fetches the
// global airing schedule for the visible week, matched locally against list
// entries by title (english or romaji — entries don't store AniList IDs).
// Kitsu has no schedule endpoint, so AniList-only, with the usual Retry state.
// The whole week fits on screen — 7 flex columns, no horizontal scrolling.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface ScheduleItem {
  airingAt: number;      // unix seconds
  episode: number;
  title: string;         // YOUR entry's title — what you recognize
  coverUrl: string | null;
}

interface DayColumn {
  dayName: string;
  dateNum: number;
  isToday: boolean;
  items: ScheduleItem[];
}

// Monday-based week start, local midnight.
const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
};

const normalizeTitle = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const formatTime = (unixSecs: number) =>
  new Date(unixSecs * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function ReleaseCalendar({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme, accentColor, animeList } = useAppContext();

  const [weekStart, setWeekStart] = useState<number>(() => getWeekStart(new Date()));
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Session cache, keyed by week start — flipping between weeks doesn't refetch.
  const cache = useRef(new Map<number, ScheduleItem[]>());

  // List changed → cached weeks may be stale (added/removed shows).
  useEffect(() => {
    cache.current.clear();
  }, [animeList]);

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const cardBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  const fetchWeek = async () => {
    const cached = cache.current.get(weekStart);
    if (cached) {
      setItems(cached);
      setUnavailable(false);
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setUnavailable(false);
    try {
      const from = Math.floor(weekStart / 1000);
      const to = Math.floor((weekStart + WEEK_MS) / 1000);

      // Both pages in ONE request via aliases — a busy week can exceed 100
      // global airing episodes.
      const query = `
        query ($from: Int, $to: Int) {
          p1: Page (page: 1, perPage: 100) {
            airingSchedules (airingAt_greater: $from, airingAt_lesser: $to) {
              airingAt
              episode
              media { id title { romaji english } coverImage { large } }
            }
          }
          p2: Page (page: 2, perPage: 100) {
            airingSchedules (airingAt_greater: $from, airingAt_lesser: $to) {
              airingAt
              episode
              media { id title { romaji english } coverImage { large } }
            }
          }
        }
      `;
      const response = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { from, to } }),
      });
      const json = await response.json();
      if (json.errors) {
        console.log("AniList API error:", json.errors[0]?.message || json.errors);
        throw new Error('AniList error');
      }

      const raw: any[] = [
        ...((json.data?.p1?.airingSchedules ?? []) as any[]),
        ...((json.data?.p2?.airingSchedules ?? []) as any[]),
      ];

      // Match the global schedule against YOUR list (Dropped excluded — no
      // release pings for shows you bailed on).
      const eligible: AnimeEntry[] = animeList.filter((a: AnimeEntry) => a.status !== 'Dropped');
      const titleMap = new Map<string, AnimeEntry>();
      eligible.forEach((e: AnimeEntry) => { if (e.title) titleMap.set(normalizeTitle(e.title), e); });

      const matched: ScheduleItem[] = [];
      raw.forEach((row: any) => {
        const media = row.media || {};
        const entry =
          titleMap.get(normalizeTitle(media.title?.english || '')) ||
          titleMap.get(normalizeTitle(media.title?.romaji || ''));
        if (entry) {
          matched.push({
            airingAt: row.airingAt,
            episode: row.episode,
            title: entry.title,
            coverUrl: media.coverImage?.large ?? null,
          });
        }
      });
      matched.sort((a: ScheduleItem, b: ScheduleItem) => a.airingAt - b.airingAt);

      cache.current.set(weekStart, matched);
      setItems(matched);
    } catch (error) {
      console.log("AniList schedule fetch error:", error);
      setUnavailable(true);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (visible) fetchWeek();
  }, [visible, weekStart, retryCount, animeList]);

  // Group the flat schedule into 7 local-day columns.
  const days: DayColumn[] = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const list: ScheduleItem[] = items ?? [];
    const result: DayColumn[] = [];
    for (let i = 0; i < 7; i++) {
      const dayStartSec = (weekStart + i * DAY_MS) / 1000;
      const dayEndSec = dayStartSec + DAY_MS / 1000;
      const d = new Date(weekStart + i * DAY_MS);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      result.push({
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dateNum: d.getDate(),
        isToday: key === todayKey,
        items: list.filter((it: ScheduleItem) => it.airingAt >= dayStartSec && it.airingAt < dayEndSec),
      });
    }
    return result;
  }, [items, weekStart]);

  const weekLabel = useMemo(() => {
    const start = new Date(weekStart);
    const end = new Date(weekStart + 6 * DAY_MS);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return start.getMonth() === end.getMonth()
      ? `${fmt(start)} – ${end.getDate()}`
      : `${fmt(start)} – ${fmt(end)}`;
  }, [weekStart]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>

        {/* Header — matches the Moving modal pattern */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Ionicons name="close" size={28} color={textColor} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>Release Calendar</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Week navigation */}
        <View style={styles.weekNav}>
          <TouchableOpacity style={styles.weekArrow} onPress={() => setWeekStart(w => w - WEEK_MS)}>
            <Ionicons name="chevron-back" size={22} color={accentColor} />
          </TouchableOpacity>
          <Text style={[styles.weekLabel, { color: textColor }]}>{weekLabel}</Text>
          <TouchableOpacity style={styles.weekArrow} onPress={() => setWeekStart(w => w + WEEK_MS)}>
            <Ionicons name="chevron-forward" size={22} color={accentColor} />
          </TouchableOpacity>
        </View>

        {isFetching ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : unavailable ? (
          <View style={styles.centerState}>
            <Ionicons name="cloud-offline-outline" size={28} color="#888" style={{ marginBottom: 8 }} />
            <Text style={styles.stateText}>Couldn't load the release schedule.</Text>
            <TouchableOpacity
              onPress={() => setRetryCount(c => c + 1)}
              style={[styles.retryButton, { borderColor: accentColor }]}
            >
              <Ionicons name="refresh" size={14} color={accentColor} style={{ marginRight: 6 }} />
              <Text style={{ color: accentColor, fontSize: 13, fontWeight: 'bold' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (items ?? []).length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons name="calendar-clear-outline" size={40} color="#888" />
            <Text style={[styles.stateText, { marginTop: 10 }]}>No releases this week for the anime on your list.</Text>
            <Text style={[styles.stateText, { fontSize: 12 }]}>Only shows that are currently airing and match a list entry appear here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            {/* Full week, fits the screen — 7 equal columns, no swiping */}
            <View style={styles.columnsRow}>
              {days.map((day: DayColumn, idx: number) => (
                <View
                  key={idx}
                  style={[styles.dayColumn, day.isToday && { backgroundColor: accentColor + '14' }]}
                >
                  <View style={[styles.dayHeader, { backgroundColor: cardBg, borderColor }, day.isToday && { backgroundColor: accentColor, borderColor: accentColor }]}>
                    <Text style={[styles.dayName, { color: day.isToday ? '#fff' : '#888' }]}>{day.dayName.toUpperCase()}</Text>
                    <Text style={[styles.dayNum, { color: day.isToday ? '#fff' : textColor }]}>{day.dateNum}</Text>
                  </View>

                  {day.items.length === 0 && <Text style={styles.noReleases}>—</Text>}
                  {day.items.map((item: ScheduleItem, i: number) => (
                    <View key={i} style={styles.showCard}>
                      <View style={styles.coverWrap}>
                        {item.coverUrl ? (
                          <Image source={{ uri: item.coverUrl }} style={styles.cover} />
                        ) : (
                          <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: borderColor }]}>
                            <Ionicons name="image-outline" size={18} color="#888" />
                          </View>
                        )}
                        <View style={styles.epBadge}>
                          <Text style={styles.epText}>EP {item.episode}</Text>
                        </View>
                      </View>
                      <Text style={[styles.showTitle, { color: textColor }]} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.showTime}>{formatTime(item.airingAt)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        )}

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1 },
  closeBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },

  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12 },
  weekArrow: { padding: 8 },
  weekLabel: { fontSize: 16, fontWeight: 'bold' },

  // The whole week in one row — each day takes an equal slice of the screen.
  columnsRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8 },
  dayColumn: { flex: 1, borderRadius: 8 },

  dayHeader: { borderRadius: 8, borderWidth: 1, alignItems: 'center', paddingVertical: 6, marginBottom: 10 },
  dayName: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  dayNum: { fontSize: 16, fontWeight: 'bold', marginTop: 1 },
  noReleases: { color: '#888', textAlign: 'center', padding: 8, fontSize: 12 },

  showCard: { marginBottom: 10, alignItems: 'center' },
  coverWrap: { borderRadius: 6, overflow: 'hidden', width: '100%' },
  cover: { width: '100%', aspectRatio: 2 / 3 },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  epBadge: { position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  epText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  showTitle: { fontSize: 9, fontWeight: '600', marginTop: 3, textAlign: 'center', lineHeight: 11 },
  showTime: { color: '#888', fontSize: 8, marginTop: 1 },

  centerState: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  stateText: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 4 },
  retryButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, marginTop: 8 },
});