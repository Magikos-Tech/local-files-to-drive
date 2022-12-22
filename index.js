const fs = require('fs')
const fsp = fs.promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { config } = require("./setup");
const parent = config.parent;
const { match } = require('assert');
var matchedFiles=[]

// If modifying the scope, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fsp.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fsp.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fsp.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

function uploadFile(auth) {

    let logsFolder = config.logsFolder;

    var extension = '.csv'
    var dirPath = path.join(__dirname,logsFolder);
    let tempdir = logsFolder + "/";
    var dirPath2 = path.join(__dirname,tempdir);
    //console.log(dirPath);
    var files = fs.readdirSync(dirPath);
    //console.log(files)
    for (var i = 0; i < files.length; i++) {
        var pathext = path.extname(dirPath2 + files[i])
        if (pathext == extension){
            matchedFiles.push(files[i])
        }
    }
    //console.log(matchedFiles);
    
    const drive = google.drive({ version: 'v3', auth });
    for (file of matchedFiles) {
        var fileMetadata = {
            name: file,
            parents: parent
        };
        var media = {
            mimeType: 'text/csv',
            body: fs.createReadStream(dirPath2 + file)
        };
        drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        }, function (err, res) {
            if (err) {
                console.log(err);
            } else {
                console.log('File Id: ', res.data.id);
                //delete uploaded files in each iteration
                //matchedFiles.forEach(path => fs.existsSync(dirPath2 + path) && fs.unlinkSync(dirPath2 + path));
            }
        });
    }
}

/** + 
 * Creates a new script project, upload a file, and log the script's URL.
 *  @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

authorize().then(uploadFile).catch(console.error);
