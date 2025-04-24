const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { WebcastPushConnection } = require('tiktok-live-connector');  // Importing the TikTok live connection

// Parameters
const tobiiPort = 7890; // The actual Tobii server port
const configDir = path.join(process.env.APPDATA, 'tiktokcontrolmytobii'); // Directory to store tiktokcontrolmytobii.json in AppData on Windows
const configPath = path.join(configDir, 'tiktokcontrolmytobii.json'); // Path to the configuration JSON file

// Creating a readline interface to read user inputs in the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// WebSocket connection to Tobii
let tobiiWs = null;
let profiles = []; // List of available profiles
let ghostEnabled = false; // State of Ghost

// Object to store configuration parameters
let config = {
  prefix: '!', // Default prefix
  liveUrl: ''   // Empty by default
};

// Load the configuration from the JSON file
function loadConfig() {
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(data); // Load the parameters into the config object
  } else {
    // Create the directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    // If the config file does not exist, create a new file with default values
    saveConfig();
  }
}

// Save the configuration to the JSON file
function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8'); // Save with 2 spaces indentation
}

// Load parameters at startup
loadConfig();

// Display the current configuration
console.log('Current prefix:', config.prefix);
console.log('Current live URL:', config.liveUrl);

// Function to display the ASCII Art logo
function displayLogo() {
  console.log(`
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│████████╗██╗██╗  ██╗████████╗ ██████╗ ██╗  ██╗     ██████╗ ██████╗ ███╗   ██╗████████╗██████╗  ██████╗ ██╗     │
│╚══██╔══╝██║██║ ██╔╝╚══██╔══╝██╔═══██╗██║ ██╔╝    ██╔════╝██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗██║     │
│   ██║   ██║█████╔╝    ██║   ██║   ██║█████╔╝     ██║     ██║   ██║██╔██╗ ██║   ██║   ██████╔╝██║   ██║██║     │
│   ██║   ██║██╔═██╗    ██║   ██║   ██║██╔═██╗     ██║     ██║   ██║██║╚██╗██║   ██║   ██╔══██╗██║   ██║██║     │
│   ██║   ██║██║  ██╗   ██║   ╚██████╔╝██║  ██╗    ╚██████╗╚██████╔╝██║ ╚████║   ██║   ██║  ██║╚██████╔╝███████╗│
│   ╚═╝   ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝│
│                                                                                                               │
│                            ███╗   ███╗██╗   ██╗    ████████╗ ██████╗ ██████╗ ██╗██╗                           │
│                            ████╗ ████║╚██╗ ██╔╝    ╚══██╔══╝██╔═══██╗██╔══██╗██║██║                           │
│                            ██╔████╔██║ ╚████╔╝        ██║   ██║   ██║██████╔╝██║██║                           │
│                            ██║╚██╔╝██║  ╚██╔╝         ██║   ██║   ██║██╔══██╗██║██║                           │
│                            ██║ ╚═╝ ██║   ██║          ██║   ╚██████╔╝██████╔╝██║██║                           │
│                            ╚═╝     ╚═╝   ╚═╝          ╚═╝    ╚═════╝ ╚═════╝ ╚═╝╚═╝                           │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  `);
}

// Function to connect to Tobii and keep the connection open
function connectToTobii() {
  if (tobiiWs && tobiiWs.readyState === WebSocket.OPEN) return; // Connection already open

  tobiiWs = new WebSocket(`ws://127.0.0.1:${tobiiPort}/ghostApi/v1`);

  tobiiWs.on('open', () => requestProfiles());
  tobiiWs.on('message', (msg) => {
    const parsedMessage = JSON.parse(msg);
    if (parsedMessage.type === 'ProfileListChanged') {
      profiles = parsedMessage.payload.profiles;
    }
  });
  tobiiWs.on('close', () => setTimeout(connectToTobii, 1000)); // Reconnect after 1 second
  tobiiWs.on('error', () => setTimeout(connectToTobii, 1000)); // Reconnect on error
}

// Request the list of available profiles
function requestProfiles() {
  const message = JSON.stringify({
    type: 'GetProfileList',
    payload: {}
  });
  tobiiWs.send(message);
}

// Function to connect to the TikTok live stream
async function connectToLive() {
  console.clear(); // Clear the terminal before starting the connection
  displayLogo(); // Display the logo every time
  console.log('Attempting to connect to', config.liveUrl, '...');

  const connection = new WebcastPushConnection(config.liveUrl);

  // Attempt to connect to the live stream
  while (true) {
    try {
      await connection.connect();
      console.clear(); // Clear again after successful connection
      displayLogo(); // Display the logo every time
      console.log('Connected to TikTok live');
      break;
    } catch (err) {
      console.log('Not live yet... retrying in 10 seconds');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for 10 seconds before retrying
    }
  }

  // Listen for messages from the TikTok chat
  connection.on('chat', (data) => {
    const msg = data.comment;
    if (msg.startsWith(config.prefix)) {
      handleChatCommand(msg);
    }
  });

  // After the connection to the live stream, no more menu should be displayed
  console.clear();  // Clear the terminal after successful connection
  displayLogo(); // Display the logo every time
  console.log('\nYou are connected to the live stream. Awaiting commands...');
  rl.close();  // Close the readline interface to prevent further input.
}

