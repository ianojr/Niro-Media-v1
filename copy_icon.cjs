const fs = require('fs');
const path = require('path');
const SRC = 'C:\\\\Users\\\\Hp\\\\.gemini\\\\antigravity\\\\brain\\\\39e8aefb-0c78-4351-a232-134b2e5ed2c3\\\\niro_media_icon_1774192810631.png';
const DEST = 'icon_source.png';
fs.copyFileSync(SRC, DEST);
console.log('Copied to icon_source.png');
