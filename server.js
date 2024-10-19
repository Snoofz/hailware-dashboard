const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session'); // Import express-session
const { parseDatabase, writeDatabase, updateUserProfile } = require('./database/databaseHandler');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const Account = require("./Account");
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { check, validationResult } = require('express-validator');

const app = express();
const PORT = 3778;
const databaseFilePath = path.join(__dirname, 'users.database.snof');
const nodemailer = require('nodemailer');
const pendingRegistrations = {};
const verificationCodes = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: '',
    pass: '',
  },
});

// Middleware
app.use(bodyParser.json({ limit: '50mb' })); // Set the limit to 50 MB
app.use(express.static('public')); // Serve static files from public folder
app.use(cors());
app.set('trust proxy', false);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Directory to save files
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to the file name
    }
});
  
async function fetchGravatarBase64(email) {
  try {
      // Normalize the email and create a MD5 hash
      const normalizedEmail = email.trim().toLowerCase();
      const emailHash = crypto.createHash('md5').update(normalizedEmail).digest('hex');

      // Construct the Gravatar URL
      const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?s=200&d=identicon`; // 's' is the size, 'd' is the default image type

      // Fetch the image
      const response = await axios.get(gravatarUrl, {
          responseType: 'arraybuffer', // Get the image as a buffer
      });

      // Convert the image to base64
      const base64Image = Buffer.from(response.data, 'binary').toString('base64');

      // Construct the data URL
      const dataUrl = `${base64Image}`;

      return dataUrl;
  } catch (error) {
      console.error('Error fetching Gravatar:', error);
      return null;
  }
}

const proxies = [
  'http://lbgyddbq:r5mftejnc4yj@198.23.239.134:6540',
  'http://lbgyddbq:r5mftejnc4yj@207.244.217.165:6712',
  'http://lbgyddbq:r5mftejnc4yj@107.172.163.27:6543',
  'http://lbgyddbq:r5mftejnc4yj@173.211.0.148:6641',
  'http://lbgyddbq:r5mftejnc4yj@161.123.152.115:6360',
  'http://lbgyddbq:r5mftejnc4yj@216.10.27.159:6837',
  'http://lbgyddbq:r5mftejnc4yj@167.160.180.203:6754',
  'http://lbgyddbq:r5mftejnc4yj@154.36.110.199:6853',
  'http://lbgyddbq:r5mftejnc4yj@173.0.9.70:5653',
  'http://lbgyddbq:r5mftejnc4yj@173.0.9.209:5792'
];

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG and PNG are allowed!'), false);
  }
};

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: fileFilter 
});

app.use(session({
  secret: 'snoofzIsASexyAssMotherfuckerUwUCuteFurryBoiyo!@#!&&#!^^^&*^&*^&*@!^&*^&*!^&@*!^&^@&*!^&*@%&^%#$%!%^$#%^!$^%#&!*&#^&!*(#&(*!@&*(#57648365864893256984632875647832658', // Replace with a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/');
  }
}

let messages = [];
const queues = new Map();

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

app.post('/api/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and code are required' });
  }

  const pendingUser = pendingRegistrations[email];

  if (pendingUser && pendingUser.verificationCode === code && (Date.now() - pendingUser.timestamp) < 10 * 60 * 1000) {
    const { username, password } = pendingUser;
    delete pendingRegistrations[email];

    try {
      const users = await parseDatabase(databaseFilePath);
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const base64Pfp = await fetchGravatarBase64(email);
      
      users.push({
        username,
        password,
        ip,
        email,
        _id: "user_" + generateRandomUserId(24),
        pfp: base64Pfp,
      });
      await writeDatabase(databaseFilePath, users);

      res.json({ success: true, message: 'Email verified and user registered successfully' });
    } catch (error) {
      console.error('Error completing user registration:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  } else {
    res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
  }
});


app.post('/api/register', [
  check('username').isAlphanumeric().withMessage('Username must be alphanumeric'),
  check('email').isEmail().withMessage('Invalid email address'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, password, email } = req.body;

  try {
    const users = await parseDatabase(databaseFilePath);
    const userExists = users.some(user => user.username === username);

    if (userExists) {
      return res.json({ success: false, message: 'Username already exists' });
    }

    const verificationCode = Math.floor(10000000 + Math.random() * 90000000).toString();

    pendingRegistrations[email] = {
      username,
      password: await bcrypt.hash(password, saltRounds),
      verificationCode,
      timestamp: Date.now(),
    };

    const mailOptions = {
      from: '',
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="text-align: center;">
          <img src="https://github.com/Snoofz/Hailware-Assets/blob/main/Hail.gif?raw=true" alt="Hailware Logo" style="max-width: 200px; height: auto;"/>
          <h2>Hailware Account System</h2>
          <p>Your verification code is: <strong>${verificationCode}</strong></p>
        </div>
      `,
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ success: false, message: 'Error sending verification code' });
      }

      res.json({ success: true, message: 'Registration successful! Please verify your email.', email });
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


