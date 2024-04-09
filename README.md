# Lightdash fork that supports Starrocks DB

This is a fork for internal use and testing, please use official version for your use cases. Lightdash is an amazing piece of software and 


## Notable changes in this fork:

1. New connector `dbt-starrocks`
2. Default dbt version changed to 1.6.x


## Usage

TBD
Use this docker image:


To run cli, use dockerized one, there is no pypi release for it.

```docker run -v $(pwd)/dbt-project:/dbt hhhonzik/lightdash-cli:latest --help```

## Development

VScode with devcontainer is recommended. All the info in [CONTRIBUTING.md](./.github/CONTRIBUTING.md)