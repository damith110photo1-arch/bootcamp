require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Pool, Client } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Database Setup
let pool;

async function initDB() {
    try {
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbName = process.env.DB_NAME || 'technavigators';
        
        // Use SSL for remote connections (like Render)
        const isLocal = dbHost === 'localhost' || dbHost === '127.0.0.1';
        const sslConfig = isLocal ? false : { rejectUnauthorized: false };

        // For cloud databases, we usually can't run CREATE DATABASE.
        // We assume the database already exists and connect directly to it.
        pool = new Pool({
            host: dbHost,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: dbName,
            port: process.env.DB_PORT || 5432,
            max: 10,
            ssl: sslConfig
        });

        // Test the connection and initialize tables
        await pool.query('SELECT NOW()'); // just to verify connection

        // Initialize tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS interviews (
                id VARCHAR(100) PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                time TIME NOT NULL,
                type VARCHAR(100) NOT NULL,
                notes TEXT,
                room_name VARCHAR(255) NOT NULL,
                jitsi_link VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'upcoming',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('Database connection failed:', err.message || err);
        console.log('WARNING: Server starting without a database connection. Some features will not work.');
    }
}

initDB();

// Email Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'admintechnevigators@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password-here' // MUST be an App Password
    }
});

// --- Auth Middleware ---
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
}

// --- API Routes ---

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
            [name, email, hashedPassword]
        );

        res.json({ message: 'Registration successful. You can now log in.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;

        res.json({ message: 'Login successful.', user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully.' });
});

// Get Current User
app.get('/api/me', (req, res) => {
    if (req.session.userId) {
        res.json({ id: req.session.userId, name: req.session.userName, email: req.session.userEmail });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

// Schedule Interview
app.post('/api/interviews', requireAuth, async (req, res) => {
    try {
        const { date, time, type, notes } = req.body;
        const name = req.session.userName;
        const email = req.session.userEmail;
        const userId = req.session.userId;

        if (!date || !time || !type) {
            return res.status(400).json({ error: 'Date, time, and type are required.' });
        }

        // Generate Jitsi Link
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const ts = Date.now().toString(36);
        const roomName = `TechNav_${type.replace(/\s+/g, '')}_${slug}_${ts}`;
        const jitsiLink = `https://meet.ffmuc.net/${roomName}`;
        const id = 'int_' + Date.now();

        await pool.query(
            `INSERT INTO interviews (id, user_id, name, email, date, time, type, notes, room_name, jitsi_link) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [id, userId, name, email, date, time, type, notes || null, roomName, jitsiLink]
        );

        // Send Automated SMTP Email
        const mailOptions = {
            from: `"Tech Navigators" <${process.env.EMAIL_USER || 'admintechnevigators@gmail.com'}>`,
            to: email,
            subject: `Your Mock Interview with Tech Navigators: ${type}`,
            text: `Hello ${name},\n\nYour mock interview (${type}) has been scheduled successfully.\n\nDate: ${date}\nTime: ${time}\n\nYou can join the interview at the scheduled time using this secure link (No account required):\n${jitsiLink}\n\nBest of luck,\nThe Tech Navigators Team`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <h2 style="color: #7c3aed;">Mock Interview Scheduled! 🎉</h2>
                    <p>Hello <strong>${name}</strong>,</p>
                    <p>Your mock interview (<strong>${type}</strong>) has been scheduled successfully.</p>
                    <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${date}</p>
                        <p style="margin: 0;"><strong>Time:</strong> ${time}</p>
                    </div>
                    <p>You can join the interview at the scheduled time using this secure link (No account required):</p>
                    <a href="${jitsiLink}" style="display: inline-block; background: #06b6d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0;">Join Interview 🎥</a>
                    <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Best of luck,<br>The Tech Navigators Team</p>
                </div>
            `
        };

        // Try sending email, but don't fail the booking if email fails
        try {
            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${email} for interview ${id}`);
        } catch (emailErr) {
            console.error('Failed to send email:', emailErr);
        }

        res.json({ message: 'Interview scheduled successfully', interview: { id, date, time, type, jitsiLink } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error scheduling interview.' });
    }
});

// Get User's Interviews
app.get('/api/interviews', requireAuth, async (req, res) => {
    try {
        const { rows: interviews } = await pool.query(
            'SELECT * FROM interviews WHERE user_id = $1 ORDER BY date DESC, time DESC',
            [req.session.userId]
        );
        res.json(interviews);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching interviews.' });
    }
});

// Cancel Interview
app.delete('/api/interviews/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM interviews WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
        res.json({ message: 'Interview cancelled.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error cancelling interview.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
