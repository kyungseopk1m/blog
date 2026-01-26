import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, unlinkSync, rmdirSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import AdmZip from 'adm-zip';

const POSTS_DIR = 'src/content/posts';
const IMAGES_DIR = 'public/images/posts';
const TEMP_DIR = '.notion-temp';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanDir(dir: string) {
  if (existsSync(dir)) {
    const files = readdirSync(dir);
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stat = require('fs').statSync(filePath);
        if (stat.isDirectory()) {
          cleanDir(filePath);
          rmdirSync(filePath);
        } else {
          unlinkSync(filePath);
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

function extractTitle(markdown: string, filename: string): string {
  // Try to extract title from first heading
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Fallback to filename without extension and UUID
  const nameWithoutExt = basename(filename, extname(filename));
  // Remove Notion UUID pattern (32 hex chars at the end)
  const nameWithoutUuid = nameWithoutExt.replace(/\s+[a-f0-9]{32}$/i, '');
  return nameWithoutUuid.trim();
}

function processMarkdownContent(
  content: string,
  slug: string,
  imageFiles: Map<string, string>
): string {
  let processed = content;

  // Remove first h1 if exists (will be in frontmatter)
  processed = processed.replace(/^#\s+.+\n+/, '');

  // Update image paths
  imageFiles.forEach((newPath, originalName) => {
    const encodedName = encodeURIComponent(originalName);
    const patterns = [
      new RegExp(`!\\[([^\\]]*)\\]\\(${originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
      new RegExp(`!\\[([^\\]]*)\\]\\(${encodedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
      new RegExp(`!\\[([^\\]]*)\\]\\(\\.?/?${originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
    ];

    patterns.forEach((pattern) => {
      processed = processed.replace(pattern, `![$1](${newPath})`);
    });
  });

  return processed.trim();
}

function createFrontmatter(title: string, description: string): string {
  const now = new Date();
  const pubDate = now.toISOString().split('T')[0];

  return `---
title: "${title.replace(/"/g, '\\"')}"
pubDate: ${pubDate}
description: "${description.replace(/"/g, '\\"')}"
category: "Uncategorized"
draft: false
---

`;
}

function importNotionZip(zipPath: string) {
  console.log(`Importing Notion export from: ${zipPath}`);

  if (!existsSync(zipPath)) {
    console.error(`File not found: ${zipPath}`);
    process.exit(1);
  }

  // Clean and create temp directory
  cleanDir(TEMP_DIR);
  mkdirSync(TEMP_DIR, { recursive: true });

  // Extract ZIP
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(TEMP_DIR, true);

  // Find markdown files
  const findMarkdownFiles = (dir: string): string[] => {
    const results: string[] = [];
    const items = readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...findMarkdownFiles(fullPath));
      } else if (item.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  };

  const markdownFiles = findMarkdownFiles(TEMP_DIR);
  console.log(`Found ${markdownFiles.length} markdown file(s)`);

  // Ensure directories exist
  mkdirSync(POSTS_DIR, { recursive: true });
  mkdirSync(IMAGES_DIR, { recursive: true });

  // Process each markdown file
  for (const mdFile of markdownFiles) {
    const content = readFileSync(mdFile, 'utf-8');
    const title = extractTitle(content, mdFile);
    const slug = slugify(title);

    console.log(`Processing: ${title} -> ${slug}`);

    // Find and copy images
    const imageFiles = new Map<string, string>();
    const mdDir = dirname(mdFile);

    // Look for images in the same directory
    if (existsSync(mdDir)) {
      const items = readdirSync(mdDir);
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

      for (const item of items) {
        const ext = extname(item).toLowerCase();
        if (imageExtensions.includes(ext)) {
          const imageSlugDir = join(IMAGES_DIR, slug);
          mkdirSync(imageSlugDir, { recursive: true });

          const newImageName = `${Date.now()}-${slugify(basename(item, ext))}${ext}`;
          const newImagePath = join(imageSlugDir, newImageName);
          const webPath = `/images/posts/${slug}/${newImageName}`;

          copyFileSync(join(mdDir, item), newImagePath);
          imageFiles.set(item, webPath);

          console.log(`  Copied image: ${item} -> ${webPath}`);
        }
      }
    }

    // Process content
    const processedContent = processMarkdownContent(content, slug, imageFiles);

    // Extract first paragraph for description
    const firstPara = processedContent
      .split('\n\n')
      .find((p) => p.trim() && !p.startsWith('#') && !p.startsWith('!'))
      ?.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 150) || title;

    // Create MDX file
    const frontmatter = createFrontmatter(title, firstPara);
    const mdxContent = frontmatter + processedContent;
    const mdxPath = join(POSTS_DIR, `${slug}.mdx`);

    writeFileSync(mdxPath, mdxContent, 'utf-8');
    console.log(`  Created: ${mdxPath}`);
  }

  // Cleanup
  cleanDir(TEMP_DIR);
  if (existsSync(TEMP_DIR)) {
    rmdirSync(TEMP_DIR);
  }

  console.log('\nImport completed!');
}

// Run
const zipPath = process.argv[2];
if (!zipPath) {
  console.error('Usage: pnpm import-notion <path-to-notion-export.zip>');
  process.exit(1);
}

importNotionZip(zipPath);
