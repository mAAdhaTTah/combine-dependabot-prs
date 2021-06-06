const core = require("@actions/core");
const { context, getOctokit } = require("@actions/github");
const execa = require("execa");
const {
  getCombinablePRs,
  setupRepository,
  cherryPickCommit,
  applyVersionBump,
} = require("./lib");

const handleError = (err) => {
  console.error(err);
  core.setFailed(`Unhandled error: ${err}`);
};

process.on("unhandledRejection", handleError);

const main = async () => {
  const token = core.getInput("githubToken", { required: true });
  const mustBeGreen = core.getBooleanInput("mustBeGreen", { required: true });
  const branchPrefix = core.getInput("branchPrefix", { required: true });
  const ignoreLabel = core.getInput("ignoreLabel", { required: true });
  const combineBranchName = core.getInput("combineBranchName", {
    required: true,
  });
  const baseBranch = core.getInput("baseBranch", { required: true });
  const openPR = core.getBooleanInput("openPR", { required: true });
  const github = getOctokit(token);

  await setupRepository(baseBranch, combineBranchName);

  const combinablePRs = getCombinablePRs(github, context.repo, {
    mustBeGreen,
    branchPrefix,
    ignoreLabel,
  });

  let prString = "";

  for await (const pr of combinablePRs) {
    const { lastCommit } = pr;
    try {
      await cherryPickCommit(lastCommit.sha);
    } catch (err) {
      if (!err.stdout.includes("CONFLICT")) {
        throw err;
      }

      await applyVersionBump(lastCommit);
    }

    prString += "* #" + pr.number + " " + pr.title + "\n";
  }

  await execa("git", ["push", "origin", combineBranchName]);

  if (openPR) {
    const body = `This PR was created by the Combine PRs action by combining the following PRs:
  
${prString}`;

    await github.rest.pulls.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: "Update combined dependencies",
      head: combineBranchName,
      base: baseBranch,
      body: body,
    });
  }
};

main().catch(handleError);