// Function to handle chat commands from TikTok
function handleChatCommand(msg) {
  const command = msg.trim().toLowerCase();

  // If the command matches an available profile
  const profile = profiles.find(p => `${config.prefix}${p.name.toLowerCase()}` === command);
  if (profile) {
    console.log(`Command '${command}' detected`);
    sendProfileSelection(profile.id); // Change profile
    return;
  }

  // Command for Ghost
  if (command === `${config.prefix}on`) {
    toggleGhost(true); // Enable Ghost
  } else if (command === `${config.prefix}off`) {
    toggleGhost(false); // Disable Ghost
  }
}

// Function to toggle Ghost on/off
function toggleGhost(enabled) {
  ghostEnabled = enabled;
  const command = {
    type: "SetEnabled",
    payload: { enabled: ghostEnabled }
  };
  tobiiWs.send(JSON.stringify(command));
  console.log(`Ghost ${ghostEnabled ? "enabled" : "disabled"}`);
}

// Function to change the Tobii profile based on the command
function sendProfileSelection(profileId) {
  const message = JSON.stringify({
    type: 'SetCurrentProfileId',
    payload: { profileId }
  });
  tobiiWs.send(message);
}

// Function to display the live connection prompt
function displayLiveConnectionPrompt() {
  console.clear(); // Clear the terminal before showing the option and menu
  displayLogo(); // Display the logo every time
  if (config.liveUrl) {
    // Display the URL in green
    console.log('Saved URL: \x1b[32m' + config.liveUrl + '\x1b[0m');
  } else {
    // Display the message in red if no live URL is saved
    console.log('\x1b[31mNo TikTok live URL saved\x1b[0m');
  }

  // Display the main menu with the option to change the live URL
  console.log('\n1. Change the TikTok live URL');
  console.log('2. Tobii Profiles');
  console.log('3. LIVE Commands');
  console.log(''); // Empty line added here to separate sections

  rl.question('Choose an option or press Enter to connect to the live stream: ', handleMainMenuInput);
}

// Handle input in the main menu
function handleMainMenuInput(input) {
  if (input === "") {
    // If the user presses Enter without choosing an option, connect to the live stream
    if (!config.liveUrl) {
      rl.question('Enter the TikTok live URL: ', (url) => {
        config.liveUrl = url;
        saveConfig(); // Save the live URL
        connectToLive(); // Connect to the live stream
      });
    } else {
      // Connect to the live stream with the saved URL
      connectToLive();
    }
  } else {
    // If the user enters a menu option
    switch (input) {
      case '1':
        rl.question('Enter the TikTok live URL: ', (url) => {
          config.liveUrl = url;
          saveConfig(); // Save the live URL
          console.log('Live URL updated.');
          displayLiveConnectionPrompt(); // Return to the menu after URL modification
        });
        break;
      case '2':
        displayProfilesMenu(); // Manage profiles
        break;
      case '3':
        manageCommands(); // Manage commands
        break;
      default:
        displayLiveConnectionPrompt(); // Return to the live connection screen if invalid option
        break;
    }
  }
}

// Manage commands
function manageCommands() {
  console.clear(); // Clear the terminal before displaying the commands
  displayLogo(); // Display the logo every time
  console.log(`${config.prefix}on -> Enable Ghost`);  // Command to enable Ghost
  console.log(`${config.prefix}off -> Disable Ghost`);  // Command to disable Ghost

  // Display only the commands with their prefix for each profile
  profiles.forEach((profile) => {
    console.log(`${config.prefix}${profile.name.toLowerCase()}`);
  });

  // Combine the two lines into one
  rl.question(`\nCurrent prefix: ${config.prefix} - Enter a new prefix or type 'exit' to return to the menu: `, handleCommandInput);
}

// Handle input in the command management section
function handleCommandInput(input) {
  if (input === 'exit') {
    displayLiveConnectionPrompt(); // Return to the main menu from the command section
  } else if (input) {
    // If a prefix is entered, update it for all commands
    config.prefix = input;  // Change the prefix in the config object
    saveConfig();  // Save the changes
    console.clear();
    displayLogo(); // Display the logo every time
    console.log('The command prefix has been updated:', config.prefix);
    manageCommands(); // Return to command management after modification
  } else {
    // If no prefix is entered, show an error message
    console.clear();
    displayLogo(); // Display the logo every time
    console.log('Invalid prefix. Try again.');
    manageCommands();
  }
}

// Display available profiles and allow selection
function displayProfilesMenu() {
  console.clear(); // Clear the terminal before showing the profiles
  displayLogo(); // Display the logo every time
  profiles.forEach((profile, index) => console.log(`${index + 1}. ${profile.name}`));
  promptProfileSelection();
}

// Prompt for profile selection
function promptProfileSelection() {
  rl.question('\nEnter the profile number for manual selection or type "exit" to return to the menu: ', (input) => {
    if (input === 'exit') {
      displayLiveConnectionPrompt();
    } else {
      const profileIndex = parseInt(input, 10) - 1;
      if (profileIndex >= 0 && profileIndex < profiles.length) {
        const selectedProfile = profiles[profileIndex];
        console.clear(); // Clear the terminal after selection
        displayLogo(); // Display the logo every time
        console.log('You have selected the profile:', selectedProfile.name);
        sendProfileSelection(selectedProfile.id);
        displayProfilesMenu(); // Ask again to select another profile after selection
      } else {
        // If the input is invalid, ask again without showing an error message
        promptProfileSelection(); // Ask again without showing an error message
      }
    }
  });
}

// Connect to Tobii on startup
connectToTobii();
displayLiveConnectionPrompt(); // Display the prompt to connect to the live stream
