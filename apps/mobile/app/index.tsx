import { Text, View, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { formatGreeting } from '@/lib/env'

export default function HomeScreen() {
  const greeting = formatGreeting(new Date().getHours())
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NutriOS</Text>
      <Text style={styles.subtitle}>{greeting}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    color: '#555',
  },
})
