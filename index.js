const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const mongoURI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-nbsuiui-shard-00-00.1eul2tk.mongodb.net:27017,ac-nbsuiui-shard-00-01.1eul2tk.mongodb.net:27017,ac-nbsuiui-shard-00-02.1eul2tk.mongodb.net:27017/myDatabase?ssl=true&replicaSet=atlas-22ujl6-shard-0&authSource=admin&retryWrites=true&w=majority`;

mongoose
  .connect(mongoURI)
  .then(() => console.log('MongoDB Connected Successfully!'))
  .catch(err => console.log('MongoDB Connection Error:', err));

app.get('/', (req, res) => {
  res.send('MERN Backend Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
