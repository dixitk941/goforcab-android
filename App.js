import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Alert, StatusBar, Appearance, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

const WebsiteContainer = () => {
  const handleShouldStartLoadWithRequest = (event) => {
    const { url } = event;
    logActivity(`Navigating to URL: ${url}`);
    return true;
  };

  const logActivity = (activity) => {
    console.log(activity);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.webviewContainer}>
        <WebView 
          source={{ uri: 'https://goforcab.com/' }} 
          style={styles.webview} 
          startInLoadingState
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        />
      </View>
    </SafeAreaView>
  );
};

const App = () => {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    // Request location permission
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      console.log(location);
    })();

    // Listen for color scheme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colorScheme === 'dark' ? '#000000' : '#ffffff'} 
      />
      <WebsiteContainer />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default App;