function generateRandomUserId(length) {
  return [...Array(length)].map(() => Math.random().toString(36)[2]).join('');
}

app.post('/api/user', async (req, res) => {
  const { username } = req.body;

  try {
    const users = await parseDatabase(databaseFilePath);

    const user = users.find(user => user.username === username);
    if (user) {
      if (user.ip.includes("50.91.46.67")) {
        res.json({ success: true, pfp: user.pfp, username: `[👑] ${user.username}` });
      } else {
        res.json({ success: true, pfp: user.pfp, username: user.username, _id: user._id });
      }
    } else {
      res.json({ success: false, message: 'User Not Found' });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/profile', upload.single('pfpFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { username, newUsername } = req.body;
    const newPfp = req.file ? req.file.buffer.toString('base64') : null;

    console.log('Uploaded file:', req.file);
    console.log('Profile picture base64:', newPfp);

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

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Error logging out:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      res.redirect('/');
    });
}); 

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const users = await parseDatabase(databaseFilePath);

    const user = users.find(user => user.username === username);
      if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user.username;
        res.json({ success: true });
      } else {
        res.json({ success: false, message: 'Invalid credentials' });
      }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

async function generateAccounts(res, username, userPassword, userQueue) {
  while (userQueue.length > 0) {
      const { username: uniqueUsername, password: userPassword } = userQueue.shift();
      const account = new Account(uniqueUsername, userPassword, proxies);
      const result = await account.generateAccount();
      console.log(result)
      
      res.write(JSON.stringify(result) + '\n');
  }
  queues.delete(username);
  res.end();
}

app.post('/api/1/blf/generate-account', (req, res) => {
  const { amount, username, password } = req.body;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  const userQueue = [];

  for (let i = 0; i < amount; i++) {
      const uniqueUsername = `${username}${i + 1}`;
      userQueue.push({ username: uniqueUsername, password });
  }

  queues.set(username, userQueue);

  generateAccounts(res, username, password, userQueue);
});

app.post('/api/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;

  try {
    const users = await parseDatabase(databaseFilePath);

    const user = users.find(user => user.resetToken === resetToken && user.resetTokenExpiry > Date.now());
    if (!user) {
      return res.json({ success: false, message: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await writeDatabase(databaseFilePath, users);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

function generateResetToken() {
  return crypto.randomBytes(20).toString('hex');
}

function sendEmail(email, resetUrl) {
  const mailOptions = {
    from: '',
    to: email,
    subject: 'Password Reset',
    html: `
      <div style="text-align: center;">
        <img src="https://raw.githubusercontent.com/Snoofz/Hailware-Assets/refs/heads/main/Hail.gif" alt="Hailware Logo" style="max-width: 200px; height: auto;"/>
        <h2>Hailware Account System</h2>
        <p>Click the link to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>
      </div>
    `,
  };
  
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

app.post('/api/request-password-reset', async (req, res) => {
  const { email } = req.body;
  const users = await parseDatabase(databaseFilePath);
  
  const user = users.find(user => user.email === email);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const resetToken = generateResetToken();
  const resetTokenExpiry = Date.now() + 3600000;

  user.resetToken = resetToken;
  user.resetTokenExpiry = resetTokenExpiry;
  await writeDatabase(databaseFilePath, users);

  const resetUrl = `https://finger.hri7566.info/reset-password?token=${resetToken}`;
  
  sendEmail(email, resetUrl);

  res.json({ success: true, message: 'Password reset email sent' });
});

// Protected dashboard route
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard/dashboard.html');
});

app.get('/profile', isAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/dashboard/profile.html');
});

app.get('/blfaccountgen', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard/bullet-force-gen.html');
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.get('/reqresetpass', (req, res) => {
  res.sendFile(__dirname + '/public/req-reset-password.html');
});

app.get('/cmchat', isAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/dashboard/cmchat.html');
});
  
// Registration route
app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/public/register.html');
});

app.get('/email-verification', (req, res) => {
  res.sendFile(__dirname + '/public/email-verification.html');
});

app.get('/settings', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard/settings.html');
});

app.get('/ps4jb', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard/ps4-jb.html');
});

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
