import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

// Splash screen is normally hidden by MainApp once data has loaded. If the crash happens before
// that, MainApp never gets to do it and the splash would keep covering the fallback screen.
// Same call MainApp already uses; wrapped so a failure here can never break the boundary itself.
const hideSplashSafely = async () => {
  try {
    await SplashScreen.hideAsync();
  } catch {
    // already hidden / not registered — nothing to do
  }
};

// React only supports error boundaries as class components (there is no hooks equivalent).
// Catches errors thrown while RENDERING (and in lifecycle methods/constructors) of everything
// below it. It does NOT catch errors in event handlers or async code (fetch, AsyncStorage,
// timers) — those still need their own try/catch, which this app already has.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack);
    hideSplashSafely();
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Deliberately static colors and no context hooks: if AppProvider is what crashed,
    // anything that depends on it would crash here too.
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          Mirisu hit an unexpected error. Tap Try again, or close and reopen the app.
        </Text>
        <TouchableOpacity style={styles.button} onPress={this.handleRetry} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
        <Text style={styles.details} numberOfLines={4}>
          {String(error?.message ?? error)}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181A', alignItems: 'center', justifyContent: 'center', padding: 30 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  message: { color: '#aaa', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  button: { backgroundColor: '#4FA4FF', paddingVertical: 14, paddingHorizontal: 36, borderRadius: 12, marginBottom: 28 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  details: { color: '#666', fontSize: 12, textAlign: 'center' },
});