const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 8000;

/* Middlewares */
app.use(helmet())
app.use(express.json());

// cross origin requests
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
    ? ['']  // production url 
    : ['http://localhost:3000'], // React client url 
    credentials: true
}));

// Request parsing
app.use(express.json({ limit: '20mb'}));
app.use(express.urlencoded({extended: true, limit: '20mb'}));


// Request Logging => log monitoring and debugging
app.use(morgan('combined', {
    stream: {write: message => Logger.info(message.trim())}
}))

/* Routes */

// add app.use('/jobs', jobRouter); later
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});