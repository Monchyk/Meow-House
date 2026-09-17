# Rendering graphs to static images (optional)

Both GitHub and Obsidian render the ` ```mermaid ` fenced blocks natively, so static
images aren't needed for normal viewing. Render to SVG/PNG only when you need images
for a slide, a print, or a platform that doesn't do mermaid.

No mermaid CLI is installed on this machine. When you want images, install-on-demand:

```bash
# render every source diagram to SVG next to it, under rendered/
mkdir -p docs/graphs/rendered
for f in docs/graphs/src/*.mmd; do
  npx -p @mermaid-js/mermaid-cli mmdc -i "$f" -o "docs/graphs/rendered/$(basename "${f%.mmd}").svg"
done
```

Swap `.svg` → `.png` for raster. `-t dark -b transparent` matches the projector-scale
dark theme. After rendering, link images from `PROJECT-OVERVIEW.md` if you want a
no-JS fallback.

**Source of truth:** `docs/graphs/src/*.mmd`. Everything else (the fenced blocks in
`PROJECT-OVERVIEW.md`, the `github/` and `obsidian/` wrappers, and any rendered images)
is regenerated from those — edit the `.mmd`, then rerun the `project-overview` skill's
embed step.
