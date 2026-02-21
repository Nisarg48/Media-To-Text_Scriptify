require('dotenv').config();

const express = require('express');
const app = express();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');

// 1. Connect to database
connectDB();

// 2. Middleware
app.use(express.json());

// 3. Authentication Routes
app.use('/api/auth', authRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});