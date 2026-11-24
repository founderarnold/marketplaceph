// Starter job posts for MarketplacePH (Task B). Edit the wording here, then run
//   node scripts/build-starter-jobs-seed.mjs
// to regenerate supabase/seeds/jobs_starter_posts.sql. The seed inserts every post as a HIDDEN draft;
// an admin fills in the pay range and location, then publishes it from Admin → Jobs.
//
// Rules for every post (checked by tests/starter-jobs.test.ts):
// - no age, gender, civil status, height or appearance requirements;
// - the no-fee notice is included;
// - commission-based partner roles say so plainly and are never shown as salaried employment;
// - real estate roles cite the PRC licence / accreditation rules of RA 9646.

/** Marker the admin editor looks for: a post cannot be published while any placeholder is left. */
export const PLACEHOLDER = "[ADMIN TO FILL";

export const NO_FEE_NOTICE =
  "No-fee notice: MarketplacePH and this employer never ask applicants for money at any step: applying, interviews, " +
  "requirements or hiring. If anyone asks you to pay, do not send money and report the post on MarketplacePH.";

export const PARTNER_NOTICE =
  "Commission-based partner opportunity. This is NOT salaried employment: there is no fixed salary, and you earn only a " +
  "commission on completed sales under a written partner agreement. No fees, deposits or starter kits are required to join.";

export const RA9646_NOTICE =
  "Real estate service practice in the Philippines is regulated by the Real Estate Service Act (RA 9646) and the PRC.";

/** Employers and how the seed finds their account: the owner of the oldest store whose name matches `storeLike`. */
export const EMPLOYERS = {
  managers_pizza: { company: "Manager's Pizza", storeLike: ["%manager%pizza%"] },
  marketplaceph: { company: "MarketplacePH Online Store", storeLike: ["%marketplaceph%", "%marketplace ph%"] },
  primebrands: { company: "PrimeBrands Food Hub", storeLike: ["%primebrands%", "%prime brands%"] },
  negosyodepot: { company: "NegosyoDepot", storeLike: ["%negosyodepot%", "%negosyo depot%"] },
};

/** @typedef {{ key: string; employer: keyof typeof EMPLOYERS; title: string; category: string; employment_type: string; work_setup: string; vacancies?: number; summary: string; responsibilities: string[]; qualifications: string[]; partner?: boolean; realEstate?: boolean; location?: string }} StarterJob */

