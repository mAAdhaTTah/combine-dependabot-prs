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
	  $ combine-prs [...target]

	Input
	  [...target]            Repositories to combine PRs on
	                         Can supply multiple repositories

	Options
	  --github-token         API access token to use for GitHub
	                         If not provided, will pull from GITHUB_TOKEN environment variable
	                         If not found there, will prompt to provide it
	  --branch-prefix        Branch prefix to find combinable PRs based on
	  --include-failed       Include PRs whose status checks have failed
	  --combine-branch-name  Name of the branch to combine PRs into
    --include-label        Only include PRs with this label
	                         Defaults to ""
	  --ignore-label         PR's with this label will not be combined
	                         Defaults to "nocombine"
	  --base-branch          Base branch to branch from & PR into
	                         Defaults to "main"
    --allow-skipped        Allow skipped checks to be considered succesful
	  --skip-pr              If present, will skip creating a new PR for the new branch
    --close-once-combined  If present, will close the individual dependabot PRs/branchs once combined

	Examples
	  $ combine-dependabot-prs mAAdhaTTah/memezer
	  $ combine-dependabot-prs mAAdhaTTah/memezer mAAdhaTTah/brookjs
`,
  {
    flags: {
      githubToken: {
        type: "string",
      },
      branchPrefix: {
        type: "string",
        default: "dependabot",
      },
      includeFailed: {
        type: "boolean",
        default: false,
      },
      combineBranchName: {
        type: "string",
        default: "combined-prs",
      },
      includeLabel: {
        type: "string",
        default: "",
      },
      ignoreLabel: {
        type: "string",
        default: "nocombine",
      },
      baseBranch: {
        type: "string",
        default: "main",
      },
      skipPr: {
        type: "boolean",
        default: false,
      },
      allowSkipped: {
        type: "boolean",
        default: false,
      },
      closeOnceCombined: {
        type: "boolean",
        default: false,
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
  async group(name, cb) {
    console.group(name);
    await cb();
    console.groupEnd();
  },
};

const TARGET_STRING_RE = /^([\w-_]+)\/([\w-_]+)$/;

(async function main() {
  const {
    includeFailed,
    branchPrefix,
    includeLabel,
    ignoreLabel,
    combineBranchName,
    baseBranch,
    skipPr,
    allowSkipped,
    closeOnceCombined,
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
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cdp-"));
  const baseCWD = process.cwd();

  const cleanup = () => {
    process.chdir(baseCWD);
    rmrf.sync(tmpDir);
    process.exit();
  };
  process.on("SIGINT", cleanup);

  if (cli.input.length === 0) {
    logger.error(`No targets provided. Use --help flag for more info.`);
    return;
  }

  try {
    for (const targetString of cli.input) {
      const match = TARGET_STRING_RE.exec(targetString);
      if (match == null) {
        logger.error(
          `Repo ${targetString} doesn't match expected [owner]/[repo] format.`
        );
        continue;
      }
      const [, owner, repo] = match;
      const target = { owner, repo };
      const { data } = await github.rest.repos.get(target);
      const cloneDir = `${tmpDir}/${owner}--${repo}`;
      logger.info(`Cloning repository ${targetString} into ${cloneDir}.`);
      await execa("git", ["clone", data.ssh_url, cloneDir], {
        stderr: "ignore",
      });
      process.chdir(cloneDir);
      await combinePRs(
        { github, logger, target },
        {
          mustBeGreen: !includeFailed,
          allowSkipped,
          branchPrefix,
          includeLabel,
          ignoreLabel,
          combineBranchName,
          baseBranch,
          openPR: !skipPr,
          closeOnceCombined,
        }
      );

      logger.success(`Successfully combined PRs for ${targetString}.`);
    }
  } catch (err) {
    logger.error(`Failed to combine PRs with error: ${err}`);
  } finally {
    cleanup();
  }
})();
