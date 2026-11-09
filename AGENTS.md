# Auth service agent instructions

Read [README.md](README.md) for identity-provider and OAuth client contracts,
and [production guidance](docs/production.md) before deployment changes. Use
the repository's declared pnpm toolchain and scripts.

## Shared PiorLabs context

Before changing architecture, shared integrations, or deployment, consult the
[PiorLabs workspace documentation](https://github.com/pior-labs/workspace/tree/main/docs).
In the shared workspace, these documents are available under `../docs/`.

Start with `architecture.md` and `conventions.md`; consult `service-catalog.md`,
`infrastructure.md`, and `decisions/` as relevant. Follow this repository's local
instructions, update documentation in the repository that owns the contract,
and flag conflicts between documentation and implementation.
