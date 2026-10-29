# Publishing a learning

Posts are Markdown files. The site publishes them at build time. There is no
CMS and no sample article in `src/content/learnings`.

## Add a post

Create `src/content/learnings/<slug>.md`. The filename, without `.md`, is the
public URL. Use lowercase letters, numbers, and hyphens.
`src/content/learnings/harbor-notes.md` is served at `/learnings/harbor-notes`.

Do not name the file `index.md`. That name is reserved for the index page and
is not published. A file with no title is not published either.

```markdown
---
title: The title readers see
---

The post body in Markdown.
```

The shared post layout supplies the page, navigation, and title. The index at
`/learnings` links to each published post. With no published files, that index
says that there are no posts yet.

## Rebuild

From the repository root:

```sh
nub run build
```

`nub run preview` rebuilds and serves the generated site. Deployment publishes
that same build output. A new or removed file is not on the site until the
next build.

Only Markdown files in `src/content/learnings` are published. Do not leave
sample or test articles in that directory.
