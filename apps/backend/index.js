require('dotenv').config();

const express = require('express');
const app = express();

const connectDB = require('./config/db');

// 1. Connect to database
connectDB();

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});