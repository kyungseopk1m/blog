import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');

// SVG 파일 읽기
const faviconSvg = readFileSync(join(projectRoot, 'public', 'favicon.svg'), 'utf-8');

// 1200x630 OG 이미지 생성
// SVG를 크게 확대하고 중앙에 배치
const ogWidth = 1200;
const ogHeight = 630;

// 유령이 꽉 차도록 크기 조정 (약간의 여백만 남김)
const ghostSize = Math.min(ogWidth * 0.7, ogHeight * 0.9); // 높이 기준으로 90% 사용

// SVG 크기 조정 및 중앙 정렬을 위한 wrapper SVG 생성
const ogSvg = `
<svg width="${ogWidth}" height="${ogHeight}" xmlns="http://www.w3.org/2000/svg">
  <!-- 투명 배경 -->
  <rect width="${ogWidth}" height="${ogHeight}" fill="transparent"/>

  <!-- favicon.svg 확대 및 중앙 배치 -->
  <g transform="translate(${(ogWidth - ghostSize) / 2}, ${(ogHeight - ghostSize) / 2}) scale(${ghostSize / 100})">
    ${faviconSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1]}
  </g>
</svg>
`;

// PNG로 변환
await sharp(Buffer.from(ogSvg))
  .png()
  .toFile(join(projectRoot, 'public', 'og-image.png'));

console.log('✅ OG image created: public/og-image.png');
console.log(`   Size: ${ogWidth}x${ogHeight}`);
console.log('   Style: Minimal (favicon enlarged, no background)');
