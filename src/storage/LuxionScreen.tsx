import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';

// Paste your Groq API key here for testing:
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function LuxionScreen() {
  const { theme, accentColor, animeList } = useAppContext();
  const navigation = useNavigation();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello! I am Luxion. Ask me about your anime list or ask for a recommendation!' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const bgColor = theme === 'Dark' ? '#18181A' : '#f8f9fa';
  const textColor = theme === 'Dark' ? '#fff' : '#000';
  const inputBg = theme === 'Dark' ? '#212124' : '#fff';
  const borderColor = theme === 'Dark' ? '#333' : '#ddd';

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // 1. CONTEXT INJECTION: We map over your list and only extract what Luxion needs so we don't waste tokens on image URIs.
    const condensedList = animeList.map(a => ({ title: a.title, status: a.status, rating: a.rating }));
    
    // 2. THE SYSTEM PROMPT: This dictates Luxion's personality and feeds him your data.
    const systemPrompt = `You are Luxion, a helpful, concise, and highly intelligent AI anime assistant. 
    Here is the user's current anime list data: ${JSON.stringify(condensedList)}. 
    If they ask if they have watched something, check this list. 
    If they ask for recommendations, suggest an anime NOT on this list that has a similar vibe to the ones they rated highly (4 or 5 stars). 
    Keep your answers relatively short and conversational.`;

    // 3. Prepare the message history for Groq
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage.content }
    ];

    try {
      // 4. Call the Groq API (Using the ultra-fast Llama 3 model)
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192', // Fast and highly capable model
          messages: apiMessages,
          temperature: 0.7,
        })
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0].message) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.choices[0].message.content
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error('Invalid response from Luxion');
      }

    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, I am having trouble connecting to the network right now.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? [styles.userBubble, { backgroundColor: accentColor }] : [styles.botBubble, { backgroundColor: inputBg, borderColor }]]}>
        <Text style={{ color: isUser ? '#fff' : textColor, fontSize: 16, lineHeight: 22 }}>
          {item.content}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10 }}>
            <Ionicons name="arrow-back" size={26} color={textColor} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="hardware-chip" size={24} color={accentColor} style={{ marginRight: 8 }} />
            <Text style={[styles.headerText, { color: textColor }]}>Luxion</Text>
          </View>
          <View style={{ width: 46 }} />
        </View>

        {/* CHAT AREA */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* INPUT AREA */}
        <View style={[styles.inputContainer, { backgroundColor: bgColor, borderTopColor: borderColor }]}>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Ask Luxion something..."
            placeholderTextColor="#888"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: input.trim() ? accentColor : '#555' }]} 
            onPress={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 5, borderBottomWidth: 1 },
  headerText: { fontSize: 22, fontWeight: 'bold' },
  
  messageBubble: { maxWidth: '80%', padding: 14, borderRadius: 18, marginBottom: 15 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  botBubble: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  
  inputContainer: { flexDirection: 'row', padding: 15, borderTopWidth: 1, alignItems: 'center' },
  input: { flex: 1, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 20, borderWidth: 1, fontSize: 16, marginRight: 10 },
  sendButton: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' }
});