const path = require("path");
const { promises: fs } = require("fs");
const execa = require("execa");
const { replaceInFile } = require("replace-in-file");
/**
 * @typedef {import('@actions/github/lib/utils').GitHub} GitHub
 */

/**
 * @param {InstanceType<GitHub>} github
 * @param {Object} target
 * @param {string} target.owner
 * @param {string} target.repo
 * @param {Object} options
 * @param {string} options.branchPrefix
 * @param {string} [options.ignoreLabel]
 * @param {boolean} [options.mustBeGreen]
 */
exports.getCombinablePRs = async function* (
  github,
  { owner, repo },
  { mustBeGreen = true, branchPrefix, ignoreLabel }
) {
  const pulls = await github.paginate("GET /repos/{owner}/{repo}/pulls", {
    owner,
    repo,
  });

  for (const pull of pulls) {
    const { ref } = pull.head;
    if (!ref.startsWith(branchPrefix)) {
      continue;
    }

    if (mustBeGreen) {
      const statuses = await github.paginate(
        "GET /repos/{owner}/{repo}/commits/{ref}/statuses",
        {
          owner,
          repo,
          ref,
        }
      );

      if (statuses.length > 0) {
        if (statuses[0].state !== "success") {
          continue;
        }
      }
    }

    if (
      ignoreLabel &&
      pull.labels.map((label) => label.name).includes(ignoreLabel)
    ) {
      continue;
    }

    const response = await github.request(
      "GET /repos/{owner}/{repo}/commits/{ref}",
      {
        owner,
        repo,
        ref,
      }
    );

    yield {
      ref,
      number: pull.number,
      title: pull.title,
      lastCommit: response.data,
    };
  }
};

/**
 * @param {string} baseBranch
 * @param {string} combineBranchName
 */
exports.setupRepository = async (baseBranch, combineBranchName) => {
  await execa("git", ["config", "pull.rebase", "false"]);
  await execa("git", ["config", "user.name", "github-actions"]);
  await execa("git", ["config", "user.email", "github-actions@github.com"]);
  await execa("git", ["branch", combineBranchName, baseBranch]);
  await execa("git", ["checkout", combineBranchName]);
  await execa("git", ["fetch", "--all"]);
};

/**
 * @param {string} sha
 * @returns {Promise<execa.ExecaReturnValue<string>>}
 */
exports.cherryPickCommit = async (sha) => {
  try {
    const results = await execa("git", ["cherry-pick", sha]);
    return results;
  } catch (err) {
    await execa("git", ["cherry-pick", "--abort"]);

    throw err;
  }
};

const SHORT_MSG_REGEX = /^Bump ([\w-]+) from ([0-9\.]+) to ([0-9\.]+)$/m;

const fileExists = (file) =>
  fs
    .access(file)
    .then(() => true)
    .catch(() => false);

exports.applyVersionBump = async (pr) => {
  const fullCommitMessage = pr.lastCommit.commit.message;
  const [shortCommitMessage, package, fromVersion, toVersion] =
    fullCommitMessage.match(SHORT_MSG_REGEX);

  for (const file of pr.lastCommit.files) {
    if (file.filename.includes("package.json")) {
      await replaceInFile({
        files: file.filename,
        from: `"${package}": "^${fromVersion}`,
        to: `"${package}": "^${toVersion}`,
      });

      const dirname = path.dirname(file.filename);

      if (await fileExists(path.join(dirname, "package-lock.json"))) {
        await execa("npm", ["install"]);
      } else if (await fileExists(path.join(dirname, "yarn.lock"))) {
        await execa("yarn");
      }
    }
  }

  await execa("git", ["add", "."]);

  await execa("git", [
    "commit",
    "--author",
    `${pr.lastCommit.commit.author.name} <${pr.lastCommit.commit.author.name}>`,
    "-m",
    shortCommitMessage,
  ]);
};
