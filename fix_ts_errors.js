const fs = require('fs');

function replaceInFile(path, replacements) {
  let content = fs.readFileSync(path, 'utf8');
  for (let r of replacements) {
    content = content.replace(r.search, r.replace);
  }
  fs.writeFileSync(path, content, 'utf8');
}

// 1. expenses
replaceInFile('src/app/dashboard/expenses/page.tsx', [
  { search: 'a => a.name.toLowerCase()', replace: '(a: any) => a.name.toLowerCase()' }
]);

// 2. khata
replaceInFile('src/app/dashboard/khata/page.tsx', [
  { search: 'inv =>', replace: '(inv: any) =>' },
  { search: 'tx =>', replace: '(tx: any) =>' }
]);

// 3. pos
replaceInFile('src/app/dashboard/pos/page.tsx', [
  { search: '(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()', replace: '((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())' },
  { search: '.then(({ data, error }) =>', replace: '.then(({ data, error }: any) =>' },
  { search: 'document.activeElement.blur()', replace: '(document.activeElement as HTMLElement).blur()' }
]);

// 5. returns
replaceInFile('src/app/dashboard/returns/page.tsx', [
  { search: 'inv =>', replace: '(inv: any) =>' },
  { search: 'po =>', replace: '(po: any) =>' }
]);

// 6. units
replaceInFile('src/app/dashboard/units/page.tsx', [
  { search: 'u =>', replace: '(u: any) =>' } // Will replace the first, need regex for all
]);
let unitContent = fs.readFileSync('src/app/dashboard/units/page.tsx', 'utf8');
unitContent = unitContent.replace(/u =>/g, '(u: any) =>');
fs.writeFileSync('src/app/dashboard/units/page.tsx', unitContent, 'utf8');

console.log("Done");
