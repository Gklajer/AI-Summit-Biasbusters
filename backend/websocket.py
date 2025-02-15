const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Lancer le serveur sur le port 5000
server.listen(5000, () => {
  console.log("Serveur WebSocket démarré sur ws://localhost:5000");
});

// Quand un client se connecte via WebSocket
io.on("connection", (socket) => {
  console.log("Un client est connecté");

  // Écouter les messages d'enregistrement audio
  socket.on("audioStart", () => {
    console.log("Début de l'enregistrement");
    // Vous pouvez implémenter des logiques ici pour démarrer l'enregistrement
  });

  socket.on("audioChunk", (data) => {
    console.log("Enregistrement audio en cours...");
    // Vous pouvez stocker ou traiter le chunk audio ici
    console.log(data); // Affiche les données audio en Base64
  });

  socket.on("audioEnd", () => {
    console.log("Fin de l'enregistrement");
    // Vous pouvez implémenter des logiques pour traiter la fin de l'enregistrement ici
  });

  // Écouter une question du client et envoyer une réponse
  socket.on("askForMoreInfo", (data) => {
    console.log("Demande de plus d'informations reçue :", data);

    // Répondre avec une question ou une information
    socket.emit("serverResponse", {
      nom_fonction: "askForMoreInfo",
      arguments: ["Plus d'infos nécessaires !"],
    });
  });

  // Écouter des messages de commande générale
  socket.on("sendMessage", (message) => {
    console.log("Message reçu du client:", message);

    // Exemple de réponse basée sur le message
    if (message.includes("question")) {
      socket.emit("serverResponse", {
        nom_fonction: "askForMoreInfo",
        arguments: ["Peux-tu préciser ta question ?"],
      });
    } else {
      socket.emit("serverResponse", {
        nom_fonction: "answer",
        arguments: ["Voici la réponse à ta question."],
      });
    }
  });

  // Déconnexion d'un client
  socket.on("disconnect", () => {
    console.log("Un client s'est déconnecté");
  });
});
