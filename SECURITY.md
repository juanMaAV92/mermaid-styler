# Security policy

Security fixes target the latest `main` revision. There is currently no support
commitment for older releases or a guaranteed response time.

## Reporting a vulnerability

Use GitHub's **Security → Report a vulnerability** on this repository:
https://github.com/juanMaAV92/mermaid-styler/security/advisories/new

If private reporting is unavailable, email the maintainer at
juanmanuel.armero@gmail.com with the subject `Mermaid Styler security report`.
Include the affected revision/browser, minimal sanitized reproduction, expected
impact, and any proposed fix. Avoid including real private Mermaid source.

Do not disclose an exploit in a public issue before coordination with the
maintainer. Reports should be reproduced locally rather than tested destructively
against the public deployment.

## Security boundary

Rendering runs locally under Mermaid's strict mode with input limits and SVG
sanitization. Exported source is opt-in. There is no account, persistence, or
remote render endpoint. Nginx serves CSP headers and cache rules when deployed
with the versioned Dockerfile; see `DEPLOYMENT.md` for verification.

Known residual risks and dependency findings are recorded in `AUDIT.md`.
