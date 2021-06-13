#!/usr/bin/env node
"use strict";
const { promises: fs } = require("fs");
const path = require("path");
const os = require("os");
const rmrf = require("rimraf");
const meow = require("meow");
const { getOctokit } = require("@actions/github");
const inquirer = require("inquirer");
const logSymbols = require("log-symbols");
const execa = require("execa");
const { combinePRs } = require("..");

const cli = meow(
  `
	Usage
	  $ combine-prs

	Options
	  --owner                The owner of the repository to target (required)
	  --repo                 The name of the repository to target (required)
	  --github-token         API access token to use for GitHub
	                         If not provided, will pull from GITHUB_TOKEN environment variable
	                         If not found there, will prompt to provide it.
	  --branch-prefix        Branch prefix to find combinable PRs based on
	  --must-be-green        Only combine PRs that are green (status is success)
	  --combine-branch-name  Name of the branch to combine PRs into
	  --base-branch          Name of the branch to fork from & merge into

	Examples
	  $ combine-dependabot-prs --owner=mAAdhaTTah --repo=memezer
`,
  {
    flags: {
      owner: {
        type: "string",
        isRequired: true,
      },
      repo: {
        type: "string",
        isRequired: true,
      },
      githubToken: {
        type: "string",
      },
      branchPrefix: {
        type: "string",
        default: "dependabot",
      },
      mustBeGreen: {
        type: "boolean",
        default: true,
      },
      combineBranchName: {
        type: "string",
        default: "combined-prs",
      },
      ignoreLabel: {
        type: "string",
        default: "nocombine",
      },
      baseBranch: {
        type: "string",
        default: "main",
      },
      openPr: {
        type: "boolean",
        default: true,
      },
    },
  }
);

/**
 * @type import('..').Logger
 */
const logger = {
  info(...args) {
    console.error(logSymbols.info, ...args);
  },
  success(...args) {
    console.error(logSymbols.success, ...args);
  },
  warning(...args) {
    console.error(logSymbols.warning, ...args);
  },
  error(...args) {
    console.error(logSymbols.error, ...args);
  },
};

(async function main() {
  const {
    owner,
    repo,
    mustBeGreen,
    branchPrefix,
    ignoreLabel,
    combineBranchName,
    baseBranch,
    openPr: openPR,
  } = cli.flags;
  let { githubToken } = cli.flags;

  if (!githubToken) {
    githubToken = process.env.GITHUB_TOKEN;
  }

  if (!githubToken) {
    ({ githubToken } = await inquirer.prompt([
      {
        type: "password",
        message: "Enter your GitHub token",
        name: "githubToken",
      },
    ]));
  }

  if (!githubToken) {
    logger.error(
      `No GitHub token found. Run combine-dependabot-prs --help for details.`
    );
    return;
  }

  const github = getOctokit(githubToken);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cpd-"));
  const baseCWD = process.cwd();

  const cleanup = () => {
    logger.info("Cleaning up");
    process.chdir(baseCWD);
    rmrf.sync(tmpDir);
    process.exit();
  };
  process.on("SIGINT", cleanup);

  try {
    const { data } = await github.rest.repos.get({ owner, repo });
    logger.info(`Cloning repository ${owner}/${repo} into ${tmpDir}.`);
    await execa("git", ["clone", data.ssh_url, tmpDir], {
      stderr: "ignore",
    });
    process.chdir(tmpDir);
    await combinePRs(
      github,
      { owner, repo },
      {
        mustBeGreen,
        branchPrefix,
        ignoreLabel,
        combineBranchName,
        baseBranch,
        openPR,
      },
      logger
    );

    logger.success(`Successfully combined PRs.`);
  } catch (err) {
    logger.error(`Failed to combine PRs with error: ${err}`);
  } finally {
    cleanup();
  }
})();
