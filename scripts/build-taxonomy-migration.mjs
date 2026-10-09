/**
 * Source of truth for the Buy/Sell category tree. Run `node scripts/build-taxonomy-migration.mjs` to (re)generate
 * supabase/migrations/20261015000001_category_taxonomy.sql. Already-applied migrations must not be edited:
 * to change the tree later, copy the generator's output into a NEW migration instead.
 *
 * 30 major categories in homepage order, each in one discovery tab (products / suppliers / services / negosyo).
 * Sub-category names are English only (Filipino shoppers use these English trade terms); major categories are bilingual.
 * "Pre-owned / surplus" is a listing CONDITION filter, not a category.
 * The Groceries sub-categories are a proposal (the brief left them open).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const T = (s) => s.split(" • ").map((x) => x.trim()).filter(Boolean);

const MAJORS = [
  ["food-beverages", "Food & Beverages", "Pagkain at Inumin", "utensils", "products",
    "Ready-to-Eat Food • Filipino Food • Rice Meals • Snacks & Merienda • Baked Goods & Pastries • Bread • Cakes & Desserts • Pizza & Pasta • Frozen Food • Processed Food • Canned & Bottled Food • Meat & Poultry • Seafood • Fruits & Vegetables • Rice & Grains • Noodles & Pasta • Condiments & Sauces • Spices & Seasonings • Cooking Oil • Dairy & Cheese • Coffee • Tea • Milk & Chocolate Drinks • Juices • Soft Drinks • Bottled Water • Healthy/Organic Food • Regional Delicacies • Food Gift Sets • Party Trays • Food Ingredients • Baking Ingredients • Restaurant Ingredients • Wholesale Food Supplies"],
  ["fashion-apparel", "Fashion & Apparel", "Damit at Fashion", "shirt", "products",
    "Women's Clothing • Men's Clothing • Kids' Clothing • Baby Clothing • Shirts • Polo Shirts • Blouses • Dresses • Pants • Jeans • Shorts • Jackets • Hoodies • Activewear • Uniforms • Corporate Uniforms • School Uniforms • Workwear • Sleepwear • Underwear • Swimwear • Plus Size • Maternity Wear • Filipiniana • Barong • Indigenous/Local Fashion • Customized Apparel • Ready-to-Wear • Textile & Fabrics"],
  ["beauty-wellness", "Beauty, Personal Care & Wellness", "Kagandahan, Personal Care at Wellness", "heart-pulse", "products",
    "Skincare • Makeup • Hair Care • Bath & Body • Personal Hygiene • Oral Care • Fragrances & Perfumes • Men's Grooming • Women's Care • Nail Care • Beauty Tools • Salon Supplies • Spa Supplies • Massage Products • Wellness Products • Vitamins & Supplements • Medical Supplies • Mobility & Home-Care Supplies"],
  ["mobile-gadgets", "Mobile Phones, Gadgets & Accessories", "Cellphone, Gadgets at Accessories", "smartphone", "products",
    "Smartphones • Feature Phones • Tablets • Smartwatches • Wearables • Earphones • Headphones • Bluetooth Speakers • Power Banks • Chargers • Cables • Phone Cases • Screen Protectors • Mobile Accessories • Smart Home Devices • GPS Devices • Two-Way Radios • Electronic Accessories • Refurbished Gadgets • Pre-Owned Gadgets"],
  ["computers-it-office", "Computers, IT & Office Technology", "Computer, IT at Office Technology", "laptop", "products",
    "Laptops • Desktop Computers • Mini PCs • Monitors • Computer Components • Graphics Cards • Storage • RAM • Motherboards • Keyboards • Mouse • Webcams • Printers • Scanners • POS Hardware • Barcode Scanners • Receipt Printers • Networking Equipment • Routers • CCTV • Security Systems • Servers • UPS • Computer Accessories • Software • Business Software"],
  ["appliances-electronics", "Appliances, Electronics & Smart Home", "Appliances, Elektroniks at Smart Home", "tv", "products",
    "TVs • Refrigerators • Air Conditioners • Washing Machines • Electric Fans • Kitchen Appliances • Rice Cookers • Air Fryers • Ovens • Microwave Ovens • Blenders • Coffee Machines • Water Dispensers • Vacuum Cleaners • Irons • Personal Care Appliances • Home Audio • Smart Home Devices • Solar Equipment • Generators • Batteries • Energy-Saving Appliances • Appliance Parts"],
  ["home-furniture-living", "Home, Furniture & Living", "Gamit sa Bahay, Furniture at Living", "sofa", "products",
    "Furniture • Bedroom • Living Room • Dining Room • Office Furniture • Mattresses • Bedding • Curtains • Rugs • Home Décor • Kitchen & Dining • Cookware • Tableware • Storage & Organization • Bathroom • Laundry • Cleaning Supplies • Lighting • Outdoor Furniture • Garden • Home Improvement • Home Security"],
  ["shoes-bags-accessories", "Shoes, Bags & Fashion Accessories", "Sapatos, Bag at Fashion Accessories", "footprints", "products",
    "Women's Shoes • Men's Shoes • Kids' Shoes • Sneakers • Sandals • Slippers • Formal Shoes • Work Shoes • Sports Shoes • Handbags • Backpacks • Travel Bags • Wallets • Belts • Watches • Jewelry • Fashion Jewelry • Sunglasses • Eyewear • Caps & Hats • Scarves • Hair Accessories • Fashion Accessories • Handmade Accessories"],
  ["babies-kids-maternity", "Babies, Kids & Maternity", "Sanggol, Bata at Maternity", "baby", "products",
    "Diapers • Baby Food • Formula • Feeding • Bottles • Baby Clothing • Baby Shoes • Baby Care • Strollers • Car Seats • Cribs • Nursery • Baby Furniture • Maternity Products • Breastfeeding Supplies • Educational Toys • Baby Toys • Kids' Toys • Kids' Furniture • School Essentials"],
  ["groceries", "Groceries", "Groceries", "shopping-basket", "products",
    "Pantry Staples • Canned Goods • Instant Noodles • Cooking Essentials • Breakfast & Spreads • Snacks • Beverages • Dairy & Eggs • Frozen Goods • Fresh Produce • Meat & Seafood • Household Essentials • Laundry & Cleaning • Paper Goods • Personal Care Basics • Baby & Pet Essentials"],
  ["automotive-moto-ev", "Automotive, Motorcycle & EV", "Sasakyan, Motor at EV", "car", "products",
    "Cars • Motorcycles • E-Bikes • E-Scooters • Electric Vehicles • Auto Parts • Motorcycle Parts • Tires • Wheels/Rims • Batteries • Oils & Lubricants • Car Accessories • Motorcycle Accessories • Helmets • Riding Gear • Car Electronics • Dashcams • GPS • Car Care • Tools • Replacement Parts • EV Chargers • EV Accessories • Commercial Vehicles • Used Vehicles"],
  ["sports-fitness-outdoor", "Sports, Fitness & Outdoor", "Sports, Fitness at Outdoor", "dumbbell", "products",
    "Basketball • Volleyball • Badminton • Running • Cycling • Swimming • Boxing • Martial Arts • Gym Equipment • Fitness Equipment • Yoga • Sportswear • Sports Shoes • Camping • Hiking • Fishing • Outdoor Recreation • Water Sports • Team Sports • Sports Accessories • Trophies & Medals"],
  ["pets-animal-supplies", "Pets & Animal Supplies", "Alagang Hayop at Gamit sa Hayop", "paw-print", "products",
    "Dog Food • Cat Food • Pet Treats • Pet Vitamins • Pet Healthcare • Pet Grooming • Collars & Leashes • Pet Clothing • Cages • Beds • Aquarium Supplies • Fish Supplies • Bird Supplies • Small Animal Supplies • Pet Cleaning • Pet Accessories • Livestock/Poultry Supplies"],
  ["toys-hobbies-collectibles", "Toys, Games, Hobbies & Collectibles", "Laruan, Games, Hobby at Collectibles", "puzzle", "products",
    "Toys • Educational Toys • Dolls • Action Figures • RC Toys • Board Games • Card Games • Puzzles • Collectibles • Model Kits • Trading Cards • Arts & Crafts • Sewing • Knitting • DIY Kits • Musical Instruments • Photography • Hobby Equipment • Memorabilia"],
  ["gaming-digital", "Gaming, Entertainment & Digital Products", "Gaming, Entertainment at Digital Products", "gamepad-2", "products",
    "Gaming Consoles • Gaming PCs • Gaming Accessories • Controllers • Gaming Chairs • Video Games • Computer Games • Mobile Gaming Accessories • Streaming Equipment • Microphones • Cameras • Content Creator Equipment • Digital Products • E-books • Templates • Licensed Software • Online Courses"],
  ["school-office-educational", "School, Office & Educational Supplies", "Gamit sa Eskwela, Opisina at Edukasyon", "graduation-cap", "products",
    "School Supplies • Stationery • Pens • Paper • Notebooks • Art Supplies • Office Supplies • Filing & Organization • Calculators • Whiteboards • School Bags • Educational Materials • Books • Textbooks • Review Materials • Teaching Supplies • Laboratory Supplies • Office Furniture • Corporate Supplies"],
  ["gifts-crafts-personalized", "Gifts, Crafts & Personalized Products", "Regalo, Crafts at Personalized na Produkto", "gift", "products",
    "Corporate Giveaways • Personalized Gifts • Mugs • Tumblers • Shirts • Keychains • Plaques • Awards • Souvenirs • Wedding Giveaways • Birthday Giveaways • Event Giveaways • Handmade Crafts • Local Crafts • Native Products • Gift Boxes • Gift Baskets • Flowers • Party Supplies • Seasonal Gifts • Christmas Items"],

  ["agriculture-farm-fisheries", "Agriculture, Farm & Fisheries", "Agrikultura, Sakahan at Pangisdaan", "sprout", "suppliers",
    "Rice & Grains • Seeds & Seedlings • Fertilizers • Soil & Growing Media • Pesticides & Crop Protection • Farm Tools • Agricultural Machinery • Irrigation Equipment • Greenhouse Supplies • Hydroponics • Livestock • Poultry • Feeds • Veterinary/Farm Supplies • Aquaculture • Fishing Equipment • Fishery Supplies • Fresh Produce • Coconut Products • Coffee & Cacao • Farm Inputs • Organic Farming • Urban Farming • Agricultural Packaging • Post-Harvest Equipment • Farm-to-Market Products"],
  ["construction-hardware-industrial", "Construction, Hardware & Industrial Supplies", "Konstruksyon, Hardware at Industrial", "hammer", "suppliers",
    "Cement & Concrete • Lumber • Steel • Roofing • Tiles • Paint • Plumbing • Electrical Supplies • Lighting • Hand Tools • Power Tools • Welding Equipment • Fasteners • Adhesives • Construction Chemicals • Doors & Windows • Glass • Sanitary Ware • PPE • Safety Equipment • Industrial Equipment • Machinery • Generators • Pumps • Compressors • Industrial Parts • Construction Materials"],
  ["packaging-printing-signage", "Packaging, Printing & Signage", "Packaging, Pag-print at Signage", "package", "suppliers",
    "Food Packaging • Boxes • Corrugated Boxes • Plastic Packaging • Paper Packaging • Eco-Friendly Packaging • Bottles • Jars • Pouches • Sachets • Labels • Stickers • Tape • Bubble Wrap • Courier Packaging • Customized Packaging • Tarpaulin Printing • Signage • Business Cards • Flyers • Brochures • Menus • Invitations • T-Shirt Printing • Sublimation • Large-Format Printing • Product Labels"],
  ["restaurant-food-business-supplies", "Restaurant, Catering & Food Business Supplies", "Gamit sa Restaurant, Catering at Food Business", "chef-hat", "suppliers",
    "Restaurant Equipment • Commercial Ovens • Refrigeration • Freezers • Food Warmers • Cooking Equipment • Stainless Equipment • Kitchen Tools • Food Carts • Food Kiosks • Tables & Chairs • Dinnerware • Takeout Packaging • Ingredients • Beverage Equipment • Coffee Equipment • Baking Equipment • Pizza Equipment • Catering Equipment • Uniforms • Cleaning/Sanitation Supplies"],
  ["wholesale-manufacturing", "Wholesale, Manufacturing & Raw Materials", "Wholesale, Manufacturing at Raw Materials", "factory", "suppliers",
    "Manufacturers • Direct Suppliers • Wholesalers • Distributors • Importers • Exporters • Food Raw Materials • Packaging Raw Materials • Textile & Fabric • Plastics • Chemicals • Metals • Wood • Paper • Leather • Rubber • Agricultural Raw Materials • Ingredients • Industrial Components • OEM Manufacturing • ODM Manufacturing • Contract Manufacturing • Toll Manufacturing • Bulk Orders • Factory Direct • Made-to-Order Manufacturing"],
  ["rebranding-oem-private-label", "Rebranding, OEM & Private Label", "Rebranding, OEM at Private Label", "tags", "suppliers",
    "Private Label Food • Coffee • Beverages • Cosmetics • Skincare • Soap • Shampoo • Perfume • Supplements • Clothing • Bags • Shoes • Corporate Merchandise • Electronics • Household Products • Cleaning Products • Packaging • Bottling • Repacking • Product Formulation • White Label Products • OEM Products • Custom Manufacturing"],

  ["logistics-courier-pasabuy", "Logistics, Trucking, Courier & Pasabuy", "Logistics, Trucking, Courier at Pasabuy", "truck", "services",
    "Motorcycle Delivery • Same-Day Delivery • Provincial Delivery • Trucking • L300/Van Delivery • Closed Van • 4-Wheel/6-Wheel Trucks • Heavy Hauling • Moving Services • Lipat Bahay • Warehousing • Cold Storage • Cold Chain • Freight Forwarding • Sea Freight • Air Freight • Import Logistics • Export Logistics • Customs Brokerage • Fulfillment • Last-Mile Delivery • Pasabuy • International Shipping"],
  ["real-estate-commercial", "Real Estate & Commercial Spaces", "Real Estate at Commercial Spaces", "building-2", "services",
    "House & Lot • Condominiums • Residential Lots • Commercial Lots • Agricultural Land • Warehouses • Factories • Offices • Retail Spaces • Food Stall Spaces • Kiosks • Co-Working Spaces • Commercial Leasing • Residential Rentals • Bedspace/Dormitory • Vacation Properties • Memorial Lots"],
  ["professional-business-services", "Professional & Business Services", "Propesyonal at Business Services", "briefcase", "services",
    "Accounting • Bookkeeping • Tax Compliance • BIR Registration • Business Registration • SEC Services • DTI Registration Assistance • Legal Services • Intellectual Property/Trademark • HR Services • Payroll • Recruitment • Business Consulting • Management Consulting • Financial Consulting • Insurance Services • Virtual Assistants • Administrative Services • Data Entry • Translation • Documentation"],
  ["advertising-marketing-creative", "Advertising, Marketing & Creative Services", "Advertising, Marketing at Creative Services", "megaphone", "services",
    "Social Media Marketing • Digital Marketing • Facebook Ads • TikTok Marketing • Google Ads • SEO • Branding • Logo Design • Graphic Design • Video Production • Photography • Product Photography • Livestreaming • Influencer Marketing • Content Creation • Copywriting • Printing • Signage • Website Development • App Development • E-Commerce Development • AI Automation • CRM Setup • Email/SMS Marketing"],
  ["home-repair-technical-services", "Home, Repair & Technical Services", "Pagkukumpuni, Home at Technical Services", "wrench", "services",
    "Electrician • Plumber • Carpenter • Painter • Welder • Mason • Aircon Installation • Aircon Cleaning • Appliance Repair • Computer Repair • Phone Repair • CCTV Installation • Solar Installation • Automotive Repair • Motorcycle Repair • Furniture Repair • Cleaning Services • Pest Control • Landscaping • Renovation • Construction Services • Handyman"],
  ["events-catering-hospitality", "Events, Catering & Hospitality Services", "Events, Catering at Hospitality", "party-popper", "services",
    "Catering • Food Carts • Mobile Bars • Event Venues • Hotels & Resorts • Event Planning • Wedding Coordination • Photography • Videography • Photo Booths • Lights & Sounds • LED Walls • Stage Setup • Tent/Table/Chair Rental • Decorations • Flowers • Cakes • Hosts • Performers • DJs • Bands • Transportation • Event Giveaways"],

  ["business-opportunities", "Business Opportunities, Franchises & Negosyo Packages", "Business Opportunities, Franchise at Negosyo Packages", "rocket", "negosyo",
    "Franchises • Micro-Franchises • Dealerships • Distributorships • Reseller Packages • Business-in-a-Box • Food Cart Packages • Home-Based Businesses • Online Business Packages • Vending Businesses • Manufacturing Opportunities • Service Businesses • Agricultural Businesses • Startup Kits • Equipment Loan Programs • Authorized Dealer Opportunities • Provincial Distributor Opportunities • City/Municipal Distributor Opportunities"],
];

// Categories created by earlier migrations / the old seed → where their listings go (and the old row is then removed).
const OLD_TO_NEW = {
  "food-beverage": "food-beverages", agriculture: "agriculture-farm-fisheries", "health-beauty": "beauty-wellness",
  "home-living": "home-furniture-living", electronics: "mobile-gadgets", "construction-hardware": "construction-hardware-industrial",
  "packaging-printing": "packaging-printing-signage", "auto-motor": "automotive-moto-ev", "crafts-gifts": "gifts-crafts-personalized",
  "school-office": "school-office-educational", services: "professional-business-services", "real-estate": "real-estate-commercial",
  "import-brokerage": "logistics-courier-pasabuy--customs-brokerage", "trucking-logistics": "logistics-courier-pasabuy--trucking",
  "couriers-pasabuy": "logistics-courier-pasabuy--pasabuy", "advertising-marketing": "advertising-marketing-creative", "catering-concession": "events-catering-hospitality--catering",
  "accounting-tax": "professional-business-services--accounting", "rebrand-giveaways": "gifts-crafts-personalized--corporate-giveaways",
};

const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const out = [];
out.push(`-- Buy/Sell category taxonomy: 30 major categories in 4 discovery tabs, with sub-categories, plus a listing "condition" filter
-- (new / used / refurbished / surplus) instead of a separate pre-owned category.
-- GENERATED by scripts/build-taxonomy-migration.mjs. Edit that file and write a new migration for future changes.

alter table public.categories add column if not exists tab text not null default 'products' check (tab in ('products', 'suppliers', 'services', 'negosyo'));
create index if not exists categories_parent on public.categories (parent_id);

alter table public.listings add column if not exists condition text not null default 'new' check (condition in ('new', 'used', 'refurbished', 'surplus'));
create index if not exists listings_condition on public.listings (condition) where condition <> 'new';

-- Major categories
insert into public.categories (slug, name_en, name_fil, icon, sort_order, tab, parent_id, is_active) values`);
out.push(MAJORS.map((m, i) => `  (${q(m[0])}, ${q(m[1])}, ${q(m[2])}, ${q(m[3])}, ${i + 1}, ${q(m[4])}, null, true)`).join(",\n"));
out.push(`on conflict (slug) do update set name_en = excluded.name_en, name_fil = excluded.name_fil, icon = excluded.icon, sort_order = excluded.sort_order, tab = excluded.tab, parent_id = null, is_active = true;
`);

const subs = [];
for (const m of MAJORS) {
  const seen = new Set();
  T(m[5]).forEach((name, i) => {
    const slug = `${m[0]}--${slugify(name)}`;
    if (seen.has(slug)) return;
    seen.add(slug);
    subs.push(`  (${q(slug)}, ${q(name)}, ${i + 1}, ${q(m[0])})`);
  });
}
out.push(`-- Sub-categories (${subs.length})
insert into public.categories (slug, name_en, name_fil, icon, sort_order, tab, parent_id, is_active)
select v.slug, v.name, v.name, null, v.ord, p.tab, p.id, true
from (values
${subs.join(",\n")}
) as v(slug, name, ord, parent_slug)
join public.categories p on p.slug = v.parent_slug
on conflict (slug) do update set name_en = excluded.name_en, name_fil = excluded.name_fil, sort_order = excluded.sort_order, tab = excluded.tab, parent_id = excluded.parent_id, is_active = true;

-- Move listings off the old flat categories, then remove them.
do $$
declare m record; new_id uuid; old_id uuid;
begin
  for m in select * from (values
${Object.entries(OLD_TO_NEW).map(([o, n]) => `    (${q(o)}, ${q(n)})`).join(",\n")}
  ) as t(old_slug, new_slug) loop
    select id into old_id from public.categories where slug = m.old_slug;
    select id into new_id from public.categories where slug = m.new_slug;
    if old_id is not null and new_id is not null then
      update public.listings set category_id = new_id where category_id = old_id;
      delete from public.categories where id = old_id;
    end if;
  end loop;
end $$;
`);
const file = path.join(__dirname, "..", "supabase", "migrations", "20261015000001_category_taxonomy.sql");
fs.writeFileSync(file, out.join("\n"));
console.log(`majors: ${MAJORS.length}, sub-categories: ${subs.length} -> ${path.relative(process.cwd(), file)}`);
