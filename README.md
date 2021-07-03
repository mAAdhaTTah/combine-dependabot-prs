# combine-dependabot-prs

CLI + GitHub action to combine dependabot PRs on GitHub repositories.

## How to Use

## CLI

The CLI is published on npm so it can be run with all of the usual node methods. The easiest is `npx`:

```bash
$ npx combine-dependabot-prs me/my-repo
```

Substitute `me` & `my-repo` with the owner & repo you're targeting.

You can also install it globally:

```bash
$ npm i -g combine-dependabot-prs
$ combine-dependabot-prs me/my-repo
```

You'll need to create a [Personal Access Token](https://github.com/settings/tokens) to use with the CLI. You can provide it one of three ways:

1. With `--github-token` flag
2. With `GITHUB_TOKEN` env var
3. Via prompt at runtime

### GitHub Action

Create a new action in your repo by creating a file called `.github/workflows/combine.yml`. In that file drop this contents:

```yml
name: "Combine Dependabot PRs"
on:
  workflow_dispatch:

jobs:
  combine-prs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2.3.3
      - uses: maadhattah/combine-dependabot-prs@main
        with:
          branchPrefix: "dependabot"
          mustBeGreen: true
          combineBranchName: "combined-prs"
          ignoreLabel: "nocombine"
          baseBranch: "main"
          openPR: true
```

These are the defaults, and any or all can be customized or omitted.

Once you've added this workflow to the repository (you'll need to merge it into your main branch first), go to your "Actions" tab, and click the newly added workflow. Then click "Run workflow", and the green "Run workflow" button to start the job. When the workflow succeeds, a new PR will be opened in your repository with the combined dependency bumps.
