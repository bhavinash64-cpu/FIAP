import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'file://' + path.resolve('./node_modules/pdfjs-dist/build/pdf.worker.min.mjs').replace(/\\/g, '/');

const PDF_DIR = "C:/Users/windows/Downloads/";

async function extractAndSaveText() {
  console.log("Extracting and saving PDF text...\n");
  
  const allFiles = fs.readdirSync(PDF_DIR);
  const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`Found ${pdfFiles.length} PDF files`);
  
  for (const pdfFile of pdfFiles) {
    console.log(`\n📄 Processing: ${pdfFile}`);
    
    try {
      const buffer = fs.readFileSync(path.join(PDF_DIR, pdfFile));
      const uint8Array = new Uint8Array(buffer);
      const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      
      console.log(`  Extracted ${doc.numPages} pages`);
      
      if (doc.numPages === 0) {
        console.log("  ⚠️  No pages, skipping");
        continue;
      }
      
      let fullText = "";
      const pagesToRead = Math.min(doc.numPages, 60);
      
      for (let i = 1; i <= pagesToRead; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .filter(item => item.str)
          .map(item => item.str)
          .join(" ");
        fullText += pageText + "\n";
      }
      
      console.log(`  Extracted ${fullText.length} characters`);
      
      if (fullText.length < 100) {
        console.log("  ⚠️  Too little text, skipping");
        continue;
      }
      
      // Save the extracted text for analysis
      const outputPath = `D:/AP Police Wellbeing Hub/extracted-text/${pdfFile.replace('.pdf', '.txt')}`;
      fs.mkdirSync('D:/AP Police Wellbeing Hub/extracted-text', { recursive: true });
      fs.writeFileSync(outputPath, fullText);
      console.log(`  💾 Saved text to ${outputPath}`);
      
      // Show first 1000 chars for analysis
      console.log(`  First 500 chars:`);
      console.log(fullText.substring(0, 500));
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
}

(async () => {
  try {
    await extractAndSaveText();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();