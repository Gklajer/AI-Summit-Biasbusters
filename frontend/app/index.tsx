import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";

export default function Index() {
  const [messages, setMessages] = useState([]); // Liste des messages
  const [isChatActive, setIsChatActive] = useState(false); // Active le mode chat après le premier message
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // 🎤 Démarrer l'enregistrement
  const startRecording = async () => {
    try {
      console.log("Démarrage de l'enregistrement...");
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        alert("Permission d'accès au micro refusée");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
    }
  };

  // 🛑 Arrêter l'enregistrement et envoyer le fichier
  const stopRecording = async () => {
    console.log("Arrêt de l'enregistrement...");
    if (!recording) return;
    
    setIsRecording(false);
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    console.log("Fichier audio enregistré :", uri);
    setRecording(null);

    if (uri) {
      await sendAudioToServer(uri);
    }
  };

  // 📤 Envoyer l'audio au serveur
  const sendAudioToServer = async (uri: string) => {
    try {
      const formData = new FormData();
      formData.append("audio", {
        uri,
        name: "audio_recording.wav",
        type: "audio/wav",
      });

      const response = await fetch("https://votre-serveur.com/upload", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      if (response.ok) {
        console.log("Audio envoyé avec succès !");
      } else {
        console.error("Erreur lors de l'envoi de l'audio :", await response.text());
      }
    } catch (error) {
      console.error("Erreur de requête :", error);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}       
    keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 60}
    style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          
          {/* 🎤 Bouton Microphone */}
          <TouchableOpacity
            style={[styles.microphoneBox, isRecording && styles.recording]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Ionicons name="mic" size={40} color="white" />
          </TouchableOpacity>

          {isChatActive && (
            <ScrollView style={styles.chatContainer} contentContainerStyle={{ flexGrow: 1 }}>
              {messages.map((item) => (
                <View key={item.id} style={[styles.messageBubble, item.sender === "user" ? styles.userMessage : styles.botMessage]}>
                  <Text style={styles.messageText}>{item.text}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

// 💡 Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, justifyContent: "center", alignItems: "center" },
  microphoneBox: {
    width: 250,
    height: 150,
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
    marginTop: 20,
  },
  recording: {
    backgroundColor: "darkred",
  },
  chatContainer: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 20,
    marginTop: 10,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    maxWidth: "80%",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#DCF8C6",
  },
  botMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#E5E5EA",
  },
  messageText: {
    fontSize: 16,
  },
});
