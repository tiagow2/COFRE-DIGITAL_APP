const fs = require('fs');
const path = require('path');

const tabsDir = path.join(__dirname, 'app', '(app)', '(tabs)');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Fix ScrollView paddingBottom
  content = content.replace(/contentContainerStyle=\{\{([^}]*?)paddingBottom:\s*(\d+)([^}]*?)\}\}/g, (match, before, pb, after) => {
    const newPb = content.includes('s.fab') ? 140 : 120;
    if (parseInt(pb) >= 120) return match;
    return `contentContainerStyle={{${before}paddingBottom: ${newPb}${after}}}`;
  });

  // Specifically target classes in StyleSheet we know hold scroll views
  content = content.replace(/scrollContent:\s*\{([^}]*?)paddingBottom:\s*\d+([^}]*?)\}/g, "scrollContent: { $1paddingBottom: 140 $2}");
  content = content.replace(/listContent:\s*\{([^}]*?)paddingBottom:\s*\d+([^}]*?)\}/g, "listContent: { $1paddingBottom: 120 $2}");
  content = content.replace(/content:\s*\{([^}]*?)paddingBottom:\s*\d+([^}]*?)\}/g, "content: { $1paddingBottom: 140 $2}");
  content = content.replace(/scroll:\s*\{([^}]*?)paddingBottom:\s*\d+([^}]*?)\}/g, "scroll: { $1paddingBottom: 140 $2}");

  // Ensure 'content' object without padding gets padding
  content = content.replace(/content:\s*\{\s*padding:\s*20\s*\}/g, "content: { padding: 20, paddingBottom: 140 }");

  // 2. Fix Text overflows. Add numberOfLines={1} ellipsizeMode="tail" to elements wrapping {fmt(...)}
  content = content.replace(/<Text([^>]*?)>(\{fmt\([^}]+\)\}|R\$\s*\{[^}]+\})<\/Text>/g, (match, attrs, inner) => {
    if (attrs.includes('numberOfLines')) return match;
    return `<Text${attrs} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>${inner}</Text>`;
  });
  
  content = content.replace(/<Text([^>]*?)>(••••\s*\{[^}]+\})<\/Text>/g, (match, attrs, inner) => {
    if (attrs.includes('numberOfLines')) return match;
    return `<Text${attrs} numberOfLines={1} ellipsizeMode="tail">${inner}</Text>`;
  });
  
  content = content.replace(/<Text([^>]*?)>(\{card\.name\}|\{tx\.description\}|\{tx\.category\}|\{b\.category\}|\{c\.title\})<\/Text>/g, (match, attrs, inner) => {
    if (attrs.includes('numberOfLines')) return match;
    return `<Text${attrs} numberOfLines={1} ellipsizeMode="tail">${inner}</Text>`;
  });

  // Fix header text for large greetings
  content = content.replace(/<Text([^>]*?)>Olá, \{firstName\}<\/Text>/g, (match, attrs) => {
    if (attrs.includes('numberOfLines')) return match;
    return `<Text${attrs} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>Olá, {firstName}</Text>`;
  });

  // Fix Flex Shrink on row containers
  content = content.replace(/txRow:\s*\{([^}]*?)\}/g, (match, inner) => {
    if (inner.includes('flexShrink')) return match;
    return `txRow: {${inner} flexShrink: 1 }`;
  });
  
  // also txName container
  content = content.replace(/<View style=\{\{\s*flexDirection:\s*'row',\s*alignItems:\s*'center',\s*gap:\s*6\s*\}\}>/g, "<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>");

  // ensure balance shrinks if too big
  content = content.replace(/<Text style=\{(\[s\.balance[^\]]*\]|s\.balance)\}>(\{fmt\(balance\)\})<\/Text>/g, '<Text style={$1} numberOfLines={1} adjustsFontSizeToFit>$2</Text>');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.basename(filePath)}`);
  }
}

const files = fs.readdirSync(tabsDir).filter(f => f.endsWith('.tsx'));
files.forEach(f => processFile(path.join(tabsDir, f)));

const appIndex = path.join(__dirname, 'app', 'index.tsx');
if (fs.existsSync(appIndex)) processFile(appIndex);

console.log("Done.");