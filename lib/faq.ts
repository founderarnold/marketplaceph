/**
 * Help & FAQ content (English + Filipino). Answer lines: plain text, "- " for a bullet, and [label](/path) for a link
 * to a page on the site. Keep facts in sync with the features they describe.
 */
export type Bi = { en: string; fil: string };
export type FaqItem = { q: Bi; a: { en: string[]; fil: string[] } };
export type FaqSection = { id: string; title: Bi; items: FaqItem[] };

export const FAQ: FaqSection[] = [
  {
    id: "start",
    title: { en: "Getting started", fil: "Pagsisimula" },
    items: [
      {
        q: { en: "What is MarketplacePH?", fil: "Ano ang MarketplacePH?" },
        a: {
          en: [
            "MarketplacePH is a free online marketplace and job board for Philippine MSMEs. Sellers and service providers post what they offer, buyers find and message them directly, and employers and job seekers meet in the Jobs section.",
            "MarketplacePH only connects people. Payments, deliveries and work arrangements are agreed between the users themselves.",
          ],
          fil: [
            "Ang MarketplacePH ay libreng online marketplace at job board para sa mga MSME sa Pilipinas. Nagpo-post ang sellers at service providers ng kanilang alok, direktang nakikipag-usap ang buyers sa kanila, at nagkikita ang employers at naghahanap ng trabaho sa Jobs.",
            "Nagdudugtong lang ang MarketplacePH ng mga tao. Ang bayad, delivery at kasunduan sa trabaho ay pinag-uusapan ng mga user mismo.",
          ],
        },
      },
      {
        q: { en: "How much does it cost?", fil: "Magkano ang bayad?" },
        a: {
          en: [
            "Creating an account, posting items and services, posting jobs, applying for jobs and messaging are free.",
            "Optional FLAME plans unlock extra business tools such as costing, break-even, staff time records and a mini website. See [Plans](/business/plan).",
          ],
          fil: [
            "Libre ang paggawa ng account, pag-post ng item at serbisyo, pag-post ng trabaho, pag-apply at pag-message.",
            "May opsyonal na FLAME plans para sa dagdag na business tools gaya ng costing, break-even, staff time record at mini website. Tingnan ang [Plans](/business/plan).",
          ],
        },
      },
      {
        q: { en: "How do I create an account?", fil: "Paano gumawa ng account?" },
        a: {
          en: [
            "Tap Create account at the top of any page. Sign up with Google, your mobile number, or your email and a password (at least 8 characters with letters and numbers).",
            "Then add your name, and your social and contact links in [Account](/account) so others can see you're real.",
          ],
          fil: [
            "Pindutin ang Create account sa itaas ng kahit anong page. Mag-sign up gamit ang Google, mobile number, o email at password (hindi bababa sa 8 character na may letra at numero).",
            "Saka ilagay ang pangalan mo at ang social at contact links sa [Account](/account) para makita ng iba na totoo ka.",
          ],
        },
      },
    ],
  },
  {
    id: "buying",
    title: { en: "Buying: how a transaction works", fil: "Pagbili: paano ang transaksyon" },
    items: [
      {
        q: { en: "What are the steps when I order?", fil: "Ano ang mga hakbang kapag umorder ako?" },
        a: {
          en: [
            "- Add the item to your cart (check the minimum order) and tap Checkout. Enter where to deliver.",
            "- The seller reviews your request and sends the final price, including shipping. You'll see it in Messages and in [My orders](/orders).",
            "- Pay using the seller's listed payment option, then upload a screenshot of your payment with the reference number.",
            "- The seller confirms the payment was received, packs your order (with photos) and ships it.",
            "- When it arrives, tap \"I received it\". The transaction is complete, and you can leave a review.",
            "Every step appears in your chat with the seller, so you always know what's next.",
          ],
          fil: [
            "- Ilagay ang item sa cart (tingnan ang minimum order) at pindutin ang Checkout. Ilagay kung saan ide-deliver.",
            "- Susuriin ng seller ang request at ipapadala ang final na presyo, kasama ang shipping. Makikita mo ito sa Messages at sa [My orders](/orders).",
            "- Magbayad gamit ang payment option ng seller, saka i-upload ang screenshot ng bayad na may reference number.",
            "- Kukumpirmahin ng seller na natanggap ang bayad, ipa-pack ang order (may litrato) at ipapadala.",
            "- Pagdating, pindutin ang \"I received it\". Tapos na ang transaksyon at puwede ka nang mag-review.",
            "Lumalabas ang bawat hakbang sa chat ninyo ng seller, kaya alam mo palagi ang susunod.",
          ],
        },
      },
      {
        q: { en: "Can I just message the seller first?", fil: "Puwede bang mag-message muna sa seller?" },
        a: {
          en: [
            "Yes. Tap Message seller on any item or store to ask about stock, price, size or delivery. If you agree on a deal in the chat, the seller can record it there, and you confirm it once it's done, so it still counts as a completed transaction.",
            "You can also ask in the public Questions & comments area under each item. Keep phone numbers and payment details in private Messages.",
          ],
          fil: [
            "Oo. Pindutin ang Message seller sa anumang item o store para magtanong tungkol sa stock, presyo, laki o delivery. Kapag nagkasundo kayo sa chat, puwedeng i-record ito ng seller doon at kukumpirmahin mo kapag tapos na, kaya bilang pa rin itong natapos na transaksyon.",
            "Puwede ka ring magtanong sa pampublikong Questions & comments sa ilalim ng bawat item. Itago sa private Messages ang phone number at detalye ng bayad.",
          ],
        },
      },
      {
        q: { en: "What if something goes wrong with my order?", fil: "Paano kung may problema sa order ko?" },
        a: {
          en: [
            "Talk to the seller in Messages first. If you can't settle it, open a dispute from the order page and attach photos or proof; the MarketplacePH team will look at what both sides submitted.",
            "Keep all chats, payment screenshots and delivery photos. They are your proof.",
          ],
          fil: [
            "Kausapin muna ang seller sa Messages. Kung hindi maayos, mag-open ng dispute sa order page at maglakip ng litrato o patunay; titingnan ng MarketplacePH team ang isinumite ng dalawang panig.",
            "Itago ang lahat ng chat, screenshot ng bayad at litrato ng delivery. Ito ang patunay mo.",
          ],
        },
      },
      {
        q: { en: "How do reviews work?", fil: "Paano gumagana ang reviews?" },
        a: {
          en: [
            "Only people who completed a real deal can leave a 5-star review: buyers after an order, sellers about buyers, and employers and applicants after a hiring. That keeps reviews honest.",
          ],
          fil: [
            "Ang mga nakatapos lang ng totoong deal ang puwedeng mag-iwan ng 5-star review: buyers pagkatapos ng order, sellers tungkol sa buyers, at employers at applicants pagkatapos ng hiring. Kaya tapat ang reviews.",
          ],
        },
      },
    ],
  },
  {
    id: "looking",
    title: { en: "Buyers: finding the products and services you need", fil: "Buyers: paghahanap ng produkto at serbisyong kailangan" },
    items: [
      {
        q: { en: "How do I find sellers of what I'm looking for?", fil: "Paano makahanap ng seller ng hinahanap ko?" },
        a: {
          en: [
            "- Search from the top of any page, or browse [All categories](/categories).",
            "- Use Filters to narrow by location, price, seller type (manufacturer, distributor, retailer…), condition, verified sellers only, or ready stock.",
            "- For suppliers and services, open Find Suppliers or Find Services in the blue menu.",
            "- Tap Add Friend on stores you like. Their new items then show up in your [Updates](/updates).",
          ],
          fil: [
            "- Maghanap sa itaas ng kahit anong page, o tingnan ang [Lahat ng kategorya](/categories).",
            "- Gamitin ang Filters para piliin ang lokasyon, presyo, uri ng seller (manufacturer, distributor, retailer…), kondisyon, verified sellers lang, o ready stock.",
            "- Para sa suppliers at serbisyo, buksan ang Find Suppliers o Find Services sa asul na menu.",
            "- Pindutin ang Add Friend sa mga store na gusto mo. Lalabas ang bago nilang item sa iyong [Updates](/updates).",
          ],
        },
      },
      {
        q: { en: "Can I post what I want to buy?", fil: "Puwede ko bang i-post ang gusto kong bilhin?" },
        a: {
          en: [
            "Yes. Use the [Looking for](/looking-for) board: tap \"Post what you need\" and describe the product or service, quantity, budget, delivery location and the date you need it. It's free and stays open for 30 days.",
            "- Sellers send you offers with their price, how many they can supply and delivery time. Only you see the offers.",
            "- Compare them, check each seller (badges, completed sales, reviews, social links), then tap \"Accept & chat\" on the one you like. A chat with that seller opens so you can finish the deal.",
            "- When you're done, tap \"I found a seller\" or close the request.",
            "You can also post an update to your friends in [Updates](/updates), or ask in the Questions & comments area of similar items.",
          ],
          fil: [
            "Oo. Gamitin ang [Hinahanap](/looking-for) board: pindutin ang \"I-post ang kailangan mo\" at ilarawan ang produkto o serbisyo, dami, budget, lugar ng delivery at kailan mo kailangan. Libre ito at bukas sa loob ng 30 araw.",
            "- Magpapadala ang sellers ng alok na may presyo, kayang i-supply at oras ng delivery. Ikaw lang ang makakakita ng mga alok.",
            "- Ikumpara, i-check ang bawat seller (badges, natapos na benta, reviews, social links), saka pindutin ang \"Tanggapin at mag-chat\" sa napili mo. Magbubukas ang chat sa seller para matapos ang deal.",
            "- Kapag tapos na, pindutin ang \"May nakuha na akong seller\" o isara ang request.",
            "Puwede ka ring mag-post ng update sa mga kaibigan sa [Updates](/updates), o magtanong sa Questions & comments ng katulad na item.",
          ],
        },
      },
    ],
  },
  {
    id: "selling",
    title: { en: "Sellers and service providers: setting up and posting", fil: "Sellers at service providers: pag-setup at pag-post" },
    items: [
      {
        q: { en: "How do I create my store profile?", fil: "Paano gumawa ng store profile?" },
        a: {
          en: [
            "- Tap Post for FREE. The first time, you'll set up your store: name, seller type (manufacturer, distributor, retailer, service provider…) and location.",
            "- Then open [Edit store profile](/my/store): add a square logo, a short \"about\" (what you sell, since when, where you deliver), your contact number, and your Facebook page or website.",
            "- In [Account](/account), add your social and contact links (WhatsApp, Viber, Instagram…).",
            "- Set your payment and delivery options in [Shipping & payment settings](/my/shipping).",
            "- Follow the \"Get your store ready\" checklist on your [Seller dashboard](/business).",
          ],
          fil: [
            "- Pindutin ang Post for FREE. Sa unang beses, ise-set up mo ang store: pangalan, uri ng seller (manufacturer, distributor, retailer, service provider…) at lokasyon.",
            "- Saka buksan ang [Edit store profile](/my/store): maglagay ng kuwadradong logo, maikling paglalarawan (ano ang binebenta, mula kailan, saan nagdedeliver), contact number, at Facebook page o website.",
            "- Sa [Account](/account), idagdag ang social at contact links (WhatsApp, Viber, Instagram…).",
            "- I-set ang paraan ng bayad at delivery sa [Shipping & payment settings](/my/shipping).",
            "- Sundin ang checklist na \"Ihanda ang iyong store\" sa [Seller dashboard](/business).",
          ],
        },
      },
      {
        q: { en: "How do I post a product properly?", fil: "Paano mag-post nang maayos ng produkto?" },
        a: {
          en: [
            "- Photos: use your own, clear, well-lit photos (up to 8). The first one is the cover. Don't use other sellers' photos.",
            "- Title: what it is, size or variant, and brand, e.g. \"Dried Mango 100g Pack (Cebu), wholesale\".",
            "- Category and condition: pick the closest category, and say if it's brand new, pre-owned, refurbished or surplus.",
            "- Price: a fixed price or a price range builds more trust than \"message for price\". Set the unit (pc, pack, kg) and the minimum order.",
            "- Wholesale: add lower prices for bigger quantities.",
            "- Stock: keep the stock status and quantity up to date so buyers don't order what you don't have.",
            "- Description: materials, sizes, shelf life, what's included, delivery areas and lead time.",
            "Edit anytime from [My store](/my/listings).",
          ],
          fil: [
            "- Litrato: gumamit ng sariling malinaw at maliwanag na litrato (hanggang 8). Ang una ang cover. Huwag gamitin ang litrato ng ibang seller.",
            "- Pamagat: kung ano ito, laki o variant, at brand, hal. \"Dried Mango 100g Pack (Cebu), wholesale\".",
            "- Kategorya at kondisyon: piliin ang pinakamalapit na kategorya, at sabihin kung brand new, pre-owned, refurbished o surplus.",
            "- Presyo: mas pinagkakatiwalaan ang fixed na presyo o price range kaysa \"message for price\". I-set ang unit (pc, pack, kg) at minimum order.",
            "- Wholesale: maglagay ng mas mababang presyo para sa mas maraming order.",
            "- Stock: panatilihing tama ang stock status at dami para hindi umorder ang buyer ng wala ka.",
            "- Paglalarawan: materyales, sukat, shelf life, kasama sa package, lugar ng delivery at gaano katagal.",
            "Puwedeng i-edit anumang oras sa [Aking store](/my/listings).",
          ],
        },
      },
      {
        q: { en: "How do I post a service for hire?", fil: "Paano mag-post ng serbisyo?" },
        a: {
          en: [
            "Post it like a product but choose Service. Show photos of past work, name the service and area clearly (e.g. \"Aircon cleaning, Quezon City\"), state your rate or price range and unit (per hour, per job, per sqm), and describe what's included, how long it takes and your schedule.",
            "Licenses and permits (e.g. for electrical, plumbing or construction work) build trust: mention them and request the right badge.",
          ],
          fil: [
            "I-post ito tulad ng produkto pero piliin ang Service. Magpakita ng litrato ng nagawang trabaho, sabihin nang malinaw ang serbisyo at lugar (hal. \"Aircon cleaning, Quezon City\"), ilagay ang singil o price range at unit (kada oras, kada trabaho, kada sqm), at ilarawan ang kasama, gaano katagal at iskedyul mo.",
            "Nakakadagdag-tiwala ang lisensya at permit (hal. sa electrical, plumbing o construction): banggitin ito at mag-request ng tamang badge.",
          ],
        },
      },
      {
        q: { en: "How do I find buyers who need what I sell?", fil: "Paano makahanap ng buyers na kailangan ang binebenta ko?" },
        a: {
          en: [
            "Open the [Looking for](/looking-for) board and tap \"For my store\" to see buyer requests in the categories you sell. Send an offer with your price per unit, the quantity you can supply, delivery time and a short message, and link one of your listings if it fits.",
            "Only the buyer sees your offer. If they accept, a chat opens so you can agree on the details and process the order. Answer fast and be clear: buyers usually choose the first good, complete offer.",
          ],
          fil: [
            "Buksan ang [Hinahanap](/looking-for) board at pindutin ang \"Para sa store ko\" para makita ang request ng buyers sa mga kategoryang binebenta mo. Magpadala ng alok na may presyo kada unit, dami na kaya mong i-supply, oras ng delivery at maikling mensahe, at i-link ang listing mo kung tugma.",
            "Ang buyer lang ang makakakita ng alok mo. Kapag tinanggap, magbubukas ang chat para pag-usapan ang detalye at iproseso ang order. Sumagot nang mabilis at malinaw: kadalasang pinipili ng buyer ang unang maayos at kumpletong alok.",
          ],
        },
      },
      {
        q: { en: "How do I handle orders and payments?", fil: "Paano asikasuhin ang orders at bayad?" },
        a: {
          en: [
            "When a buyer checks out, you get a message and a notification. Open the order, confirm the items and send your final price with shipping. When the buyer uploads a payment screenshot, check that the money actually arrived in your GCash, Maya or bank account before tapping Confirm payment. Then pack with photos, ship, and mark it delivered.",
            "Never confirm a payment based only on a screenshot. Screenshots can be edited.",
          ],
          fil: [
            "Kapag nag-checkout ang buyer, may message at notification ka. Buksan ang order, kumpirmahin ang items at ipadala ang final na presyo kasama ang shipping. Kapag nag-upload ng screenshot ng bayad ang buyer, tingnan muna kung talagang pumasok ang pera sa GCash, Maya o bank account mo bago pindutin ang Confirm payment. Saka i-pack nang may litrato, ipadala, at markahang delivered.",
            "Huwag kumpirmahin ang bayad batay lang sa screenshot. Puwedeng i-edit ang screenshot.",
          ],
        },
      },
      {
        q: { en: "How do I get verified?", fil: "Paano magpa-verify?" },
        a: {
          en: [
            "Sellers: use [Get verified](/sell/verify) to submit your ID or business documents for the Verified seller badge.",
            "Everyone: request the Verified buyer, Good applicant, Credible employer or Verified years in business badge in [Badges](/account/badges). The MarketplacePH team (admin, founder or webmaster) reviews each request.",
          ],
          fil: [
            "Sellers: gamitin ang [Magpa-verify](/sell/verify) para magsumite ng ID o dokumento ng negosyo para sa Verified seller badge.",
            "Lahat: mag-request ng Verified buyer, Good applicant, Credible employer o Verified years in business badge sa [Badges](/account/badges). Susuriin ng MarketplacePH team (admin, founder o webmaster) ang bawat request.",
          ],
        },
      },
    ],
  },
  {
    id: "applicants",
    title: { en: "Job seekers: applying and getting hired", fil: "Naghahanap ng trabaho: pag-apply at pagka-hire" },
    items: [
      {
        q: { en: "How do I make a good job profile and resume?", fil: "Paano gumawa ng magandang job profile at resume?" },
        a: {
          en: [
            "- Open [My job profile](/jobs/profile). Use your real full name and a clear, recent 2x2 photo.",
            "- Headline: the job you want and your strongest skill, e.g. \"Cashier, 3 years in grocery, fast and accurate\".",
            "- Work history: company, position, dates and what you did. Short, true and specific.",
            "- Skills, education and the kinds of work you want (full time, part time, remote).",
            "- Upload your resume and clearances (NBI, police, barangay) so employers can review them when you apply.",
            "- Add your social links (e.g. LinkedIn) in [Account](/account).",
          ],
          fil: [
            "- Buksan ang [My job profile](/jobs/profile). Gamitin ang totoong buong pangalan at malinaw at bagong 2x2 na litrato.",
            "- Headline: ang trabahong gusto mo at pinakamagaling mong skill, hal. \"Cashier, 3 taon sa grocery, mabilis at maingat\".",
            "- Work history: kumpanya, posisyon, petsa at ginawa mo. Maikli, totoo at tiyak.",
            "- Skills, edukasyon at uri ng trabahong gusto (full time, part time, remote).",
            "- I-upload ang resume at clearances (NBI, police, barangay) para masuri ng employer kapag nag-apply ka.",
            "- Idagdag ang social links (hal. LinkedIn) sa [Account](/account).",
          ],
        },
      },
      {
        q: { en: "How do I apply and follow up?", fil: "Paano mag-apply at mag-follow up?" },
        a: {
          en: [
            "Open a job in [Jobs](/jobs) and tap Apply. Choose which documents to share and add a short note on why you fit. Your documents are shown only to that employer.",
            "Updates (shortlisted, interview, hired) come to your job messages. Reply quickly and politely. When you're hired and have started, tap \"Confirm I was hired\" in [My applications](/jobs/applications); it then counts as a completed job for you and the employer.",
          ],
          fil: [
            "Buksan ang trabaho sa [Jobs](/jobs) at pindutin ang Apply. Piliin ang dokumentong ibabahagi at magdagdag ng maikling note kung bakit ka bagay. Sa employer na iyon lang makikita ang dokumento mo.",
            "Darating sa job messages ang updates (shortlisted, interview, hired). Sumagot nang mabilis at magalang. Kapag na-hire at nakapagsimula ka na, pindutin ang \"Kumpirmahin na na-hire ako\" sa [My applications](/jobs/applications); bibilangin ito bilang natapos na trabaho para sa iyo at sa employer.",
          ],
        },
      },
    ],
  },
  {
    id: "employers",
    title: { en: "Employers: posting jobs that attract good staff", fil: "Employers: pag-post ng trabahong makakaakit ng mahusay na staff" },
    items: [
      {
        q: { en: "How do I post a good job?", fil: "Paano mag-post ng magandang job post?" },
        a: {
          en: [
            "- Use a clear job title (\"Delivery Rider\", not \"Hiring!!!\").",
            "- State the pay or salary range, schedule, location or remote setup, and the number of openings. Posts with clear pay get more serious applicants.",
            "- List the actual tasks and requirements, and only the documents you really need.",
            "- Recruitment agencies must enter their license number.",
            "Post at [Post a job](/jobs/post); it's free.",
          ],
          fil: [
            "- Gumamit ng malinaw na posisyon (\"Delivery Rider\", hindi \"Hiring!!!\").",
            "- Ilagay ang sahod o salary range, iskedyul, lokasyon o remote setup, at ilan ang bakante. Mas seryosong aplikante ang dumarating kapag malinaw ang sahod.",
            "- Ilista ang totoong gawain at requirements, at ang dokumentong talagang kailangan lang.",
            "- Kailangang ilagay ng recruitment agency ang license number nila.",
            "Mag-post sa [Post a job](/jobs/post); libre ito.",
          ],
        },
      },
      {
        q: { en: "How do I build a trusted company profile?", fil: "Paano bumuo ng mapagkakatiwalaang company profile?" },
        a: {
          en: [
            "Use your registered business name on every job post. Add your company Facebook page, website and contact numbers in [Account](/account), and request the Credible employer badge in [Badges](/account/badges) with your DTI/SEC registration or business permit. If you also sell, a complete store profile helps too.",
            "Answer questions in each job's Questions & comments area, update applicants on their status, and leave honest reviews after hiring. Your hires and ratings show on your profile.",
          ],
          fil: [
            "Gamitin ang rehistradong pangalan ng negosyo sa bawat job post. Idagdag ang Facebook page, website at contact number ng kumpanya sa [Account](/account), at mag-request ng Credible employer badge sa [Badges](/account/badges) gamit ang DTI/SEC registration o business permit. Kung nagbebenta ka rin, makakatulong ang kumpletong store profile.",
            "Sagutin ang tanong sa Questions & comments ng bawat trabaho, i-update ang aplikante sa status nila, at mag-iwan ng tapat na review pagkatapos mag-hire. Makikita sa profile mo ang mga na-hire at ratings.",
          ],
        },
      },
    ],
  },
  {
    id: "legit",
    title: { en: "Checking if someone is legit", fil: "Pag-check kung lehitimo ang isang tao" },
    items: [
      {
        q: { en: "How do I check a seller before paying?", fil: "Paano i-check ang seller bago magbayad?" },
        a: {
          en: [
            "- Look for the Verified seller badge, \"Verified years in business\", and the seller type.",
            "- Check their successful transactions (sold), ratings and reviews from real buyers, and their number of friends.",
            "- Open their social links (Facebook page, website) and see if they look active and consistent.",
            "- Search their name, number or GCash name in [Check muna bago bayad](/check).",
            "- For businesses, you can check DTI business names at bnrs.dti.gov.ph, and for food, drugs and cosmetics, the FDA product list at verification.fda.gov.ph.",
            "- Make sure the GCash, Maya or bank account name matches the seller or store.",
          ],
          fil: [
            "- Hanapin ang Verified seller badge, \"Verified years in business\", at uri ng seller.",
            "- Tingnan ang successful transactions (nabenta), ratings at reviews mula sa totoong buyers, at ilan ang kaibigan nila.",
            "- Buksan ang social links nila (Facebook page, website) at tingnan kung aktibo at tugma.",
            "- Hanapin ang pangalan, numero o GCash name nila sa [Check muna bago bayad](/check).",
            "- Para sa negosyo, puwedeng i-check ang DTI business name sa bnrs.dti.gov.ph, at para sa pagkain, gamot at kosmetiko, ang FDA list sa verification.fda.gov.ph.",
            "- Siguraduhing tugma sa seller o store ang pangalan ng GCash, Maya o bank account.",
          ],
        },
      },
      {
        q: { en: "How can sellers check buyers?", fil: "Paano i-check ng seller ang buyer?" },
        a: {
          en: [
            "Open the buyer's page from your chat: see their completed purchases, cancellations, reviews from other sellers, Verified buyer badge and social links. For big or custom orders, ask for a down payment and agree on everything in Messages.",
          ],
          fil: [
            "Buksan ang buyer page mula sa chat: tingnan ang natapos nilang pagbili, mga kinansela, review mula sa ibang sellers, Verified buyer badge at social links. Sa malaki o custom na order, humingi ng down payment at pag-usapan ang lahat sa Messages.",
          ],
        },
      },
      {
        q: { en: "How do applicants check employers, and employers check applicants?", fil: "Paano i-check ng applicant ang employer, at ng employer ang applicant?" },
        a: {
          en: [
            "Applicants: look for the Credible employer badge, reviews from past hires, completed hires, company links and a real office or business address. For agencies, verify the license: DOLE for local jobs and the Department of Migrant Workers (DMW) at dmw.gov.ph for overseas jobs.",
            "Employers: look at the Good applicant badge, reviews from past employers, clearances and references, and verify documents during the interview.",
          ],
          fil: [
            "Applicants: hanapin ang Credible employer badge, review mula sa dating na-hire, natapos na hiring, company links at totoong opisina o address ng negosyo. Para sa agency, i-verify ang lisensya: DOLE para sa lokal na trabaho at Department of Migrant Workers (DMW) sa dmw.gov.ph para sa abroad.",
            "Employers: tingnan ang Good applicant badge, review mula sa dating employer, clearances at references, at i-verify ang dokumento sa interview.",
          ],
        },
      },
    ],
  },
  {
    id: "scams",
    title: { en: "Avoiding scams and illegal recruiters", fil: "Pag-iwas sa scam at illegal recruiters" },
    items: [
      {
        q: { en: "What are common warning signs of a scam?", fil: "Ano ang karaniwang palatandaan ng scam?" },
        a: {
          en: [
            "- The price is far below everyone else's, or the seller pressures you to pay right now.",
            "- They want to move to another app quickly, or ask you to pay a different name or account.",
            "- They ask for your password, OTP or PIN. MarketplacePH, GCash and banks never ask for these.",
            "- They send links to \"claim\" money, a prize or a refund.",
            "- Payment screenshots that don't match your actual balance. Always check your app, not the screenshot.",
            "- New accounts with no transactions, no reviews and no real social links, selling expensive items.",
          ],
          fil: [
            "- Sobrang baba ng presyo kumpara sa iba, o minamadali kang magbayad agad.",
            "- Gusto agad lumipat sa ibang app, o pinapabayad ka sa ibang pangalan o account.",
            "- Hinihingi ang password, OTP o PIN mo. Hindi ito kailanman hinihingi ng MarketplacePH, GCash o bangko.",
            "- Nagpapadala ng link para \"i-claim\" ang pera, premyo o refund.",
            "- Screenshot ng bayad na hindi tugma sa totoong balance mo. Laging tingnan ang app mo, hindi ang screenshot.",
            "- Bagong account na walang transaksyon, review at totoong social links, pero nagbebenta ng mamahalin.",
          ],
        },
      },
      {
        q: { en: "How do I avoid illegal recruiters?", fil: "Paano iwasan ang illegal recruiters?" },
        a: {
          en: [
            "- For local jobs, licensed agencies may not charge you a placement fee. Be careful with anyone who asks for money to \"reserve\" a job.",
            "- Don't pay for training, medical exams, uniforms or processing before you have a real job offer, unless the employer is verified and it's in your written contract.",
            "- Overseas jobs must go through a DMW-licensed agency. Check the agency and job order at dmw.gov.ph.",
            "- Be careful with jobs that pay far too much for little work, interviews only by chat, or requests to bring your passport or IDs to an unknown place.",
            "- Never send money to a personal account for a job.",
          ],
          fil: [
            "- Sa lokal na trabaho, hindi puwedeng maningil ng placement fee ang lisensyadong agency. Mag-ingat sa sinumang humihingi ng pera para \"i-reserve\" ang trabaho.",
            "- Huwag magbayad para sa training, medical, uniform o processing bago ka magkaroon ng totoong job offer, maliban kung verified ang employer at nakasulat ito sa kontrata.",
            "- Ang trabaho sa abroad ay dapat dumaan sa DMW-licensed agency. I-check ang agency at job order sa dmw.gov.ph.",
            "- Mag-ingat sa trabahong sobrang laki ng sahod para sa kaunting gawain, interview na chat lang, o pinapadala ang passport o ID sa hindi kilalang lugar.",
            "- Huwag magpadala ng pera sa personal na account para sa trabaho.",
          ],
        },
      },
      {
        q: { en: "Where do I report a scam?", fil: "Saan ire-report ang scam?" },
        a: {
          en: [
            "- On MarketplacePH: tap Report on the item, store or job, or open a dispute on the order. Our team reviews every report and can restrict accounts.",
            "- Cybercrime: call the Cybercrime Investigation and Coordinating Center (CICC) hotline 1326, or report to the PNP Anti-Cybercrime Group or NBI Cybercrime Division.",
            "- Consumer complaints: DTI hotline 1-384.",
            "- Illegal recruitment: DOLE for local jobs, DMW for overseas jobs.",
            "Keep screenshots of chats, profiles and payments. They help the authorities.",
          ],
          fil: [
            "- Sa MarketplacePH: pindutin ang Report sa item, store o trabaho, o mag-open ng dispute sa order. Sinusuri ng team ang bawat report at puwedeng i-restrict ang account.",
            "- Cybercrime: tumawag sa Cybercrime Investigation and Coordinating Center (CICC) hotline 1326, o mag-report sa PNP Anti-Cybercrime Group o NBI Cybercrime Division.",
            "- Reklamo ng consumer: DTI hotline 1-384.",
            "- Illegal recruitment: DOLE para sa lokal na trabaho, DMW para sa abroad.",
            "Itago ang screenshot ng chat, profile at bayad. Makakatulong ito sa awtoridad.",
          ],
        },
      },
    ],
  },
];

