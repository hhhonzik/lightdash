ARG PYTHON_VERSION="3.11"
FROM mcr.microsoft.com/vscode/devcontainers/python:${PYTHON_VERSION}


ARG DBT_VERSION="1.6.2"
ARG STARROCKS_VERSION="1.4.2"

WORKDIR /app
COPY dbt .

ENV PATH="$PATH:/root/.local/bin"
RUN apt update && apt install pipx -y && pipx --version

RUN pipx ensurepath && \
    pipx install dbt-core=="${DBT_VERSION}" && \
    pipx inject dbt-core dbt-starrocks=="${STARROCKS_VERSION}" && \
    dbt --version

USER vscode