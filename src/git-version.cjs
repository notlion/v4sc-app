const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync } = require('fs');

const versFile = 'src/git-version.json';

// Run 'git describe' command
const gitInfo = execSync('git describe --tags --always').toString().trim();
const versionInfoJson = JSON.stringify(gitInfo, null, 2);

const existingVersionInfo = existsSync(versFile)? readFileSync(versFile, 'utf8') : null;
if (existingVersionInfo !== versionInfoJson) {
    writeFileSync(versFile, versionInfoJson);
}
