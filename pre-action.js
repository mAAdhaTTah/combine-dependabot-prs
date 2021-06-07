const { execSync } = require("child_process");

execSync("npm ci", {
  cwd: __dirname,
});
