/* Rede X — Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyAbc_DWHKEambENHQUTFpWLrQxWqkq8Imw",
  authDomain: "rede-x.firebaseapp.com",
  databaseURL: "https://rede-x-default-rtdb.firebaseio.com",
  projectId: "rede-x",
  storageBucket: "rede-x.firebasestorage.app",
  messagingSenderId: "599992301936",
  appId: "1:599992301936:web:3a7656cf52732bd076b7b5"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
