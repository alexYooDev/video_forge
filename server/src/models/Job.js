const pool = require('../scripts/db.js');

exports.getAllSavedVideos = async (searchQuery) => { 
    const conn = await pool.getConnection();
};

