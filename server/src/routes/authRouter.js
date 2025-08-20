const router = require('express').Router;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const  db = require('../scripts/db');

router.post('/login', async (req, res) => {
    const {email, password} = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({success: false, error: 'Invalid Credentials'});
    } 
    
    const token = jwt.sign({sub: user.id, email}, process.env.JWT_SECRET, {expiresIn: '12h'});
    res.json({success: true, data: {token}})
});