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
import { io, Socket} from "socket.io-client";

// URL du serveur WebSocket
const SERVER_URL = "ws://51.159.159.241:5000";

export default function Index() {
  const [messages, setMessages] = useState([]); 
  const [isChatActive, setIsChatActive] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
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
        console.log(result)
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

      // Envoi d'un message de début d'enregistrement au serveur
      if (socket) {
        console.log("Envoi d'un message de début d'enregistrement au serveur");
        socket.emit("audioStart");
      }

      Animated.timing(scaleAnim, {
        toValue: 5,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Capture et envoi des chunks audio en continu
      // const interval = setInterval(async () => {
      //   if (newRecording) {
      //     console.log("Enregistrement en cours...");
      //     const { sound, status } = await newRecording.createNewLoadedSoundAsync();
      //     console.log('status', status);
      //     if (status.isLoaded) {
      //       const audioBase64 = await convertToBase64(newRecording);
      //       console.log("Chunk audio converti en Base64 :", audioBase64.length);
      //       if (socket) {
      //         console.log("Envoi d'un chunk audio au serveur");
      //         socket.emit("audioChunk", { data: audioBase64 });
      //       }
      //     }
      //   }
      // }, 1000);

      const interval = setInterval(async () => {
        if (newRecording) {
          try {
            const status = await newRecording.getStatusAsync();
            console.log('Status de l\'enregistrement:', status);
            
            // Envoyer le chunk si l'enregistrement est en cours
            if (status.isRecording) {  // Changed from isDoneRecording to isRecording
              const audioBase64 = await convertToBase64(newRecording);
              if (socket && audioBase64) {
                console.log("Envoi d'un chunk audio au serveur");
                socket.emit("audioChunk", { data: audioBase64 });
              }
            }
          } catch (error) {
            console.error("Erreur:", error);
          }
        }
      }, 1000);

      newRecording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) {
          clearInterval(interval);
        }
      });

    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();

    // Envoi d'un message de fin d'enregistrement au serveur
    if (socket) {
      socket.emit("audioEnd");
    }

    setRecording(null);

    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const convertToBase64 = async (recording) => {
    try {
      const uri = recording.getURI();
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Erreur conversion Base64 :", error);
      return null;
    }
  };

  const playSound = async (id: string) => {
    const sounds: { [key: string]: any } = {
      "0": require("./audios/gun.wav"),
      "1": require("./audios/door.wav"),
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
    const images: { [key: string]: any } = {
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
