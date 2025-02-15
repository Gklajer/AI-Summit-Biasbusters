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
  Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { io } from "socket.io-client";

// URL du serveur WebSocket
const SERVER_URL = "ws://51.159.179.28:5000";

export default function Index() {
  const [messages, setMessages] = useState([]); 
  const [isChatActive, setIsChatActive] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [socket, setSocket] = useState(null);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [activeResource, setActiveResource] = useState(null); 

  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on("serverResponse", async (data) => {
      console.log("Réponse du serveur reçue :", data);

      if (data.nom_fonction === "askForMoreInfo") {
        setPendingQuestion(`Besoin d'une précision: ${JSON.stringify(data.arguments)}`);
        setIsChatActive(true);
      } else {
        const result = await processFinalResponse(data);
        await playSound(result);
        showAnimation(result);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const processFinalResponse = async (data) => {
    console.log("Réponse finale reçue :", data);
    return "0"; // Son par défaut
  };

  const startRecording = async () => {
    try {
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

      Animated.timing(scaleAnim, {
        toValue: 5,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      await sendAudioToServer(uri);
    }

    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

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

  const playSound = async (id: string) => {
    const sounds = {
      "0": require("./audios/eau.wav"),
      "1": require("./audios/massage_cardiaque.wav"),
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

  const showAnimation = (id: string) => {
    const images = {
      "0": require("./images/banana.gif"),
      "1": require("./images/santa.gif"),
    };

    setActiveResource(images[id]);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 60}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          {activeResource ? (
            <Animated.Image source={activeResource} style={[styles.animationImage, { opacity: imageOpacity }]} />
          ) : (
            <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
              <TouchableOpacity
                style={[styles.microphoneBox, isRecording && styles.recording]}
                onPressIn={startRecording}
                onPressOut={stopRecording}
              >
                <Ionicons name="mic" size={40} color="white" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {isChatActive && (
            <ScrollView style={styles.chatContainer} contentContainerStyle={{ flexGrow: 1 }}>
              <View style={styles.messageBubble}>
                <Text style={styles.messageText}>{pendingQuestion}</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, justifyContent: "center", alignItems: "center" },
  microphoneBox: { width: 150, height: 150, backgroundColor: "red", justifyContent: "center", alignItems: "center", borderRadius: 100, marginTop: 20 },
  recording: { backgroundColor: "darkred" },
  animationImage: { width: 300, height: 300, resizeMode: "contain" },
  chatContainer: { flex: 1, width: "100%", paddingHorizontal: 20, marginTop: 10 },
  messageBubble: { padding: 10, borderRadius: 10, backgroundColor: "#E5E5EA", marginBottom: 10, maxWidth: "80%" },
  messageText: { fontSize: 16 },
});