/** @type {StarterJob[]} */
export const JOBS = [
  // ── Manager's Pizza (provincial branches) ──
  {
    key: "mp-rider", employer: "managers_pizza", title: "Delivery Rider (Motorcycle)", category: "logistics_driving", employment_type: "full_time", work_setup: "onsite", vacancies: 3,
    location: "Manager's Pizza provincial branch",
    summary: "Deliver hot pizzas and orders from our branch to customers safely and on time.",
    responsibilities: ["Pick up orders from the branch and check them against the receipt", "Deliver orders safely within the branch's delivery area", "Collect payments or confirm online payments and turn over cash at end of shift", "Keep the delivery bag and motorcycle clean and in good condition", "Report road, customer or order problems to the shift supervisor"],
    qualifications: ["Valid professional driver's license (motorcycle)", "Own motorcycle with OR/CR is an advantage; ask the branch about company units", "Knows the roads in and around the branch area", "Safe, courteous and reliable"],
  },
  {
    key: "mp-baker", employer: "managers_pizza", title: "Baker (Pizza and Breads)", category: "food_hospitality", employment_type: "full_time", work_setup: "onsite",
    location: "Manager's Pizza provincial branch / commissary",
    summary: "Prepare pizza dough, breads and baked items following our recipes and food safety standards.",
    responsibilities: ["Mix, proof and portion pizza dough and other doughs to recipe", "Bake products to the right color, texture and timing", "Follow food safety, hygiene and FIFO stock rotation", "Record production counts and report low ingredients", "Guide and check the work of assistant bakers"],
    qualifications: ["At least 1 year of baking experience, or TESDA Bread and Pastry Production NC II", "Able to follow recipes and measurements exactly", "Health certificate / food handler training, or willing to get one", "Willing to work early shifts and weekends"],
  },
  {
    key: "mp-assistant-baker", employer: "managers_pizza", title: "Assistant Baker", category: "food_hospitality", employment_type: "full_time", work_setup: "onsite",
    location: "Manager's Pizza provincial branch / commissary",
    summary: "Help the baker prepare dough and baked items and keep the kitchen clean and ready. Good first job in food production; we train you.",
    responsibilities: ["Weigh and prepare ingredients", "Help mix, portion and shape dough", "Clean tools, trays and work areas", "Pack and label finished products", "Follow food safety and hygiene rules"],
    qualifications: ["No experience needed; willing to learn", "Can follow instructions and work in a team", "Health certificate, or willing to get one", "Willing to work shifts and weekends"],
  },
  {
    key: "mp-management-trainee", employer: "managers_pizza", title: "Management Trainee (Branch Operations)", category: "food_hospitality", employment_type: "full_time", work_setup: "onsite",
    location: "Manager's Pizza provincial branch",
    summary: "Learn to run a Manager's Pizza branch: operations, people, inventory, sales and customer service, through a structured training program.",
    responsibilities: ["Rotate through kitchen, cashier, delivery and inventory stations", "Help prepare daily sales, cash and stock reports", "Support the branch manager in scheduling and team huddles", "Handle customer concerns with the supervisor", "Complete training modules and on-the-job assessments"],
    qualifications: ["College level or graduate in any course, or equivalent work experience", "Interest in food business, sales or management", "Basic computer and spreadsheet skills", "Willing to train in another branch or city if needed"],
  },
  {
    key: "mp-field-marketing-assistant", employer: "managers_pizza", title: "Field Marketing Assistant", category: "sales_marketing", employment_type: "full_time", work_setup: "onsite",
    location: "Manager's Pizza provincial branch area",
    summary: "Bring Manager's Pizza to the community: product sampling, flyering, school and office tie-ups, and local events.",
    responsibilities: ["Run sampling and flyering activities near the branch", "Visit schools, offices and barangays for bulk-order and event tie-ups", "Set up booths at local events and fairs", "Collect leads and feedback, and post activity photos for the branch page", "Report results to the marketing supervisor"],
    qualifications: ["At least senior high school graduate", "Comfortable talking to people and presenting products", "Has a smartphone and basic social media skills", "Willing to do field work around the branch area"],
  },

  // ── PrimeBrands Food Hub ──
  {
    key: "pb-delivery-driver", employer: "primebrands", title: "Delivery Driver (4-Wheel)", category: "logistics_driving", employment_type: "full_time", work_setup: "onsite",
    summary: "Drive our delivery vehicle to bring food products and supplies to resellers, branches and customers.",
    responsibilities: ["Load, check and deliver orders following the daily route", "Keep delivery receipts signed and turned over", "Do basic vehicle checks and report maintenance needs", "Follow traffic rules and safe-driving practices", "Help unload and arrange deliveries at the drop-off point"],
    qualifications: ["Valid professional driver's license with the right restriction code for the vehicle", "At least 1 year of driving experience for deliveries", "Knows major routes in the service area", "Clean driving record"],
  },
  {
    key: "pb-marketing-supervisor", employer: "primebrands", title: "Marketing Supervisor", category: "sales_marketing", employment_type: "full_time", work_setup: "hybrid",
    summary: "Lead a small marketing team that grows PrimeBrands Food Hub's reseller network, promotions and online presence.",
    responsibilities: ["Plan and run monthly promotions with the sales team", "Supervise marketing associates and field marketing staff", "Manage the content calendar and social media pages", "Track results: leads, reseller sign-ups and sales from campaigns", "Coordinate with suppliers and partners for joint promotions"],
    qualifications: ["Bachelor's degree in marketing, business or a related field, or equivalent experience", "At least 2 years in marketing, with some team-lead experience", "Good with social media tools and simple reports", "Clear communication in English and Filipino"],
  },

  // ── NegosyoDepot stores ──
  {
    key: "nd-sales-staff", employer: "negosyodepot", title: "Sales Staff (Store)", category: "retail", employment_type: "full_time", work_setup: "onsite", vacancies: 2,
    location: "NegosyoDepot store",
    summary: "Help walk-in and online customers choose business packages, equipment and supplies, and keep the store organized.",
    responsibilities: ["Welcome customers and explain products and business packages", "Process sales, receipts and simple paperwork", "Keep shelves stocked, priced and tidy", "Follow up inquiries from Messenger and phone", "Count inventory and report fast-moving and low items"],
    qualifications: ["At least senior high school graduate", "Sales or customer service experience is an advantage", "Good with basic math and a calculator or POS", "Friendly, honest and reliable"],
  },
  {
    key: "nd-marketing-associate", employer: "negosyodepot", title: "Marketing Associate", category: "sales_marketing", employment_type: "full_time", work_setup: "hybrid",
    summary: "Create content and run simple campaigns that help aspiring entrepreneurs discover NegosyoDepot business packages.",
    responsibilities: ["Write posts and short videos for Facebook, TikTok and the website", "Answer comments and route inquiries to sales", "Help organize webinars and store events", "Track post reach and leads in a simple weekly report", "Keep product photos and descriptions up to date"],
    qualifications: ["College level or graduate, preferably in marketing, communication or business", "Basic Canva and social media skills", "Good writing in English and Filipino", "Portfolio of posts or sample content is a plus"],
  },
  {
    key: "nd-it-staff", employer: "negosyodepot", title: "IT Staff", category: "it_tech", employment_type: "full_time", work_setup: "onsite",
    location: "NegosyoDepot store / office",
    summary: "Keep our stores' computers, POS, network and accounts running smoothly and securely.",
    responsibilities: ["Set up and maintain computers, printers, POS and Wi-Fi", "Manage user accounts, passwords and backups", "Troubleshoot staff IT problems and keep a simple ticket log", "Coordinate with internet and software providers", "Follow basic data privacy and security practices"],
    qualifications: ["Graduate of IT, computer science or a related course, or TESDA Computer Systems Servicing NC II", "Hands-on hardware and network troubleshooting skills", "Familiar with Google Workspace or Microsoft 365", "Willing to visit stores when needed"],
  },

  // ── MarketplacePH online store ──
  {
    key: "mph-affiliate-marketer", employer: "marketplaceph", title: "Affiliate Marketer (Commission-Based Partner)", category: "sales_marketing", employment_type: "freelance", work_setup: "remote", vacancies: 50,
    partner: true, location: "Anywhere in the Philippines (online)",
    summary: "Share MarketplacePH products and stores with your network and earn a commission on completed sales made through your affiliate link.",
    responsibilities: ["Share products using your own affiliate link on social media or chat groups", "Post honest product information; no false claims or fake reviews", "Answer basic questions and refer buyers to the seller", "Follow the MarketplacePH affiliate rules and the Data Privacy Act"],
    qualifications: ["Has a smartphone and active social media accounts", "Good at writing simple, honest posts", "Can work on your own schedule", "Must agree to the written affiliate partner terms"],
  },
  {
    key: "mph-dropshipper", employer: "marketplaceph", title: "Dropshipper / Reseller (Commission-Based Partner)", category: "sales_marketing", employment_type: "freelance", work_setup: "remote", vacancies: 50,
    partner: true, location: "Anywhere in the Philippines (online)",
    summary: "Sell products from MarketplacePH suppliers in your own online channels. The supplier ships the order; you earn the agreed margin or commission on completed orders.",
    responsibilities: ["Choose products from participating suppliers", "Post accurate product details and prices in your channels", "Take orders and pass them correctly to the supplier", "Keep buyers updated and handle simple after-sales questions", "Follow consumer protection and platform rules"],
    qualifications: ["Has a smartphone and at least one online selling channel", "Organized and responsive to buyers", "Basic record-keeping of orders and earnings", "Must agree to the written reseller partner terms"],
  },
  {
    key: "mph-web-developer", employer: "marketplaceph", title: "Web Developer", category: "it_tech", employment_type: "full_time", work_setup: "remote",
    summary: "Build and improve the MarketplacePH web app used by Filipino MSMEs, buyers and job seekers, with a focus on fast, mobile-first pages.",
    responsibilities: ["Build features in Next.js, React and TypeScript", "Work with Supabase (Postgres, row level security, storage)", "Write tests and keep pages fast and accessible on low-end phones", "Review code and fix reported bugs", "Document changes and follow safe release steps"],
    qualifications: ["Experience with React or Next.js and TypeScript", "Comfortable with SQL and basic security practices", "Portfolio or GitHub with real projects", "Good written English; Filipino is a plus"],
  },
  {
    key: "mph-mobile-app-developer", employer: "marketplaceph", title: "Mobile App Developer", category: "it_tech", employment_type: "full_time", work_setup: "remote",
    summary: "Help bring MarketplacePH to Android and iOS with a fast, reliable app for sellers, buyers and riders.",
    responsibilities: ["Build mobile app screens and features (React Native or Flutter)", "Connect the app to existing APIs and authentication", "Test on low-end Android devices and slow networks", "Prepare app store releases with the team", "Fix bugs and improve performance"],
    qualifications: ["Experience building and publishing at least one mobile app", "Knows React Native or Flutter", "Understands REST/JSON APIs and secure sign-in", "Portfolio or app store links"],
  },
  {
    key: "mph-marketing-manager", employer: "marketplaceph", title: "Marketing Manager", category: "sales_marketing", employment_type: "full_time", work_setup: "hybrid",
    summary: "Own the marketing plan that grows sellers, buyers and job seekers on MarketplacePH across the Philippines.",
    responsibilities: ["Set the quarterly marketing plan, budget and targets", "Lead content, social media, partnerships and community campaigns", "Work with FLAME PH chapters and partners on regional activities", "Measure results and report to management", "Hire, coach and manage the marketing team"],
    qualifications: ["Bachelor's degree in marketing, business or a related field, or equivalent experience", "At least 4 years in marketing, including 2 years managing people or campaigns", "Experience with digital marketing and analytics", "Strong communication in English and Filipino"],
  },
  {
    key: "mph-real-estate-salesperson", employer: "marketplaceph", title: "Real Estate Salesperson", category: "sales_marketing", employment_type: "contract", work_setup: "hybrid", vacancies: 5,
    realEstate: true,
    summary: "Help buyers and MSMEs find homes, lots and commercial spaces listed on MarketplacePH, under the supervision of a licensed real estate broker.",
    responsibilities: ["Respond to property inquiries and arrange site viewings", "Explain listing details, requirements and payment options accurately", "Coordinate with the supervising broker on offers and documents", "Keep client information confidential", "Follow the code of ethics for real estate service practitioners"],
    qualifications: ["PRC accreditation as a real estate salesperson under RA 9646, or willing to complete the required accreditation before handling clients", "Must work under the direct supervision of a PRC-licensed real estate broker", "Good communication and follow-up skills", "Has a smartphone and can travel for viewings"],
  },
  {
    key: "mph-real-estate-agent", employer: "marketplaceph", title: "Real Estate Agent (Accredited Salesperson)", category: "sales_marketing", employment_type: "contract", work_setup: "hybrid", vacancies: 5,
    realEstate: true,
    summary: "Represent property listings on MarketplacePH and guide clients from inquiry to closing, as an accredited salesperson working under a licensed broker.",
    responsibilities: ["Build and follow up a list of buyer and tenant leads", "Present properties honestly, with correct prices and documents", "Schedule viewings and prepare client requirements", "Work with the supervising broker on negotiations and closing", "Keep records of clients and transactions"],
    qualifications: ["Under RA 9646, anyone who sells or leases property for others must be a PRC-licensed broker or a PRC-accredited salesperson under a broker; this role requires that accreditation", "Experience in real estate or sales is an advantage", "Organized and honest with clients", "Can travel within the service area"],
  },
  {
    key: "mph-real-estate-broker", employer: "marketplaceph", title: "Real Estate Broker", category: "sales_marketing", employment_type: "contract", work_setup: "hybrid",
    realEstate: true,
    summary: "Lead real estate transactions for MarketplacePH listings and supervise accredited salespersons, as a PRC-licensed real estate broker.",
    responsibilities: ["Handle negotiations, offers and closing of property transactions", "Supervise and sign off on the work of accredited salespersons", "Check property documents and listing accuracy", "Make sure the team follows RA 9646 and the PRC code of ethics", "Coach salespersons and agents"],
    qualifications: ["Valid PRC Real Estate Broker license under RA 9646", "Updated continuing professional development (CPD) units", "Proof of professional indemnity or bond as required by PRC rules", "At least 2 years of brokerage experience is preferred"],
  },
  {
    key: "mph-real-estate-manager", employer: "marketplaceph", title: "Real Estate Manager (Sales Team)", category: "sales_marketing", employment_type: "full_time", work_setup: "hybrid",
    realEstate: true,
    summary: "Build and manage the MarketplacePH real estate team: listings quality, salesperson onboarding, targets and partner developers.",
    responsibilities: ["Recruit and onboard brokers and accredited salespersons", "Set sales targets and track pipeline and closings", "Keep listings accurate and complete", "Build relationships with developers, owners and MSME clients", "Make sure all transactions are handled by licensed or accredited practitioners as RA 9646 requires"],
    qualifications: ["PRC-licensed real estate broker (preferred), or a licensed real estate practitioner with team-lead experience", "At least 3 years in real estate sales or management", "Strong people management and reporting skills", "Knowledge of RA 9646 and PRC rules"],
  },
];

const bullets = (xs) => xs.map((x) => `• ${x}`).join("\n");

/** Full description text stored in job_posts.description (max 5000 chars). */
export function descriptionOf(job) {
  const parts = [];
  if (job.partner) parts.push(PARTNER_NOTICE);
  parts.push(job.summary);
  parts.push(`Key responsibilities:\n${bullets(job.responsibilities)}`);
  parts.push(
    `Location: ${PLACEHOLDER}: city/province${job.location ? ` for ${job.location}` : ""}]\n` +
      (job.partner
        ? `Earnings: ${PLACEHOLDER}: commission rate and how it is computed]`
        : `Pay range: ${PLACEHOLDER}: monthly pay range, then also enter it in the pay fields]`),
  );
  if (job.realEstate) parts.push(RA9646_NOTICE);
  parts.push(NO_FEE_NOTICE);
  return parts.join("\n\n");
}

export function qualificationsOf(job) {
  return bullets(job.qualifications);
}
