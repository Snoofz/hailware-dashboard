const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session'); // Import express-session
const { parseDatabase, writeDatabase, updateUserProfile } = require('./database/databaseHandler');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = 3778;
const databaseFilePath = path.join(__dirname, 'users.database.snof');

// Middleware
app.use(bodyParser.json({ limit: '50mb' })); // Set the limit to 50 MB
app.use(express.static('public')); // Serve static files from public folder
app.use(cors());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Directory to save files
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to the file name
    }
});
  
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory
  
// Set up session middleware
app.use(session({
  secret: 'snoofzIsASexyAssMotherfuckerUwUCuteFurryBoiyo!@#!&&#!^^^&*^&*^&*@!^&*^&*!^&@*!^&^@&*!^&*@%&^%#$%!%^$#%^!$^%#&!*&#^&!*(#&(*!@&*(#57648365864893256984632875647832658', // Replace with a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next(); // User is logged in, proceed to the next middleware/route handler
  } else {
    res.redirect('/'); // User is not logged in, redirect to the login page
  }
}

let messages = []; // Store messages in-memory (use a database for production)

// Endpoint to get messages
app.get('/api/chat/messages', (req, res) => {
    res.json(messages);
});

app.post('/api/chat/messages', (req, res) => {
    const { username, pfp, text } = req.body;
    if (username && pfp && text) {
        messages.push({ username, pfp, text });
        res.status(201).json({ success: true, message: 'Message sent' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid message format' });
    }
});

// Sign-up route
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const users = await parseDatabase(databaseFilePath);

    // Check if the username already exists
    const userExists = users.some(user => user.username === username);
    if (userExists) {
      return res.json({ success: false, message: 'Username already exists' });
    }

    // Add the new user to the database
    users.push({ username, password });
    await writeDatabase(databaseFilePath, users);

    res.json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/profile', upload.single('pfpFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { username, newUsername } = req.body;
    const newPfp = req.file ? req.file.buffer.toString('base64') : null;

    console.log('Uploaded file:', req.file); // Log the uploaded file
    console.log('Profile picture base64:', newPfp); // Log the base64 string

    try {
        await updateUserProfile(databaseFilePath, username, newUsername, newPfp);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            newPfp: `data:image/jpeg;base64,${newPfp}`
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// Logout route
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Error logging out:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      res.redirect('/'); // Redirect to the login page after logout
    });
}); 

// Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const users = await parseDatabase(databaseFilePath);

    // Check if the username and password match
    const user = users.find(user => user.username === username && user.password === password);
    if (user) {
      req.session.user = user.username; // Set the logged-in user in session
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Reset password route
app.post('/api/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;

  try {
    const users = await parseDatabase(databaseFilePath);

    // Find the user by username
    const userIndex = users.findIndex(user => user.username === username);
    if (userIndex === -1) {
      return res.json({ success: false, message: 'User not found' });
    }

    // Update the user's password
    users[userIndex].password = newPassword;
    await writeDatabase(databaseFilePath, users);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Protected dashboard route
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard/dashboard.html');
});

app.get('/profile', isAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/dashboard/profile.html');
});

app.get('/cmchat', isAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/dashboard/cmchat.html');
});
  
// Registration route
app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/public/register.html');
});

// Catch-all route to serve the frontend (login page)
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
