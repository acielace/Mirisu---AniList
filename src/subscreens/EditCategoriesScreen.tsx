import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Modal, TextInput, Alert, Animated, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';

export default function EditCategoriesScreen() {
  const { 
    theme, customCategories, setCustomCategories, 
    hiddenCategories, setHiddenCategories, 
    animeList, setAnimeList 
  } = useAppContext();
  
  const navigation = useNavigation<any>();

  const [addCatVisible, setAddCatVisible] = useState(false);
  const [editCatVisible, setEditCatVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatName, setEditingCatName] = useState('');

  const bgColor = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const rowBgColor = theme === 'Dark' ? '#212124' : '#fff';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const cardColor = theme === 'Dark' ? '#1A1A1A' : '#f0f0f0';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  const actionAnim = useRef(new Animated.Value(800)).current;

  const openSheet = (setVis: Function) => {
    setVis(true);
    Animated.timing(actionAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeSheet = (setVis: Function) => {
    Animated.timing(actionAnim, { toValue: 800, duration: 250, useNativeDriver: true }).start(() => setVis(false));
  };

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const allCats = ['Watched', 'Will Watch', 'Dropped', ...customCategories].map(c => c.toLowerCase());
    if (allCats.includes(trimmed.toLowerCase())) {
      Alert.alert('Error', 'Category already exists.');
      return;
    }
    setCustomCategories([...customCategories, trimmed]);
    setNewCatName('');
    closeSheet(setAddCatVisible);
  };

  const handleEditCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed || trimmed === editingCatName) {
      closeSheet(setEditCatVisible);
      return;
    }
    const allCats = ['Watched', 'Will Watch', 'Dropped', ...customCategories].map(c => c.toLowerCase());
    if (allCats.includes(trimmed.toLowerCase())) {
      Alert.alert('Error', 'Category name already exists.');
      return;
    }

    setCustomCategories(customCategories.map(c => c === editingCatName ? trimmed : c));
    
    if (hiddenCategories.includes(editingCatName)) {
      setHiddenCategories(hiddenCategories.map(c => c === editingCatName ? trimmed : c));
    }

    const updatedAnime = animeList.map(a => ({
      ...a,
      categories: a.categories.map(c => c === editingCatName ? trimmed : c),
      status: a.status === editingCatName ? trimmed : a.status
    }));
    setAnimeList(updatedAnime);

    setNewCatName('');
    closeSheet(setEditCatVisible);
  };

  const handleRemoveCategory = (catToRemove: string) => {
    Alert.alert("Delete Category", `Are you sure you want to delete "${catToRemove}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
          setCustomCategories(customCategories.filter(c => c !== catToRemove));
          setHiddenCategories(hiddenCategories.filter(c => c !== catToRemove));
      }}
    ]);
  };

  const toggleVisibility = (cat: string) => {
    if (hiddenCategories.includes(cat)) {
      setHiddenCategories(hiddenCategories.filter(c => c !== cat));
    } else {
      setHiddenCategories([...hiddenCategories, cat]);
    }
  };

  const onReordered = async (fromIndex: number, toIndex: number) => {
    const copy = [...customCategories];
    const removed = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, removed[0]);
    setCustomCategories(copy);
  };

  const renderItem = ({ item, onDragStart, onDragEnd, isActive }: DragListRenderItemInfo<string>) => {
    return (
      <View style={[styles.editCatRow, { backgroundColor: isActive ? '#333' : rowBgColor }]}>
        
        <TouchableOpacity onPressIn={onDragStart} onPressOut={onDragEnd} style={{ paddingRight: 15 }}>
          <Ionicons name="reorder-two" size={32} color={theme === 'Dark' ? '#ccc' : '#888'} />
        </TouchableOpacity>
        
        <Text style={[styles.editCatTitle, { color: textColor }]} numberOfLines={1}>{item}</Text>
        
        <TouchableOpacity onPress={() => { setEditingCatName(item); setNewCatName(item); openSheet(setEditCatVisible); }} style={styles.editIconBtn}>
          <Ionicons name="pencil" size={20} color={theme === 'Dark' ? '#ccc' : '#888'} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => toggleVisibility(item)} style={styles.editIconBtn}>
          <Ionicons name={hiddenCategories.includes(item) ? "eye-off" : "eye"} size={22} color={theme === 'Dark' ? '#ccc' : '#888'} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => handleRemoveCategory(item)} style={styles.editIconBtn}>
          <Ionicons name="trash-outline" size={22} color={theme === 'Dark' ? '#ccc' : '#888'} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    // FIX: Added dynamic paddingTop for Android status bar
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('My List')} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={26} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: textColor }]}>Edit categories</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 15 }}>
        {customCategories.length === 0 ? (
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 50 }}>No custom categories yet. Tap Add below!</Text>
        ) : (
          <DragList
            data={customCategories}
            keyExtractor={(item) => item}
            onReordered={onReordered}
            renderItem={renderItem}
            containerStyle={{ flex: 1 }}
            // FIX: Added paddingBottom so the last item clears the floating action button
            contentContainerStyle={{ paddingBottom: 100 }} 
          />
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => { setNewCatName(''); openSheet(setAddCatVisible); }}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabText}>Add</Text>
      </TouchableOpacity>

      <Modal animationType="fade" transparent={true} visible={addCatVisible} onRequestClose={() => closeSheet(setAddCatVisible)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => closeSheet(setAddCatVisible)}>
          <Animated.View onStartShouldSetResponder={() => true} style={[styles.sheetContent, { backgroundColor: cardColor, borderColor, transform: [{ translateY: actionAnim }] }]}>
            <View style={styles.dragIndicator} />
            <Text style={[styles.sectionTitle, { color: textColor, marginTop: 0 }]}>New Category</Text>
            <TextInput
              style={[styles.inputField, { color: textColor, borderColor }]}
              placeholder="e.g., Favorites, Watching, On Hold"
              placeholderTextColor="#888"
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => closeSheet(setAddCatVisible)} style={styles.modalBtn}><Text style={{ color: '#888', fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleAddCategory} style={styles.modalBtn}><Text style={{ color: '#4FA4FF', fontWeight: 'bold' }}>Add</Text></TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={editCatVisible} onRequestClose={() => closeSheet(setEditCatVisible)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => closeSheet(setEditCatVisible)}>
          <Animated.View onStartShouldSetResponder={() => true} style={[styles.sheetContent, { backgroundColor: cardColor, borderColor, transform: [{ translateY: actionAnim }] }]}>
            <View style={styles.dragIndicator} />
            <Text style={[styles.sectionTitle, { color: textColor, marginTop: 0 }]}>Rename Category</Text>
            <TextInput
              style={[styles.inputField, { color: textColor, borderColor }]}
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => closeSheet(setEditCatVisible)} style={styles.modalBtn}><Text style={{ color: '#888', fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleEditCategory} style={styles.modalBtn}><Text style={{ color: '#4FA4FF', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // FIX: Added a slight top margin to the header to breathe a bit more below the status bar
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, marginBottom: 15, marginTop: 5 },
  headerText: { fontSize: 22, marginLeft: 10 },
  editCatRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 12, marginBottom: 12 },
  editCatTitle: { flex: 1, fontSize: 16 },
  editIconBtn: { padding: 8, marginLeft: 5 },
  fab: { position: 'absolute', bottom: 60, right: 20, backgroundColor: '#005BB5', flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 22, borderRadius: 16, elevation: 5 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, borderWidth: 1, maxHeight: '85%' },
  dragIndicator: { width: 40, height: 5, backgroundColor: '#888', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  inputField: { width: '100%', borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%', gap: 20 },
  modalBtn: { padding: 10 }
});