const fs = require('fs');
const path = require('path');

/**
 * Parses a .database.snof file and converts it to a JavaScript object array.
 * @param {string} filePath - Path to the .database.snof file.
 * @returns {Promise<Object[]>} - Parsed data as an array of objects.
 */
function parseDatabase(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return reject(err);

      const entries = data.split('\n\n'); // Separate individual records
      const parsedData = entries.map(entry => {
        const lines = entry.split('\n');
        const obj = {};
        lines.forEach(line => {
          const [key, value] = line.split(': ');
          if (key && value) {
            obj[key.trim()] = value.trim();
          }
        });
        return obj;
      });

      resolve(parsedData);
    });
  });
}

/**
 * Writes a JavaScript object array to a .database.snof file.
 * @param {string} filePath - Path to the .database.snof file.
 * @param {Object[]} data - Data to write as an array of objects.
 * @returns {Promise<void>}
 */
function writeDatabase(filePath, data) {
    return new Promise((resolve, reject) => {
        const formattedData = data
            .map(entry => {
                return Object.entries(entry)
                    .map(([key, value]) => `${key}: ${value || ''}`)
                    .join('\n');
            })
            .join('\n\n');

        fs.writeFile(filePath, formattedData, 'utf8', err => {
            if (err) return reject(err);
            resolve();
        });
    });
}

/**
 * Updates a user's profile information in the .database.snof file.
 * @param {string} filePath - Path to the .database.snof file.
 * @param {string} username - The current username of the user.
 * @param {string} newUsername - The new username for the user.
 * @param {string} newPfp - The new profile picture URL for the user.
 * @returns {Promise<void>}
 */
async function updateUserProfile(filePath, username, newUsername, newPfp, ip) {
    const users = await parseDatabase(filePath);
    console.log('Parsed users:', users); // Debugging log
  
    // Find the user and update their information (with a safety check)
    const userIndex = users.findIndex(user => user.username && user.username.toLowerCase() === username.toLowerCase());
    if (userIndex === -1) {
      throw new Error('User not found');
    }
  
    if (newUsername) users[userIndex].username = newUsername; // Update username if provided
    if (newPfp) users[userIndex].pfp = newPfp; // Update profile picture if provided
    if (ip) users[userIndex].ip = ip; // Update profile picture if provided

    console.log('Updating user data:', users[userIndex]); // Debugging log
    await writeDatabase(filePath, users); // Write the updated data back to the file
}    

module.exports = { parseDatabase, writeDatabase, updateUserProfile };
