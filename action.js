const core = require("@actions/core");
const { context, getOctokit } = require("@actions/github");
const { combinePRs } = require("./lib");

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
  const ignoreLabel = core.getInput("ignoreLabel", { required: true });
  const combineBranchName = core.getInput("combineBranchName", {
    required: true,
  });
  const baseBranch = core.getInput("baseBranch", { required: true });
  const openPR = core.getBooleanInput("openPR", { required: true });
  const github = getOctokit(githubToken);

  await combinePRs(
    github,
    context.repo,
    {
      mustBeGreen,
      branchPrefix,
      ignoreLabel,
      combineBranchName,
      baseBranch,
      openPR,
    },
    {
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
    }
  );
};

main().catch(handleError);
