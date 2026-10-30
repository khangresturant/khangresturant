const fs = require('fs');
const path = require('path');

const inputPath = 'C:/Users/Usman/.gemini/antigravity/brain/9c2bb065-50a2-4d72-875b-127a5d25804b/.system_generated/steps/432/output.txt';
const outputPath = 'f:/HISABX/hisabx-web/src/lib/database.types.ts';

try {
    const rawData = fs.readFileSync(inputPath, 'utf8');
    const jsonData = JSON.parse(rawData);
    
    // Create src/lib directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, jsonData.types);
    console.log('Successfully extracted TypeScript types to', outputPath);
} catch (error) {
    console.error('Error extracting types:', error);
}
