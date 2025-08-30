const App = require('./config/app');
const database = require('./config/database');

require('dotenv').config();

async function startServer () {
    try {
        await database.connect();
        
        const app = new App();
        app.start();

        process.on('SIGTERM', async () => {
            console.log('Signal terminated. shutting the server down...');
            await database.close();
            process.exit(0);
        });

        process.on('SIGINT', async() => {
            console.log('Signal interrupted. Shutting the server down...');
            await database.close();
            process.exit(0);
        })
    } catch(err) {
        console.error('Failed to start server:', err.message);
    }
}

/* Only start the server via this module */
if (require.main === module) {
    startServer();
}

module.exports = { startServer }