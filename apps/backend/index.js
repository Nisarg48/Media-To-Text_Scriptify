require('dotenv').config();

const connectDB = require('./config/db');
const { createApp } = require('./app');

const app = createApp();

connectDB().then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
});

module.exports = app;
