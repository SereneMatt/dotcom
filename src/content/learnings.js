// A file without a title, and index.md, is not a published post.
export function publishedPosts() {
  const modules = import.meta.glob("./learnings/*.md", { eager: true });
  return Object.entries(modules).flatMap(([file, mod]) => {
    const slug = file.split("/").pop().replace(/\.md$/i, "");
    const title = String(mod.frontmatter?.title ?? "").trim();
    if (!slug || slug === "index" || !title) return [];
    return [{
      slug,
      title,
      href: `/learnings/${slug}`,
      compiledContent: mod.compiledContent,
    }];
  }).sort((a, b) => a.slug.localeCompare(b.slug));
}
