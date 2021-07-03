const path = require("path");
const { execSync } = require("child_process");

execSync("npm ci", {
  cwd: path.dirname(__dirname),
});