export const FAQ_DISCLAIMER: Bi = {
  en: "MarketplacePH is a platform that matches buyers with sellers and job seekers with employers. It is not a party to any sale, service, payment, delivery or employment agreement between users, does not hold users' money, and does not guarantee any user, item, service or job. MarketplacePH is not liable in any form for any loss, damage, untoward incident, malicious engagement or unlawful transaction arising between users. Always use proper discretion and due diligence: check the other party, keep records, and report suspicious activity.",
  fil: "Ang MarketplacePH ay plataporma na nagdudugtong sa buyers at sellers, at sa naghahanap ng trabaho at employers. Hindi ito bahagi ng anumang bentahan, serbisyo, bayad, delivery o kasunduan sa trabaho sa pagitan ng mga user, hindi nito hinahawakan ang pera ng mga user, at hindi nito ginagarantiya ang sinumang user, item, serbisyo o trabaho. Walang pananagutan ang MarketplacePH sa anumang anyo para sa anumang pagkalugi, pinsala, hindi magandang pangyayari, mapanlinlang na pakikipag-ugnayan o ilegal na transaksyon sa pagitan ng mga user. Laging gumamit ng maingat na pagpapasya at due diligence: suriin ang kausap, itago ang mga record, at i-report ang kahina-hinalang gawain.",
};
