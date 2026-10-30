export type LandingFaq = {
  q: string;
  a: string;
  qUr?: string;
  aUr?: string;
};

export const landingFaqs: LandingFaq[] = [
  {
    q: "Can I use The Accounts offline when internet is disconnected?",
    qUr: "Kya Internet band hone par bhi billing aur sales chal sakti hain?",
    a: "Yes! The Accounts is an offline-first POS. All cash sales and ledger transactions queue safely on your computer or mobile, and automatically sync to the cloud as soon as internet reconnects.",
    aUr: "Jee haan! Internet band hone par bhi aap ki dukaan rukegi nahi. Tamam sales aap ke computer/phone me safe rahen gi aur internet aatay hi automatically cloud par sync ho jayen gi."
  },
  {
    q: "Does it support Thermal Printers, Barcode Scanners and Weight Scales?",
    qUr: "Kya Thermal Printer, Barcode Scanner aur Weight Machine attach ho sakti hai?",
    a: "100% Yes. Standard 80mm and 58mm thermal receipt printers (Xprinter, Sunmi), USB/Wireless Barcode Scanners, and RS232 Serial Weighing Scales connect natively without extra plugins.",
    aUr: "Jee bilkul! Har kisam ka 80mm/58mm Thermal Printer, Barcode Scanner, aur digital Weight Machine directly connect hoti hai bina kisi mushkil ke."
  },
  {
    q: "How does WhatsApp Udhaar and Ledger Reminder work?",
    qUr: "WhatsApp par Udhaar aur Ledger reminder kaise bheja jata hai?",
    a: "With 1-click, send automatic digital receipts and pending Khata balances directly to your customer WhatsApp with a formatted PDF invoice link.",
    aUr: "1-Click se aap apne ghaak (customer) ko unka baki Udhaar, receipt aur mukammal khata PDF invoice ke sath direct unke WhatsApp par bhej sakte hain."
  },
  {
    q: "Does it work on Mobile Phone, Laptop and Computer?",
    qUr: "Kya ye Mobile, Laptop aur Computer sab par chalta hai?",
    a: "Yes! Access your shop records simultaneously from your Windows PC counter, Android phone, iPad, or browser with real-time multi-device sync.",
    aUr: "Jee haan! Aap apni dukaan ka hisab ek sath Mobile, Tablet, Laptop aur PC counter par 24/7 dekh sakte hain."
  },
  {
    q: "How does AI Wholesale Bill Scanner work?",
    qUr: "AI Wholesale Invoice Scanner kaise karta hai kaam?",
    a: "Snap a photo of any supplier invoice or bill. Our AI automatically extracts product names, quantities, buy prices, and loads them straight into your stock.",
    aUr: "Khasidari (wholesaler) ke kaghzi bill ki tasweer khinchein. AI automatically saare products, rates aur stock aap ke system me add kar dega."
  },
  {
    q: "Is my shop data safe and private?",
    qUr: "Kya meri dukaan ka data safe aur mehfooz rahay ga?",
    a: "Your business data is protected with enterprise-grade Supabase RLS encryption and automatic Google Drive cloud backups.",
    aUr: "Aap ka tamam hisab-kitab encrypted database aur daily Google Drive backup ke sath 100% mehfooz aur private rehta hai."
  }
];
