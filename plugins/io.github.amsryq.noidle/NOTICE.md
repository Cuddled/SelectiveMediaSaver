# NoIdle source and license notice

This is a compatibility-only Revenge Next port of the Classic `NoIdle` plugin
published by pylix.

- Audited Classic artifact: <https://vd-plugins.github.io/proxy/amsyarasyiq.github.io/letup/NoIdle/>
- Artifact SHA-256 from its manifest: `aaf6bce701b8c5ef28c871ec147b0078ce70c9e6c439cab110893553f27751c2`
- Original source: <https://github.com/amsryq/letup/tree/2146f638984c917ea1f6cc89fca677ff3683ca80/plugins/NoIdle>
- Original license: GNU General Public License v3.0

Only the Flux interception compatibility layer was adapted for Revenge Next on
September 17, 2026.
The original behavior—changing every `IDLE` event to `{ idle: false }`—is
unchanged. This repository is distributed under the GNU General Public License
v3.0; the complete license text is in the repository-root `LICENSE` file.
