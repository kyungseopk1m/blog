import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, rmSync, statSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import AdmZip from 'adm-zip';

const POSTS_DIR = 'src/content/posts';
const IMAGES_DIR = 'public/images/posts';
const TEMP_DIR = '.notion-temp';
const NOTION_IMPORTS_DIR = 'notion-imports';

interface ImportResult {
  added: string[];
  skipped: string[];
  updated: string[];
  errors: { file: string; error: string }[];
}

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
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  }
}

interface PostMetadata {
  title: string;
  pubDate: string;
  subtitle?: string;
  category: string;
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

function extractMetadata(markdown: string, filename: string): PostMetadata {
  const title = extractTitle(markdown, filename);
  let pubDate = new Date().toISOString().split('T')[0];
  let subtitle: string | undefined;
  let category = 'Uncategorized';

  // Extract metadata from content
  const lines = markdown.split('\n');

  for (const line of lines) {
    // 작성일: YYYY년 MM월 DD일
    const dateMatch = line.match(/작성일:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      pubDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 부제: ...
    const subtitleMatch = line.match(/부제:\s*(.+)$/);
    if (subtitleMatch) {
      subtitle = subtitleMatch[1].trim();
    }

    // 카테고리: ...
    const categoryMatch = line.match(/카테고리:\s*(.+)$/);
    if (categoryMatch) {
      category = categoryMatch[1].trim();
    }
  }

  return { title, pubDate, subtitle, category };
}

function processMarkdownContent(
  content: string,
  slug: string,
  imageFiles: Map<string, string>,
  originalTitle: string
): string {
  let processed = content;

  // Remove first h1 if exists (will be in frontmatter)
  processed = processed.replace(/^#\s+.+\n+/, '');

  // Remove metadata lines (작성일, 부제, 카테고리)
  processed = processed.replace(/^작성일:\s*.+\n/m, '');
  processed = processed.replace(/^부제:\s*.+\n/m, '');
  processed = processed.replace(/^카테고리:\s*.+\n/m, '');

  // Remove leading empty lines
  processed = processed.replace(/^\n+/, '');

  // Update image paths
  imageFiles.forEach((newPath, originalName) => {
    const escapedName = originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // URL encode the original title for matching Notion's export format
    const encodedTitle = encodeURIComponent(originalTitle);
    // Escape regex special characters in the encoded title (important for titles with parentheses)
    const escapedEncodedTitle = encodedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match image references with various path formats
    const patterns = [
      // Direct filename: ![alt](image.png)
      new RegExp(`!\\[([^\\]]*)\\]\\(${escapedName}\\)`, 'g'),
      // With folder: ![alt](folder/image.png)
      new RegExp(`!\\[([^\\]]*)\\]\\([^)]*/${escapedName}\\)`, 'g'),
      // With ./ prefix: ![alt](./image.png)
      new RegExp(`!\\[([^\\]]*)\\]\\(\\.?/?${escapedName}\\)`, 'g'),
      // URL encoded folder with filename: ![alt](%EC%9A%B0%EB%A6%AC.../image.png)
      // This matches Notion's export format with URL-encoded folder names
      new RegExp(`!\\[([^\\]]*)\\]\\(${escapedEncodedTitle}/${escapedName}\\)`, 'g'),
      // Any URL-encoded path containing the filename
      new RegExp(`!\\[([^\\]]*)\\]\\([^)]*%[0-9A-F]{2}[^)]*/${escapedName}\\)`, 'gi'),
    ];

    patterns.forEach((pattern) => {
      processed = processed.replace(pattern, `![$1](${newPath})`);
    });
  });

  return processed.trim();
}

function createFrontmatter(metadata: PostMetadata, description: string): string {
  return `---
title: "${metadata.title.replace(/"/g, '\\"')}"
pubDate: ${metadata.pubDate}
description: "${description.replace(/"/g, '\\"')}"
category: "${metadata.category}"
draft: false
---

`;
}

function getExistingSlugs(): Set<string> {
  const slugs = new Set<string>();

  if (!existsSync(POSTS_DIR)) {
    return slugs;
  }

  const files = readdirSync(POSTS_DIR);
  for (const file of files) {
    if (file.endsWith('.mdx') || file.endsWith('.md')) {
      const slug = basename(file, extname(file));
      slugs.add(slug);
    }
  }

  return slugs;
}

function getAllZipFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  return readdirSync(dirPath)
    .filter(file => file.endsWith('.zip'))
    .map(file => join(dirPath, file));
}

function importNotionZip(zipPath: string, existingSlugs: Set<string>, forceOverwrite: boolean): ImportResult {
  console.log(`\nProcessing: ${basename(zipPath)}`);

  const result: ImportResult = {
    added: [],
    skipped: [],
    updated: [],
    errors: [],
  };

  if (!existsSync(zipPath)) {
    result.errors.push({ file: zipPath, error: 'File not found' });
    return result;
  }

  // Clean and create temp directory
  cleanDir(TEMP_DIR);
  mkdirSync(TEMP_DIR, { recursive: true });

  // Extract ZIP
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(TEMP_DIR, true);

  // Handle nested ZIPs (Notion often exports as nested ZIP)
  const extractNestedZips = (dir: string) => {
    const items = readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = join(dir, item.name);

      if (item.isDirectory()) {
        extractNestedZips(fullPath);
      } else if (item.name.endsWith('.zip')) {
        console.log(`  📦 Found nested ZIP: ${item.name}`);
        try {
          const nestedZip = new AdmZip(fullPath);
          const extractDir = join(dir, basename(item.name, '.zip'));
          mkdirSync(extractDir, { recursive: true });
          nestedZip.extractAllTo(extractDir, true);
          console.log(`  📂 Extracted to: ${basename(extractDir)}`);

          // Recursively extract any further nested ZIPs
          extractNestedZips(extractDir);
        } catch (error) {
          console.error(`  ❌ Failed to extract nested ZIP: ${item.name}`);
        }
      }
    }
  };

  extractNestedZips(TEMP_DIR);

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
    try {
      const content = readFileSync(mdFile, 'utf-8');
      const metadata = extractMetadata(content, mdFile);
      const slug = slugify(metadata.title);
      const mdxPath = join(POSTS_DIR, `${slug}.mdx`);
      const alreadyExists = existingSlugs.has(slug);

      // Skip if already exists and not force overwriting
      if (alreadyExists && !forceOverwrite) {
        console.log(`  ⏭️  Skipped: ${metadata.title} (already exists)`);
        result.skipped.push(slug);
        continue;
      }

      const actionLabel = alreadyExists ? '  ♻️  Updating' : '  ➕ Adding';
      console.log(`${actionLabel}: ${metadata.title} -> ${slug}`);

    // Find and copy images
    const imageFiles = new Map<string, string>();
    const mdDir = dirname(mdFile);
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

    // Look for images in the same directory and subdirectory with same name
    const dirsToCheck = [mdDir];

    // Check for subdirectory with same name as the post (Notion export pattern)
    const titleWithoutUuid = basename(mdFile, '.md').replace(/\s+[a-f0-9]{32}$/i, '');
    const possibleImageDir = join(mdDir, titleWithoutUuid);
    if (existsSync(possibleImageDir)) {
      dirsToCheck.push(possibleImageDir);
    }

    for (const dirToCheck of dirsToCheck) {
      if (existsSync(dirToCheck)) {
        const items = readdirSync(dirToCheck);

        for (const item of items) {
          const itemPath = join(dirToCheck, item);
          const ext = extname(item).toLowerCase();

          if (imageExtensions.includes(ext)) {
            const imageSlugDir = join(IMAGES_DIR, slug);
            mkdirSync(imageSlugDir, { recursive: true });

            const newImageName = item; // Keep original name for simpler path matching
            const newImagePath = join(imageSlugDir, newImageName);
            const webPath = `/images/posts/${slug}/${newImageName}`;

            copyFileSync(itemPath, newImagePath);
            imageFiles.set(item, webPath);

            console.log(`  Copied image: ${item} -> ${webPath}`);
          }
        }
      }
    }

    // Process content
    const processedContent = processMarkdownContent(content, slug, imageFiles, metadata.title);

    // Extract first paragraph for description
    // Use subtitle if available, otherwise use first paragraph
    let description: string;
    if (metadata.subtitle) {
      description = metadata.subtitle;
    } else {
      const firstPara = processedContent
        .split('\n\n')
        .find((p) => p.trim() && !p.startsWith('#') && !p.startsWith('!'))
        ?.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .slice(0, 150);
      description = firstPara || metadata.title;
    }

      // Create MDX file
      const frontmatter = createFrontmatter(metadata, description);
      const mdxContent = frontmatter + processedContent;

      writeFileSync(mdxPath, mdxContent, 'utf-8');
      console.log(`  ✅ Success: ${mdxPath}`);

      if (alreadyExists) {
        result.updated.push(slug);
        existingSlugs.add(slug); // Update the set for next iteration
      } else {
        result.added.push(slug);
        existingSlugs.add(slug);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error processing ${basename(mdFile)}: ${errorMsg}`);
      result.errors.push({ file: basename(mdFile), error: errorMsg });
    }
  }

  // Cleanup
  cleanDir(TEMP_DIR);

  return result;
}

function printSummary(results: ImportResult[]) {
  const totals = results.reduce(
    (acc, result) => ({
      added: acc.added + result.added.length,
      skipped: acc.skipped + result.skipped.length,
      updated: acc.updated + result.updated.length,
      errors: acc.errors + result.errors.length,
    }),
    { added: 0, skipped: 0, updated: 0, errors: 0 }
  );

  console.log('\n' + '='.repeat(50));
  console.log('📊 Import Summary');
  console.log('='.repeat(50));
  console.log(`✅ Added:   ${totals.added} post(s)`);
  console.log(`♻️  Updated: ${totals.updated} post(s)`);
  console.log(`⏭️  Skipped: ${totals.skipped} post(s)`);
  console.log(`❌ Errors:  ${totals.errors} error(s)`);
  console.log('='.repeat(50));

  // Show errors if any
  if (totals.errors > 0) {
    console.log('\n⚠️  Errors:');
    results.forEach(result => {
      result.errors.forEach(err => {
        console.log(`  - ${err.file}: ${err.error}`);
      });
    });
  }

  console.log('\n✨ Import completed!\n');
}

// Run
const args = process.argv.slice(2);
const forceFlag = args.includes('--force') || args.includes('-f');
const pathArg = args.find(arg => !arg.startsWith('-'));

let zipPaths: string[] = [];

if (pathArg) {
  // Single file or directory provided
  if (existsSync(pathArg)) {
    const stat = statSync(pathArg);
    if (stat.isDirectory()) {
      zipPaths = getAllZipFiles(pathArg);
    } else if (pathArg.endsWith('.zip')) {
      zipPaths = [pathArg];
    } else {
      console.error('❌ Error: Provided path must be a .zip file or directory');
      process.exit(1);
    }
  } else {
    console.error(`❌ Error: Path not found: ${pathArg}`);
    process.exit(1);
  }
} else {
  // No path provided, use default notion-imports directory
  zipPaths = getAllZipFiles(NOTION_IMPORTS_DIR);
}

if (zipPaths.length === 0) {
  console.error('❌ No .zip files found to import');
  console.log('\nUsage:');
  console.log('  pnpm import-notion                    # Import all from notion-imports/');
  console.log('  pnpm import-notion <path.zip>         # Import single file');
  console.log('  pnpm import-notion <directory>        # Import all from directory');
  console.log('  pnpm import-notion --force            # Overwrite existing posts');
  process.exit(1);
}

console.log('🚀 Starting Notion Import');
console.log(`📁 Processing ${zipPaths.length} file(s)`);
console.log(`🔄 Force overwrite: ${forceFlag ? 'YES' : 'NO'}`);

const existingSlugs = getExistingSlugs();
console.log(`📝 Found ${existingSlugs.size} existing post(s)\n`);

const results: ImportResult[] = [];

for (const zipPath of zipPaths) {
  const result = importNotionZip(zipPath, existingSlugs, forceFlag);
  results.push(result);
}

printSummary(results);
