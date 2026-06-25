import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Image, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useAppContext } from '../context/AppContext';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function LuxionChat() {
  const { theme, accentColor, animeList } = useAppContext();

  const bgColor = theme === 'Dark' ? '#000' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const tabBg = theme === 'Dark' ? '#000' : '#fff';
  const cardBg = theme === 'Dark' ? '#1A1A1A' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  const defaultGreeting: Message = { id: '1', role: 'assistant', content: 'Hey there! I am Luxion! Ask me for a recommendation or let\'s chat about what is on your list!' };

  const [isLuxionVisible, setIsLuxionVisible] = useState(false);
  const [luxionInput, setLuxionInput] = useState('');
  const [isLuxionLoading, setIsLuxionLoading] = useState(false);
  const [trendingAnime, setTrendingAnime] = useState<string>(''); 
  const [luxionMessages, setLuxionMessages] = useState<Message[]>([defaultGreeting]);
  const chatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (isLuxionVisible) {
      const loadHistory = async () => {
        try {
          const savedData = await AsyncStorage.getItem('@luxion_history');
          if (savedData) {
            // Strip out any old tool logic that might have gotten saved previously
            const parsed = JSON.parse(savedData).filter((m: any) => m.role !== 'tool' && !m.tool_calls);
            setLuxionMessages(parsed.length > 0 ? parsed : [defaultGreeting]);
          } else {
            setLuxionMessages([defaultGreeting]);
          }
        } catch (e) {
          console.log("Failed to load Luxion memory:", e);
        }
      };
      loadHistory();

      if (!trendingAnime) {
        const fetchTrending = async () => {
          try {
            const query = `
              query {
                Page(page: 1, perPage: 10) {
                  media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
                    title { english romaji }
                  }
                }
              }
            `;
            const res = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ query })
            });
            const json = await res.json();
            if (json.data && json.data.Page && json.data.Page.media) {
              const titles = json.data.Page.media.map((a: any) => a.title.english || a.title.romaji).join(', ');
              setTrendingAnime(titles);
            }
          } catch (e) {
            console.log("Failed to fetch trending anime:", e);
          }
        };
        fetchTrending();
      }
    }
  }, [isLuxionVisible]);

  useEffect(() => {
    if (isLuxionVisible) {
      AsyncStorage.setItem('@luxion_history', JSON.stringify(luxionMessages)).catch(e => console.log("Failed to save memory:", e));
    }
  }, [luxionMessages, isLuxionVisible]);

  const sendLuxionMessage = async () => {
    if (!luxionInput.trim() || isLuxionLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: luxionInput.trim() };
    setLuxionMessages(prev => [...prev, userMessage]);
    setLuxionInput('');
    setIsLuxionLoading(true);

    const miniList = animeList.map(a => `${a.title} (${a.status} - ${a.rating}/5)`).join(' | ');

    // --- REVERTED TO FRIENDLY CONVERSATIONALIST + HONESTY RULE ---
    const systemPrompt = `You are Luxion, a super friendly, upbeat, and enthusiastic AI anime companion!
    
    STRICT RULES:
    1. ONLY discuss anime, manga, light novels, and the user's provided list.
    2. If the user asks about ANY other topic, politely and playfully refuse, and steer the conversation back to anime.
    3. You naturally understand multiple languages. Reply naturally in the EXACT same language the user speaks.
    4. Keep responses highly conversational, warm, and concise for a mobile chat interface.
    5. NEVER use markdown formatting like asterisks (* or **), underscores (_), or tildes (~~). Output plain text only.
    
    6. THE HONESTY RULE: If the user asks you a factual question about an anime (like plot, release date, or characters) and you do not know the answer with 100% certainty, you MUST simply say "I don't know, my creator is dumb so I am also dumb" or "I'm not entirely sure about that one, and i bet my creator doesn't know either" Do NOT guess or make up information.
    
    7. When asked to recommend or list an anime, you MUST use this exact plain-text format:
    1. [ Anime Title ]
    - Genre: [Insert Genre]
    - Rating: [/5]
    - [Super short 1 sentence description]
    
    LIVE CONTEXT UPDATE:
    The top trending/airing anime in the world right now are: ${trendingAnime || 'Unknown'}
    
    User's Anime List Data: ${miniList || 'Empty'}`;

    const cleanHistory = luxionMessages.map(m => ({ role: m.role, content: m.content })).slice(-6);

    const apiMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...cleanHistory,
      { role: 'user', content: userMessage.content }
    ];

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', // Keeping him on the smart model!
          messages: apiMessages,
          temperature: 0.7,
        })
      });
      
      const data = await response.json();
      if (!data.choices || data.error) throw new Error(data.error?.message || 'Unknown Groq API Error');

      let cleanText = data.choices[0].message.content.replace(/\*/g, '');
      setLuxionMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: cleanText }]);

    } catch (error: any) {
      console.error(error);
      setLuxionMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `[Error]: ${error.message}` }]);
    } finally {
      setIsLuxionLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.luxionFab, { backgroundColor: accentColor }]} 
        onPress={() => setIsLuxionVisible(true)}
      >
        <Image source={require('../../assets/luxion.png')} style={{ width: 60, height: 60, borderRadius: 22 }} />
      </TouchableOpacity>

      <Modal visible={isLuxionVisible} animationType="slide" transparent={true} onRequestClose={() => setIsLuxionVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={styles.modalOverlayDismiss} activeOpacity={1} onPress={() => setIsLuxionVisible(false)} />
          
          <View style={[styles.chatContainer, { backgroundColor: bgColor, borderColor }]}>
            <View style={[styles.chatHeader, { borderBottomColor: borderColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={require('../../assets/luxion.png')} style={{ width: 32, height: 32, borderRadius: 14, marginRight: 8 }} />
                <Text style={[styles.modalHeaderText, { color: textColor }]}>Luxion</Text>
              </View>
              <TouchableOpacity onPress={() => setIsLuxionVisible(false)}><Ionicons name="close" size={28} color={textColor} /></TouchableOpacity>
            </View>

            <FlatList
              ref={chatListRef}
              data={luxionMessages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 15 }}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => {
                if (item.role === 'system') return null; 
                const isUser = item.role === 'user';
                return (
                  <View style={[styles.messageBubble, isUser ? [styles.userBubble, { backgroundColor: accentColor }] : [styles.botBubble, { backgroundColor: cardBg, borderColor: borderColor }]]}>
                    <Text style={{ color: isUser ? '#fff' : textColor, fontSize: 15, lineHeight: 22 }}>
                      {item.content}
                    </Text>
                  </View>
                );
              }}
            />

            <View style={[styles.chatInputContainer, { borderTopColor: borderColor, backgroundColor: tabBg }]}>
              <TextInput
                style={[styles.chatInput, { backgroundColor: cardBg, color: textColor, borderColor }]}
                placeholder="Ask Luxion..."
                placeholderTextColor="#888"
                value={luxionInput}
                onChangeText={setLuxionInput}
                onSubmitEditing={sendLuxionMessage}
                returnKeyType="send"
              />
              <TouchableOpacity 
                style={[styles.chatSendButton, { backgroundColor: luxionInput.trim() ? accentColor : '#555' }]} 
                onPress={sendLuxionMessage} disabled={!luxionInput.trim() || isLuxionLoading}
              >
                {isLuxionLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  luxionFab: {
    position: 'absolute',
    bottom: 50,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 100
  },
  modalOverlayDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  chatContainer: { height: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
  modalHeaderText: { fontSize: 18, fontWeight: 'bold' },
  messageBubble: { maxWidth: '85%', padding: 14, borderRadius: 18, marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  botBubble: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  chatInputContainer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, alignItems: 'center' },
  chatInput: { flex: 1, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, borderWidth: 1, fontSize: 15, marginRight: 10 },
  chatSendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});