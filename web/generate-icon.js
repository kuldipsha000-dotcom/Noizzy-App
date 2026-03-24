import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, 'public', 'logo.svg');
const pngPath = path.join(__dirname, 'public', 'logo.png');

async function convert() {
    try {
        await sharp(svgPath)
            .resize(256, 256)
            .png()
            .toFile(pngPath);
        console.log('Successfully generated logo.png');
    } catch (err) {
        console.error('Error converting SVG to PNG:', err);
    }
}

convert();
