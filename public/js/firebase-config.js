// Adicione suas credenciais do Firebase aqui
const firebaseConfig = {
  apiKey: "AIzaSyAxJfy5ySsE74lE2TiTCgMRUMc5DzAs1kg",
  authDomain: "novo-2fecd.firebaseapp.com",
  projectId: "novo-2fecd",
  storageBucket: "novo-2fecd.appspot.com",
  messagingSenderId: "549786724527",
  appId: "1:549786724527:web:dfb8a8bad9e83973d04c5a"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
