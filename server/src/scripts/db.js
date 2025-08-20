const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'transcoder',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'trailder_transcoder',
    connectionLimit: 5,
});

// DB Init Logic => Connect to MariaDB and Create initial tables 

(async() => {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connection Successful!');
        await conn.query(`

            CREATE TABLE users (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transcoder_jobs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                input_source VARCHAR(1024),
                video_id VARCHAR(255),
                video_title VARCHAR(512),
                video_tags TEXT,
                status ENUM('PENDING','DOWNLOADING','PROCESSING','UPLOADING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
                progress INT DEFAULT 0,
                error_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE media_assets (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                job_id BIGINT NOT NULL,
                asset_type ENUM ('TRANSCODE_1080', 'TRANSCODE_720', 'TRANSCODE_480', 'GIF', 'THUMBNAIL', 'METADATA_JSON') NOT NULL,
                path VARCHAR(1024) NOT NULL,
                size_bytes BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            )
        `);
    } catch(err) {
        console.log('DB initialization failed.', err.message);
    } finally {
        if (conn) {
            conn.release();
            console.log('Releasing connection...');
        }
    }
})();

module.exports = pool;