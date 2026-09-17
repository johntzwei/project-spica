# Project Spica

This repository publishes the institutional website at **https://projectspica.org**.
It replaces the original single-page site with the ceramic mosaic design imported
from `CtrlVGustavo/spica-website` at `1d26186`.

## Editing and publishing

- Edit `_source/`, not the generated root files.
- Run `bun test _source`, `bun run publish:prepare`, and `bun run build:check`.
- Commit source and generated files together.
- GitHub Pages publishes `main` from the repository root via Jekyll. Preserve
  `CNAME`, `_config.yml`, and underscore-prefixed source/build directories.
- Do not add `.nojekyll`; Jekyll exclusions keep tooling out of the deployed site.
- Read `README.md` for deployment, compatibility and rollback instructions.

## Organization

Project Spica develops **spiking**—deliberately inserting known data into training
at known rates—into standard AI safety practice. The website contains Mission,
Roadmap, Research and People pages. Publication remains at
https://projectspica.substack.com; the social account is https://x.com/projectspica1.
The new website intentionally has no Analytics script.
