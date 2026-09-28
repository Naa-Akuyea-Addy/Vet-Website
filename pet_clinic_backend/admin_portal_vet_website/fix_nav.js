const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname);

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'Dashboard.html');

const canonicalNavigateTo = `
      function navigateTo(section) {
        const pageMap = {
          analytics: "Dashboard.html",
          calendar: "clinic_calendar.html",
          staff: "staff_service_settings.html",
          appointment: "appointment.html",
          billing: "billing.html",
          records: "records.html",
          inventory: "inventory.html",
          message: "message.html",
          emergency: "emergency_management.html",
          mortuary: "mortuary.html",
          reports: "report.html",
          settings: "settings.html"
        };
        if (pageMap[section]) window.location.href = pageMap[section];
      }`;

const desktopListener = `
      document.querySelectorAll("[data-nav-desktop]").forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const section = link.getAttribute("data-nav-desktop");
          navigateTo(section);
        });
      });`;

const mobileListener = `
      document.querySelectorAll("[data-nav-mobile]").forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const section = link.getAttribute("data-nav-mobile");
          navigateTo(section);
          try { closeMobileSidebarFunc(); } catch(err) {}
        });
      });`;

files.forEach(f => {
  const fPath = path.join(dir, f);
  let c = fs.readFileSync(fPath, 'utf8');
  
  // Step 1: Fix mobile/desktop nav attribute value: appointments -> appointment
  c = c.replace(/data-nav-mobile="appointments"/g, 'data-nav-mobile="appointment"');
  c = c.replace(/data-nav-desktop="appointments"/g, 'data-nav-desktop="appointment"');
  c = c.replace(/data-nav-mobile='appointments'/g, "data-nav-mobile='appointment'");
  c = c.replace(/data-nav-desktop='appointments'/g, "data-nav-desktop='appointment'");

  const hasNavigateTo = c.includes('function navigateTo');
  const hasDesktopListener = /querySelectorAll\(['"]\[data-nav-desktop\]['"]\)/.test(c) &&
                              c.includes('addEventListener');

  if (hasNavigateTo) {
    // Step 2: Replace existing navigateTo function with canonical version
    // Match: function navigateTo(section) { ... } 
    // We need to find the function body and replace it
    
    // Strategy: Find "function navigateTo" and replace the entire function
    const navStart = c.indexOf('function navigateTo');
    if (navStart !== -1) {
      // Find the matching closing brace of the function
      let braceCount = 0;
      let startBrace = c.indexOf('{', navStart);
      let pos = startBrace;
      let end = -1;
      while (pos < c.length) {
        if (c[pos] === '{') braceCount++;
        else if (c[pos] === '}') {
          braceCount--;
          if (braceCount === 0) { end = pos + 1; break; }
        }
        pos++;
      }
      if (end !== -1) {
        const oldNavTo = c.substring(navStart, end);
        c = c.substring(0, navStart) + canonicalNavigateTo.trimStart() + c.substring(end);
      }
    }

    // Step 3: If pageMap is defined outside the function (like in mortuary, report), 
    // remove standalone pageMap const block before navigateTo
    // Pattern: const pageMap = { ... }; followed shortly by function navigateTo
    c = c.replace(/const pageMap\s*=\s*\{[^}]+\};\s*\n\s*(function navigateTo)/g, '$1');

    console.log(`  Fixed navigateTo in ${f}`);
  } else {
    // Page has no navigateTo - need to add it + listeners before </script>
    // Find the last </script> tag in the file
    const lastScriptEnd = c.lastIndexOf('</script>');
    if (lastScriptEnd !== -1) {
      const insertCode = canonicalNavigateTo + desktopListener + mobileListener + '\n';
      c = c.substring(0, lastScriptEnd) + insertCode + '\n    ' + c.substring(lastScriptEnd);
      console.log(`  Added navigateTo+listeners to ${f}`);
    }
  }

  fs.writeFileSync(fPath, c, 'utf8');
  console.log(`Processed: ${f}`);
});

console.log('\nAll files processed.');
