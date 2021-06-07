# combine-dependabot-prs

GitHub action to combine dependabot PRs

## How to Use

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
      - uses: maadhattah/combine-dependabot-prs
        with:
          branchPrefix: "dependabot"
          mustBeGreen: true
          combineBranchName: "combined-prs"
          baseBranch: "main"
          ignoreLabel: "nocombine"
          baseBranch: "main"
          githubToken: ${{ github.token }}
          openPR: true
```

These inputs are the defaults, and any or all can be customized or omitted.

Once you've added this workflow to the repository, go to you "Actions" tab, and click the newly added workflow. The click "Run workflow", and the green "Run workflow" button to start the job. When the workflow succeeds, a new PR will be opened in your repository with the combined dependency bumps.
