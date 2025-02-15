import React, { useState, useEffect, useRef } from "react";
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
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { io } from "socket.io-client";

// URL du serveur WebSocket
const SERVER_URL = "ws://ton-serveur:3000";

export default function Index() {
  const [messages, setMessages] = useState([]); // Liste des messages
  const [isChatActive, setIsChatActive] = useState(false); // Active le mode chat après le premier message
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [socket, setSocket] = useState(null);
  const [pendingQuestion, setPendingQuestion] = useState(""); // Stocke la question intermédiaire du serveur

  // Animation pour agrandir/réduire le bouton
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on("serverResponse", async (data) => {
      console.log("Réponse du serveur reçue :", data);

      if (data.nom_fonction === "askForMoreInfo") {
        // Cas où le serveur demande une info supplémentaire
        setPendingQuestion(`Besoin d'une précision: ${JSON.stringify(data.arguments)}`);
      } else {
        // Cas d'une réponse finale nécessitant un calcul puis on joue le son
        const result = await processFinalResponse(data);
        await playSound(result);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fonction pour traiter la réponse finale du serveur
  const processFinalResponse = async (data) => {
    console.log("Traitement de la réponse finale :", data);
        return "0"; // exemple
    }

  // 🎤 Démarrer l'enregistrement avec animation
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

      // 🔴 Animation d'agrandissement
      Animated.timing(scaleAnim, {
        toValue: 5, // Le bouton va couvrir tout l'écran
        duration: 500,
        useNativeDriver: true,
      }).start();
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

    // 🔵 Animation de réduction
    Animated.timing(scaleAnim, {
      toValue: 1, // Retour à la taille normale
      duration: 500,
      useNativeDriver: true,
    }).start();
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

      const response = await fetch("http://51.159.179.28:5000/upload", {
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

  // 🔊 Jouer un son en fonction du résultat
  const playSound = async (id: string) => {
    const sounds = {
      "0": require("./audios/door.wav"),
      "1": require("./audios/gun.wav"),
    };

    const soundFile = sounds[id];

    if (!soundFile) {
      console.warn("Aucun son trouvé pour l'ID:", id);
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(soundFile);
      await sound.playAsync();
    } catch (error) {
      console.error("Erreur lecture son:", error);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 60}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>

          {/* 🎤 Bouton Microphone avec animation */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.microphoneBox, isRecording && styles.recording]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Ionicons name="mic" size={40} color="white" />
            </TouchableOpacity>
          </Animated.View>

          {/* Affichage de la question intermédiaire si présente */}
          {pendingQuestion ? (
            <View style={styles.pendingQuestionContainer}>
              <Text style={styles.pendingQuestionText}>{pendingQuestion}</Text>
            </View>
          ) : null}

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
    width: 150,
    height: 150,
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 100,
    marginTop: 20,
  },
  recording: {
    backgroundColor: "darkred",
  },
  pendingQuestionContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#FFD700",
    borderRadius: 10,
  },
  pendingQuestionText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

