const core = require("@actions/core");
const { context, getOctokit } = require("@actions/github");
const execa = require("execa");
const { combinePRs } = require("../lib");

/**
 * @param {any} err
 */
const handleError = (err) => {
  core.error(err);
  core.setFailed(`Unhandled error: ${err}`);
};

process.on("unhandledRejection", handleError);

const main = async () => {
  const githubToken = core.getInput("githubToken", { required: true });
  const mustBeGreen = core.getBooleanInput("mustBeGreen", { required: true });
  const branchPrefix = core.getInput("branchPrefix", { required: true });
  const includeLabel = core.getInput("includeLabel", { required: false });
  const ignoreLabel = core.getInput("ignoreLabel", { required: true });
  const combineBranchName = core.getInput("combineBranchName", {
    required: true,
  });
  const baseBranch = core.getInput("baseBranch", { required: true });
  const openPR = core.getBooleanInput("openPR", { required: true });
  const allowSkipped = core.getBooleanInput("allowSkipped", { required: false });
  const github = getOctokit(githubToken);

  await execa("git", ["config", "user.name", "github-actions"]);
  await execa("git", ["config", "user.email", "github-actions@github.com"]);

  await combinePRs(
    {
      github,
      target: context.repo,
      logger: {
        info(msg) {
          core.info(msg);
        },
        success(msg) {
          core.info(msg);
        },
        warning(msg) {
          core.warning(msg);
        },
        error(msg) {
          core.error(msg);
        },
        group(name, cb) {
          return core.group(name, cb);
        },
      },
    },
    {
      mustBeGreen,
      allowSkipped,
      branchPrefix,
      includeLabel,
      ignoreLabel,
      combineBranchName,
      baseBranch,
      openPR,
    }
  );
};

main().catch(handleError);
