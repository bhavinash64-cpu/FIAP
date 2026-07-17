import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker - use local worker file with file:// URL
pdfjsLib.GlobalWorkerOptions.workerSrc = 'file://' + path.resolve('./node_modules/pdfjs-dist/build/pdf.worker.min.mjs').replace(/\\/g, '/');

const PDF_DIR = "C:/Users/windows/Downloads/";

async function extractAllQuestions() {
  console.log("Starting PDF question extraction...\n");
  
  const allFiles = fs.readdirSync(PDF_DIR);
  const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`Found ${pdfFiles.length} PDF files`);
  
  const allQuestions = [];
  
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
      
      const questions = extractQuestionsFromText(fullText, pdfFile);
      console.log(`  ✅ Found ${questions.length} questions`);
      
      questions.forEach((q, idx) => {
        console.log(`    ${idx+1}. ${q.prompt_en.substring(0, 80)}... (${q.kind}, ${q.options?.length || 0} options)`);
      });
      
      allQuestions.push(...questions);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n\n📊 TOTAL QUESTIONS EXTRACTED: ${allQuestions.length}`);
  
  const outputPath = "D:/AP Police Wellbeing Hub/extracted-questions.json";
  fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2));
  console.log(`\n💾 Saved to ${outputPath}`);
  
  // Summary by PDF
  const byPdf = allQuestions.reduce((acc, q) => {
    acc[q.sourcePdf] = (acc[q.sourcePdf] || 0) + 1;
    return acc;
  }, {});
  
  console.log("\n📋 By PDF:");
  Object.entries(byPdf).forEach(([pdf, count]) => {
    console.log(`  ${pdf}: ${count} questions`);
  });
  
  return allQuestions;
}

function extractQuestionsFromText(text, sourcePdf) {
  const questions = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Pattern 1: Numbered questions (1., 1), Q1, Question 1, etc.)
    const numberedMatch = line.match(/^(?:Q(?:uestion)?\s*)?(\d+)[\.)\s]+(.+)/i);
    
    // Pattern 2: Line ends with ?
    const questionMarkMatch = line.match(/^(.+)\?$/);
    
    // Pattern 3: Bullet points that look like questions
    const bulletMatch = line.match(/^[\-\*•]\s+(.+)/);
    
    if (numberedMatch) {
      const text = numberedMatch[2].trim();
      if (text.length > 10) {
        const options = extractOptions(lines, i);
        questions.push({
          prompt_en: text,
          kind: detectQuestionType(text, lines, i, extractOptions(lines, i)),
          options: [],
          sourcePdf: sourcePdf,
          origin: "pdf",
          order_index: questions.length,
        });
      }
    } else if (questionMarkMatch && questionMarkMatch[1].length > 15) {
      const text = questionMarkMatch[1].trim();
      if (!questions.some(q => q.prompt_en === text)) {
        questions.push({
          prompt_en: text,
          kind: detectQuestionType(text, lines, i, []),
          options: [],
          sourcePdf: sourcePdf,
          origin: "pdf",
          order_index: questions.length,
        });
      }
    } else if (bulletMatch && bulletMatch[1].length > 15) {
      const text = bulletMatch[1].trim();
      if (!questions.some(q => q.prompt_en === text)) {
        questions.push({
          prompt_en: text,
          kind: detectQuestionType(text, lines, i, []),
          options: [],
          sourcePdf: sourcePdf,
          origin: "pdf",
          order_index: questions.length,
        });
      }
    }
  }
  
  return questions;
}

function detectQuestionType(text, lines, currentIndex, options) {
  const lowerText = text.toLowerCase();
  
  // Check for options in subsequent lines
  const extractedOptions = extractOptions(lines, 0);
  const hasOptions = extractedOptions && extractedOptions.length >= 2;
  
  if (hasOptions) {
    // Check if it's a Likert scale
    const isLikert = options.some(o => 
      o.label_en && (
        o.label_en.toLowerCase().includes('strongly') || 
        o.label_en.toLowerCase().includes('agree') || 
        o.label_en.toLowerCase().includes('disagree') ||
        o.label_en.toLowerCase().includes('neutral') ||
        o.label_en.toLowerCase().includes('satisfied') ||
        o.label_en.toLowerCase().includes('likely')
      )
    );
    
    if (isLikert) return 'likert5';
    
    // Check for rating scale
    const isRating = options.some(o => 
      o.label_en && (
        o.label_en.match(/\d+\s*-\s*\d+/) || 
        o.label_en.toLowerCase().includes('rate') ||
        o.label_en.toLowerCase().includes('scale')
      )
    );
    
    if (isRating) return 'rating5';
    
    // Check for yes/no
    const isYesNo = options.length === 2 && 
      (options[0].label_en?.toLowerCase().includes('yes') || options[0].label_en?.toLowerCase().includes('no')) &&
      (options[1].label_en?.toLowerCase().includes('yes') || options[1].label_en?.toLowerCase().includes('no'));
    
    if (isYesNo) return 'yes_no';
    
    // Default to multiple choice
    return 'multiple_choice';
  }
  
  // Check for text questions
  if (lowerText.includes('describe') || lowerText.includes('explain') || 
      lowerText.includes('elaborate') || lowerText.includes('comment') ||
      lowerText.includes('feedback') || lowerText.includes('suggest') ||
      lowerText.includes('open') || lowerText.includes('detail')) {
    return 'long_text';
  }
  
  if (lowerText.includes('name') || lowerText.includes('email') || 
      lowerText.includes('phone') || lowerText.includes('address') ||
      lowerText.includes('age') || lowerText.includes('gender') ||
      lowerText.includes('occupation') || lowerText.includes('education')) {
    return 'short_text';
  }
  
  // Default
  return 'short_text';
}

function extractOptions(lines, currentIndex) {
  const options = [];
  for (let i = currentIndex + 1; i < Math.min(lines.length, currentIndex + 20); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const optMatch = line.match(/^[\-\*•]\s+(.+)|^\d+[\.)]\s+(.+)|^[a-zA-Z][\.)]\s+(.+)/);
    if (optMatch) {
      const text = optMatch[1] || optMatch[2] || optMatch[3];
      if (text && text.length > 0) {
        options.push({
          label_en: text.trim(),
          label_te: null,
          order_index: options.length,
        });
      }
    } else if (options.length > 0 && !line.match(/^[\-\*•\d\*]/)) {
      break;
    }
  }
  return options;
}

// Main execution
(async () => {
  try {
    await extractAllQuestions();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();