const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'pet_clinic_backend', 'admin_portal_vet_website');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace #2e7d82 (primary-container) with var(--color-primary)
  content = content.replace(/#2e7d82/g, 'var(--color-primary, #2e7d82)');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Patched primary-container in', file);
});
