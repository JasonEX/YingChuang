export function getScriptText(doc: Document): string {
  return Array.from(doc.scripts)
    .map(script => script.textContent || '')
    .join('\n');
}

export function appendHiddenLink(
  doc: Document,
  id: string,
  href: string | null,
  text: string,
  base: string
): void {
  if (!href || href === '#' || /^javascript:/i.test(href) || doc.getElementById(id)) return;

  try {
    const link = doc.createElement('a');
    link.id = id;
    link.href = new URL(href, base).toString();
    link.textContent = text;
    link.style.display = 'none';
    (doc.body || doc.documentElement)?.appendChild(link);
  } catch {
    // ignore invalid URLs from site scripts
  }
}

export function extractChapterNav(scriptText: string): {
  prev: string | null;
  next: string | null;
} {
  const match = scriptText.match(
    /if\s*\(\s*direction\s*===\s*['"]prev['"]\s*\)\s*\{[\s\S]*?chapterUrl\s*=\s*['"]([^'"]+)['"][\s\S]*?\}\s*else\s*\{[\s\S]*?chapterUrl\s*=\s*['"]([^'"]+)['"]/
  );

  return {
    prev: match?.[1] || null,
    next: match?.[2] || null,
  };
}
