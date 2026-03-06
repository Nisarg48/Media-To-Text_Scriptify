require('dotenv').config();

const express = require('express');
const { json } = require('body-parser');
const cors = require('cors');
const app = express();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const transcriptRoutes = require('./routes/transcriptRoutes');

// 1. Connect to database
connectDB();

// 2. Middleware
app.use(cors());
app.use(json());

// 3. Authentication Routes
app.use('/api/auth', authRoutes);

// 4. Media Routes
app.use('/api/media', mediaRoutes);

// 5. Transcript Routes
app.use('/api/transcripts', transcriptRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});