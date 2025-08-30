
const database = require('../config/database');
const bcrypt = require('bcryptjs');

async function seedDB() {
    try {
        await database.connect();

        console.log('Seeding database...');

        const salt = 10;
        const hashedPassword = await bcrypt.hash('password123', salt);

        const users = [
            {
                email: 'user@test.com',
                password: hashedPassword
            }
        ]

        for (const user of users) {
            try {
                await database.query(
                    'INSERT INTO users (email, password) VALUES (?, ?)',
                    [user.email, user.password]
                );
            } catch (err) {
                console.log(`Error: User already exits: ${user.email}`, err.message);
            }
        }

        const sampleJob = {
          user_id: 1,
          input_source:
            'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          status: 'PENDING',
        };

        try {
            const result = await db.query(
                'INSERT INTO jobs (user_id, input_source, status) VALUES (?, ?, ?)',
                [sampleJob.user_id, sampleJob.input_source, sampleJob.status]
            );
            console.log(`Created sample job with ID: ${result.insertId}`);
        } catch (err) {
            console.log('Sample job already exists');
        }

        console.log('Database seeding completed');

    } catch(err) {
        console.error('Seeding failed', err.message);
    } finally {
        await database.close();
    }
}

if (require.main === module) {
    seedDB();
}

module.exports = seedDB;