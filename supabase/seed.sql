-- DEV SEED DATA. Safe to re-run via `npx supabase db reset`.
-- Demo accounts (email + password "password123", dev only):
--   admin@marketplaceph.test  (admin)      buyer@marketplaceph.test (buyer)
--   seller1@… to seller9@marketplaceph.test (one per demo store)
-- Phone test OTP numbers are configured in supabase/config.toml (code 123456).
--
-- NOTE: PSGC data below is a curated starter subset (all 17 regions + major provinces/cities)
-- with short stable keys, NOT the full official PSGC list. See README → "Locations".

-- ───────── Regions / provinces / cities ─────────
insert into public.psgc_regions (code, name, short_name) values
  ('NCR', 'National Capital Region', 'NCR'),
  ('CAR', 'Cordillera Administrative Region', 'CAR'),
  ('R1', 'Ilocos Region (Region I)', 'Region I'),
  ('R2', 'Cagayan Valley (Region II)', 'Region II'),
  ('R3', 'Central Luzon (Region III)', 'Region III'),
  ('R4A', 'CALABARZON (Region IV-A)', 'Region IV-A'),
  ('R4B', 'MIMAROPA (Region IV-B)', 'MIMAROPA'),
  ('R5', 'Bicol Region (Region V)', 'Region V'),
  ('R6', 'Western Visayas (Region VI)', 'Region VI'),
  ('R7', 'Central Visayas (Region VII)', 'Region VII'),
  ('R8', 'Eastern Visayas (Region VIII)', 'Region VIII'),
  ('R9', 'Zamboanga Peninsula (Region IX)', 'Region IX'),
  ('R10', 'Northern Mindanao (Region X)', 'Region X'),
  ('R11', 'Davao Region (Region XI)', 'Region XI'),
  ('R12', 'SOCCSKSARGEN (Region XII)', 'Region XII'),
  ('R13', 'Caraga (Region XIII)', 'Caraga'),
  ('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao', 'BARMM');

insert into public.psgc_provinces (code, region_code, name) values
  ('BENGUET', 'CAR', 'Benguet'),
  ('ILOCOSNORTE', 'R1', 'Ilocos Norte'), ('PANGASINAN', 'R1', 'Pangasinan'),
  ('ISABELA', 'R2', 'Isabela'),
  ('PAMPANGA', 'R3', 'Pampanga'), ('BULACAN', 'R3', 'Bulacan'), ('TARLAC', 'R3', 'Tarlac'),
  ('BATANGAS', 'R4A', 'Batangas'), ('CAVITE', 'R4A', 'Cavite'), ('LAGUNA', 'R4A', 'Laguna'), ('RIZAL', 'R4A', 'Rizal'),
  ('PALAWAN', 'R4B', 'Palawan'),
  ('ALBAY', 'R5', 'Albay'), ('CAMSUR', 'R5', 'Camarines Sur'),
  ('ILOILO', 'R6', 'Iloilo'), ('NEGOCC', 'R6', 'Negros Occidental'),
  ('CEBU', 'R7', 'Cebu'), ('BOHOL', 'R7', 'Bohol'),
  ('LEYTE', 'R8', 'Leyte'),
  ('ZAMSUR', 'R9', 'Zamboanga del Sur'),
  ('MISORIENTAL', 'R10', 'Misamis Oriental'), ('BUKIDNON', 'R10', 'Bukidnon'),
  ('DAVAOSUR', 'R11', 'Davao del Sur'),
  ('SOUTHCOT', 'R12', 'South Cotabato'),
  ('AGUSANNORTE', 'R13', 'Agusan del Norte'),
  ('MAGUINDANAO', 'BARMM', 'Maguindanao del Norte');

insert into public.psgc_cities (code, region_code, province_code, name) values
  ('NCR-MNL', 'NCR', null, 'City of Manila'), ('NCR-QC', 'NCR', null, 'Quezon City'),
  ('NCR-MKT', 'NCR', null, 'Makati City'), ('NCR-SJ', 'NCR', null, 'San Juan City'),
  ('NCR-PSG', 'NCR', null, 'Pasig City'), ('NCR-CAL', 'NCR', null, 'Caloocan City'),
  ('NCR-TGG', 'NCR', null, 'Taguig City'), ('NCR-MND', 'NCR', null, 'Mandaluyong City'),
  ('NCR-PQE', 'NCR', null, 'Parañaque City'), ('NCR-VAL', 'NCR', null, 'Valenzuela City'),
  ('BAG', 'CAR', 'BENGUET', 'Baguio City'), ('LATRI', 'CAR', 'BENGUET', 'La Trinidad'),
  ('LAOAG', 'R1', 'ILOCOSNORTE', 'Laoag City'), ('DAGUPAN', 'R1', 'PANGASINAN', 'Dagupan City'),
  ('ILAGAN', 'R2', 'ISABELA', 'Ilagan City'),
  ('SANFER', 'R3', 'PAMPANGA', 'City of San Fernando'), ('ANGELES', 'R3', 'PAMPANGA', 'Angeles City'),
  ('MALOLOS', 'R3', 'BULACAN', 'City of Malolos'), ('TARLAC', 'R3', 'TARLAC', 'Tarlac City'),
  ('LIPA', 'R4A', 'BATANGAS', 'Lipa City'), ('BATANGAS', 'R4A', 'BATANGAS', 'Batangas City'),
  ('BACOOR', 'R4A', 'CAVITE', 'Bacoor City'), ('DASMA', 'R4A', 'CAVITE', 'Dasmariñas City'),
  ('CALAMBA', 'R4A', 'LAGUNA', 'Calamba City'), ('SANTAROSA', 'R4A', 'LAGUNA', 'Santa Rosa City'),
  ('ANTIPOLO', 'R4A', 'RIZAL', 'Antipolo City'),
  ('PUERTO', 'R4B', 'PALAWAN', 'Puerto Princesa City'),
  ('LEGAZPI', 'R5', 'ALBAY', 'Legazpi City'), ('NAGA', 'R5', 'CAMSUR', 'Naga City'),
  ('ILOILOCITY', 'R6', 'ILOILO', 'Iloilo City'), ('BACOLOD', 'R6', 'NEGOCC', 'Bacolod City'),
  ('CEBUCITY', 'R7', 'CEBU', 'Cebu City'), ('MANDAUE', 'R7', 'CEBU', 'Mandaue City'),
  ('LAPULAPU', 'R7', 'CEBU', 'Lapu-Lapu City'), ('TAGBILARAN', 'R7', 'BOHOL', 'Tagbilaran City'),
  ('TACLOBAN', 'R8', 'LEYTE', 'Tacloban City'),
  ('ZAMBOANGA', 'R9', 'ZAMSUR', 'Zamboanga City'),
  ('CDO', 'R10', 'MISORIENTAL', 'Cagayan de Oro City'), ('MALAYBALAY', 'R10', 'BUKIDNON', 'Malaybalay City'),
  ('DAVAOCITY', 'R11', 'DAVAOSUR', 'Davao City'),
  ('GENSAN', 'R12', 'SOUTHCOT', 'General Santos City'),
  ('BUTUAN', 'R13', 'AGUSANNORTE', 'Butuan City'),
  ('COTABATO', 'BARMM', 'MAGUINDANAO', 'Cotabato City');

-- ───────── Categories ─────────
insert into public.categories (slug, name_en, name_fil, icon, sort_order) values
  ('food-beverage', 'Food & Beverage', 'Pagkain at Inumin', 'utensils', 1),
  ('agriculture', 'Agriculture & Farm Supplies', 'Agrikultura', 'sprout', 2),
  ('fashion-apparel', 'Fashion & Apparel', 'Damit at Fashion', 'shirt', 3),
  ('health-beauty', 'Health & Beauty', 'Kalusugan at Pampaganda', 'heart-pulse', 4),
  ('home-living', 'Home & Living', 'Gamit sa Bahay', 'sofa', 5),
  ('electronics', 'Electronics & Gadgets', 'Elektroniks at Gadgets', 'smartphone', 6),
  ('construction-hardware', 'Construction & Hardware', 'Konstruksyon at Hardware', 'hammer', 7),
  ('packaging-printing', 'Packaging & Printing', 'Packaging at Pag-print', 'package', 8),
  ('auto-motor', 'Auto & Motorcycle', 'Sasakyan at Motor', 'car', 9),
  ('crafts-gifts', 'Crafts & Gifts', 'Crafts at Regalo', 'gift', 10),
  ('school-office', 'School & Office', 'Eskwela at Opisina', 'briefcase', 11),
  ('services', 'Services', 'Serbisyo', 'wrench', 12);

-- ───────── Banned / prohibited items ─────────
insert into public.banned_keywords (keyword, reason) values
  ('firearm', 'Firearms are prohibited'), ('baril', 'Firearms are prohibited'),
  ('ammunition', 'Ammunition is prohibited'), ('shabu', 'Illegal drugs are prohibited'),
  ('marijuana', 'Illegal drugs are prohibited'), ('cocaine', 'Illegal drugs are prohibited'),
  ('counterfeit', 'Counterfeit goods are prohibited'), ('peke', 'Counterfeit goods are prohibited'),
  ('fireworks', 'Fireworks require a permit and cannot be listed'),
  ('prescription drug', 'Prescription drugs cannot be sold without a licensed pharmacy');

-- ───────── Demo users (dev only) ─────────
do $$
declare
  i int;
  uid uuid;
  names text[] := array[
    'Admin MarketplacePH', 'Buyer Demo',
    'Nena Dela Cruz', 'Ramon Villanueva', 'Liza Bautista', 'Carlo Mendoza', 'Grace Tan',
    'Teresita Gonzales', 'Jun Santos', 'Marites Lim', 'Kevin Ong'];
  emails text[] := array[
    'admin@marketplaceph.test', 'buyer@marketplaceph.test',
    'seller1@marketplaceph.test', 'seller2@marketplaceph.test', 'seller3@marketplaceph.test',
    'seller4@marketplaceph.test', 'seller5@marketplaceph.test', 'seller6@marketplaceph.test',
    'seller7@marketplaceph.test', 'seller8@marketplaceph.test', 'seller9@marketplaceph.test'];
begin
  for i in 1..array_length(emails, 1) loop
    uid := ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', emails[i],
      extensions.crypt('password123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', names[i]),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', emails[i], 'email_verified', true), 'email', now(), now(), now());
  end loop;
  update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000001';
end $$;

-- ───────── Demo stores ─────────
insert into public.stores
  (id, owner_id, slug, name, tagline, description, seller_type, region_code, province_code, city_code, year_started, verification_level, contact_phone)
select ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad((n + 2)::text, 12, '0'))::uuid,
       slug, name, tagline, descr, st::public.seller_type, reg, prov, city, yr, vl, phone
from (values
  (1, 'kusina-ni-aling-nena', 'Kusina ni Aling Nena', 'Lutong bahay, ready for resellers', 'Home-style sauces, spreads and ready-to-cook packs made in our Quezon City kitchen. FDA LTO in process.', 'manufacturer', 'NCR', null, 'NCR-QC', 2016, 2, '09171110001'),
  (2, 'cebu-sweet-mango-co', 'Cebu Sweet Mango Co.', 'Dried mango direct from the source', 'We dry and pack Cebu mangoes and sell wholesale to resellers nationwide.', 'manufacturer', 'R7', 'CEBU', 'CEBUCITY', 2012, 3, '09171110002'),
  (3, 'davao-cacao-traders', 'Davao Cacao Traders', 'Cacao, coffee and tablea in bulk', 'Supplier of cacao beans, tablea and coffee from Davao farmers.', 'distributor', 'R11', 'DAVAOSUR', 'DAVAOCITY', 2018, 2, '09171110003'),
  (4, 'benguet-highland-veggies', 'Benguet Highland Veggies', 'Fresh from La Trinidad every morning', 'Highland vegetables for restaurants, palengke vendors and resellers.', 'distributor', 'CAR', 'BENGUET', 'LATRI', 2009, 1, '09171110004'),
  (5, 'divisoria-packaging-hub', 'Divisoria Packaging Hub', 'Boxes, bottles, labels — small orders welcome', 'One-stop packaging supplier for food and beauty MSMEs.', 'distributor', 'NCR', null, 'NCR-MNL', 2014, 2, '09171110005'),
  (6, 'iloilo-habi-weaves', 'Iloilo Habi Weaves', 'Handwoven pieces by local weavers', 'Hablon-inspired bags, table runners and giveaways, made to order.', 'manufacturer', 'R6', 'ILOILO', 'ILOILOCITY', 2019, 1, '09171110006'),
  (7, 'pampanga-tools-hardware', 'Pampanga Tools & Hardware', 'Contractor-grade tools, fair prices', 'Hardware retailer serving Central Luzon builders and fabricators.', 'retailer', 'R3', 'PAMPANGA', 'SANFER', 2005, 2, '09171110007'),
  (8, 'lipa-print-and-design', 'Lipa Print & Design', 'Tarpaulins, labels, and logos', 'Print shop and design studio for small business branding.', 'service_provider', 'R4A', 'BATANGAS', 'LIPA', 2020, 1, '09171110008'),
  (9, 'greenhills-gadget-import', 'Greenhills Gadget Import', 'Direct importer — wholesale phone accessories', 'We import accessories directly and sell to resellers with MOQ tiers.', 'direct_importer', 'NCR', null, 'NCR-SJ', 2017, 2, '09171110009')
) as s(n, slug, name, tagline, descr, st, reg, prov, city, yr, vl, phone);

-- ───────── Demo listings ─────────
-- (store_n, category, title, description, price_type, min, max, unit, moq, stock, qty, kind)
with src(store_n, cat, title, descr, pt, pmin, pmax, unit, moq, stock, qty, kind) as (values
  (1, 'food-beverage', 'Spicy Garlic Chili Oil 250ml (bottle)', 'Crunchy chili oil, no preservatives. Best sold by the dozen to resellers.', 'fixed', 135, null, 'bottle', 6, 'in_stock', 240, 'product'),
  (1, 'food-beverage', 'Homemade Ube Halaya 500g', 'Made to order, fresh batch every Friday. Good for 2 weeks refrigerated.', 'fixed', 220, null, 'tub', 1, 'made_to_order', null, 'product'),
  (1, 'food-beverage', 'Party Tray Pancit Bihon (10 pax)', 'Catering tray with 2-day advance notice. Metro Manila delivery.', 'range', 850, 1200, 'tray', 1, 'pre_order', null, 'product'),
  (2, 'food-beverage', 'Dried Mango 100g Pack (wholesale)', 'Cebu 7D-style dried mango, resealable pack. Bulk pricing for resellers.', 'fixed', 95, null, 'pack', 20, 'in_stock', 1500, 'product'),
  (2, 'food-beverage', 'Dried Mango 1kg Bulk Bag', 'Food-grade bag, ideal for repacking. Nationwide shipping via courier.', 'fixed', 780, null, 'bag', 5, 'in_stock', 320, 'product'),
  (2, 'crafts-gifts', 'Pasalubong Gift Box Set (Cebu)', 'Assorted dried mango, otap and peanut brittle in a gift box.', 'fixed', 450, null, 'box', 10, 'in_stock', 90, 'product'),
  (3, 'food-beverage', 'Tablea de Cacao 500g (Davao)', 'Pure cacao tablea, no sugar. For sikwate and baking.', 'fixed', 260, null, 'pack', 10, 'in_stock', 400, 'product'),
  (3, 'food-beverage', 'Roasted Cacao Nibs 1kg', 'Bulk cacao nibs for chocolatiers and smoothie bars.', 'fixed', 640, null, 'bag', 3, 'in_stock', 60, 'product'),
  (3, 'food-beverage', 'Green Coffee Beans (Arabica) per kg', 'Direct from partner farmers. Message for current harvest price.', 'message', null, null, 'kg', 25, 'pre_order', null, 'product'),
  (4, 'agriculture', 'Fresh Carrots (per kg, 20kg min)', 'Packed in sacks, delivered to Metro Manila daily.', 'fixed', 55, null, 'kg', 20, 'in_stock', 800, 'product'),
  (4, 'agriculture', 'Cabbage (per kg)', 'Highland cabbage, grade A. Truck load available.', 'fixed', 38, null, 'kg', 50, 'in_stock', 2000, 'product'),
  (4, 'agriculture', 'Strawberries 250g Box', 'La Trinidad strawberries, sold by the crate of 24.', 'range', 90, 130, 'box', 24, 'out_of_stock', 0, 'product'),
  (5, 'packaging-printing', 'Kraft Paper Food Box 6x6 (100 pcs)', 'Grease-resistant, good for pastries and rice meals.', 'fixed', 480, null, 'bundle', 1, 'in_stock', 350, 'product'),
  (5, 'packaging-printing', 'Amber Glass Bottle 100ml w/ dropper', 'For serums, oils and tinctures. Sold per 12 pcs.', 'fixed', 360, null, 'dozen', 1, 'in_stock', 120, 'product'),
  (5, 'packaging-printing', 'Custom Roll Stickers (waterproof)', 'Label stickers with your logo. MOQ 500.', 'range', 1.5, 3, 'pc', 500, 'made_to_order', null, 'product'),
  (6, 'crafts-gifts', 'Handwoven Table Runner', 'Natural fiber, 3 colors. Made to order within 2 weeks.', 'fixed', 750, null, 'pc', 1, 'made_to_order', null, 'product'),
  (6, 'fashion-apparel', 'Habi Tote Bag (Small)', 'Great for corporate giveaways. Bulk orders welcome.', 'fixed', 320, null, 'pc', 12, 'in_stock', 45, 'product'),
  (6, 'crafts-gifts', 'Woven Coaster Set of 6', 'Souvenir-ready set. Packed in kraft box.', 'fixed', 280, null, 'set', 6, 'in_stock', 150, 'product'),
  (7, 'construction-hardware', 'Cordless Drill 20V Set', 'Includes 2 batteries and charger. 6-month shop warranty.', 'fixed', 3250, null, 'set', 1, 'in_stock', 14, 'product'),
  (7, 'construction-hardware', 'Welding Rod 6013 (per kg)', 'Box of 5kg, retail and bulk.', 'fixed', 165, null, 'kg', 5, 'in_stock', 200, 'product'),
  (7, 'construction-hardware', 'Hollow Blocks 4" (per 100)', 'Pickup in San Fernando or truck delivery.', 'fixed', 1500, null, 'hundred', 1, 'in_stock', 30, 'product'),
  (8, 'services', 'Tarpaulin Printing (per sq ft)', 'Full-color, with eyelets. Same-day rush available.', 'fixed', 14, null, 'sq ft', 6, 'in_stock', null, 'service'),
  (8, 'services', 'Logo & Branding Package', 'Logo, color palette and social media kit for your small business.', 'range', 2500, 6000, 'package', 1, 'in_stock', null, 'service'),
  (8, 'services', 'Menu Board & Signage Design', 'Layout and print-ready files. Message for rush rates.', 'message', null, null, 'project', 1, 'in_stock', null, 'service'),
  (9, 'electronics', 'Fast Charger 20W USB-C (wholesale)', 'Brand-new, 3-month store warranty. Tiered pricing for resellers.', 'fixed', 135, null, 'pc', 10, 'in_stock', 800, 'product'),
  (9, 'electronics', 'Tempered Glass (assorted models)', 'Sold per 50 pcs. Message for model list.', 'range', 8, 14, 'pc', 50, 'in_stock', 5000, 'product'),
  (9, 'electronics', 'Bluetooth Earbuds TWS', 'Imported direct, sealed box. Bulk price on request.', 'fixed', 320, null, 'pc', 5, 'out_of_stock', 0, 'product')
)
insert into public.listings
  (store_id, category_id, kind, title, description, price_type, price_min, price_max, unit, moq, stock_status, quantity_on_hand, region_code, province_code, city_code)
select s.id, c.id, src.kind::public.listing_kind, src.title, src.descr, src.pt::public.price_type, src.pmin, src.pmax,
       src.unit, src.moq, src.stock::public.stock_status, src.qty, s.region_code, s.province_code, s.city_code
from src
join public.stores s on s.id = ('10000000-0000-4000-8000-' || lpad(src.store_n::text, 12, '0'))::uuid
join public.categories c on c.slug = src.cat;

-- Placeholder images (served from /public/seed). Real sellers upload to storage.
insert into public.listing_images (listing_id, path, position)
select l.id, '/seed/' || c.slug || '.svg', 0
from public.listings l join public.categories c on c.id = l.category_id;

-- Wholesale tiers for a few listings
insert into public.listing_price_tiers (listing_id, min_qty, unit_price)
select l.id, t.min_qty, t.unit_price from public.listings l
join (values
  ('Dried Mango 100g Pack (wholesale)', 100, 88), ('Dried Mango 100g Pack (wholesale)', 500, 80),
  ('Fast Charger 20W USB-C (wholesale)', 50, 125), ('Fast Charger 20W USB-C (wholesale)', 200, 115),
  ('Spicy Garlic Chili Oil 250ml (bottle)', 24, 125), ('Tablea de Cacao 500g (Davao)', 50, 235)
) as t(title, min_qty, unit_price) on t.title = l.title;

-- One demo conversation so the inbox isn't empty.
insert into public.conversations (id, buyer_id, store_id, listing_id)
select '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', l.id
from public.listings l where l.title = 'Dried Mango 100g Pack (wholesale)';
insert into public.messages (conversation_id, sender_id, body) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Hello! Magkano po kung 300 packs? Pwede po ba i-ship to Pampanga?'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'Hi po! For 300 packs it''s ₱88 each. We can ship via J&T or LBC. Ready stock po.');

-- ───────── Phase 2 demo data: completed deals, reviews, one demo watchlist entry ─────────
-- Deals are inserted already-confirmed (the app normally needs seller proposal + buyer confirmation).
do $$
declare
  buyers uuid[] := array[
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000010']::uuid[];
  i int; sid uuid; b uuid; oid uuid; plan record;
begin
  -- (store number, how many deals, unit amount, qty)
  for plan in select * from (values (2, 24, 8800, 100), (3, 7, 5200, 20), (1, 3, 1500, 12), (7, 5, 3250, 1), (9, 2, 6750, 50)) as p(store_n, n, amt, qty) loop
    sid := ('10000000-0000-4000-8000-' || lpad(plan.store_n::text, 12, '0'))::uuid;
    for i in 1..plan.n loop
      b := buyers[1 + (i % array_length(buyers, 1))];
      -- a store's owner can't buy from themselves
      if b = ('00000000-0000-4000-8000-' || lpad((plan.store_n + 2)::text, 12, '0'))::uuid then b := buyers[1]; end if;
      insert into public.orders (store_id, seller_id, buyer_id, summary, quantity, amount, status, confirmed_at, created_at)
        values (sid, sid, b, 'Demo deal #' || i, plan.qty, plan.amt, 'completed', now() - (i || ' days')::interval, now() - (i + 1 || ' days')::interval)
        returning id into oid;
      insert into public.reviews (order_id, reviewer_id, reviewee_id, store_id, direction, rating, comment)
        values (oid, b, b, sid, 'buyer_to_seller', case when i % 7 = 0 then 4 else 5 end,
                (array['Ayos ang item, mabilis sumagot!', 'Complete and well packed. Will reorder.', 'Legit seller, smooth transaction.', 'Maganda quality, tama ang presyo.'])[1 + i % 4]);
      -- the seller rates the buyer on some deals
      if i % 2 = 0 then
        insert into public.reviews (order_id, reviewer_id, reviewee_id, store_id, direction, rating, comment)
          values (oid, (select owner_id from public.stores where id = sid), b, sid, 'seller_to_buyer', 5, 'Prompt payment, easy to deal with.');
      end if;
    end loop;
  end loop;
  -- one cancelled deal (cancelled by the buyer) to exercise cancellation rate
  insert into public.orders (store_id, seller_id, buyer_id, summary, quantity, amount, status, cancelled_by)
    values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000008', 'Demo cancelled deal', 5, 500, 'cancelled', '00000000-0000-4000-8000-000000000008');
end $$;

-- Clearly fictional entry so /check can be demoed (not tied to any real account).
insert into public.watchlist_entries (phone, gcash_name, store_name, store_slug, expires_at, review_on)
values ('+639170009999', 'Demo Flagged Seller', 'Demo Flagged Store', 'demo-flagged-store', now() + interval '1 year', now() + interval '6 months');


-- ───────── Phase 3 demo data: payment accounts, shipping methods, orders at different steps ─────────
-- Payment accounts are fictional placeholders.
insert into public.store_payment_methods (store_id, kind, account_name, account_number, bank_name, instructions)
select s.id, 'gcash', s.name, '0917000' || lpad(n::text, 4, '0'), null, 'Send the exact amount and upload the screenshot.'
from public.stores s, generate_series(1, 1) n;
insert into public.store_payment_methods (store_id, kind, account_name, account_number, bank_name)
select id, 'bank', name, '0012345678', 'BDO' from public.stores where slug in ('cebu-sweet-mango-co', 'pampanga-tools-hardware');
insert into public.store_payment_methods (store_id, kind, instructions)
select id, 'cod', 'COD available in Metro Manila only.' from public.stores where slug in ('kusina-ni-aling-nena', 'divisoria-packaging-hub');

-- Which built-in shipping methods each demo store supports
insert into public.store_shipping_methods (store_id, method_id)
select s.id, m.id from public.stores s join public.shipping_methods m on m.owner_id is null
where (s.slug = 'kusina-ni-aling-nena' and m.name in ('Lalamove', 'Grab Express', 'J&T Express', 'LBC', 'Pickup / meetup'))
   or (s.slug = 'cebu-sweet-mango-co' and m.name in ('J&T Express', 'LBC', '2GO', 'Flash Express', 'Lalamove', 'Pickup / meetup'))
   or (s.slug = 'davao-cacao-traders' and m.name in ('J&T Express', 'LBC', '2GO', 'Trucking / truck for hire'))
   or (s.slug = 'benguet-highland-veggies' and m.name in ('Bus terminal-to-terminal (cargo)', 'Van / jeep padala', 'Trucking / truck for hire', 'Lalamove'))
   or (s.slug = 'divisoria-packaging-hub' and m.name in ('Lalamove', 'Transportify', 'J&T Express', 'LBC', 'Pickup / meetup'))
   or (s.slug = 'pampanga-tools-hardware' and m.name in ('Transportify', 'Trucking / truck for hire', 'Lalamove', 'Pickup / meetup'))
   or (s.slug not in ('kusina-ni-aling-nena', 'cebu-sweet-mango-co', 'davao-cacao-traders', 'benguet-highland-veggies', 'divisoria-packaging-hub', 'pampanga-tools-hardware') and m.name in ('J&T Express', 'LBC', 'Lalamove', 'Pickup / meetup'));

update public.listings set weight_kg = 1.0 where title = 'Dried Mango 1kg Bulk Bag';
update public.listings set weight_kg = 0.15 where title = 'Dried Mango 100g Pack (wholesale)';
update public.listings set weight_kg = 1.0 where title = 'Fresh Carrots (per kg, 20kg min)';
update public.listings set weight_kg = 25 where title = 'Hollow Blocks 4" (per 100)';
update public.listings set weight_kg = 0.4 where title = 'Cordless Drill 20V Set';
update public.orders set cancelled_from = 'quoted' where summary = 'Demo cancelled deal';

-- Three demo orders (buyer = buyer@…, seller = Cebu Sweet Mango Co.) so every side of the flow can be tried
do $$
declare
  buyer uuid := '00000000-0000-4000-8000-000000000002';
  st uuid := '10000000-0000-4000-8000-000000000002';
  seller uuid := '00000000-0000-4000-8000-000000000004';
  convo uuid := '20000000-0000-4000-8000-000000000001';
  bulk uuid; pack uuid; oid uuid; spec record;
begin
  select id into bulk from public.listings where title = 'Dried Mango 1kg Bulk Bag';
  select id into pack from public.listings where title = 'Dried Mango 100g Pack (wholesale)';
  for spec in select * from (values
    ('requested', 'Demo order: waiting for the seller to quote'),
    ('quoted', 'Demo order: quote ready, buyer can pay'),
    ('paid', 'Demo order: paid, seller can pack and ship')) as v(status, note)
  loop
    insert into public.orders (store_id, seller_id, buyer_id, conversation_id, summary, quantity, amount, status, is_full_flow, buyer_note,
                               shipping_fee, quoted_at, quote_expires_at, paid_at, payment_method)
    values (st, seller, buyer, convo, 'Dried Mango 100g Pack ×300, Dried Mango 1kg Bulk Bag ×5', 305,
            case when spec.status = 'requested' then 0 else 31900 end, spec.status::public.order_status, true, spec.note,
            case when spec.status = 'requested' then 0 else 1500 end,
            case when spec.status = 'requested' then null else now() end,
            case when spec.status = 'requested' then null else now() + interval '3 days' end,
            case when spec.status = 'paid' then now() end, case when spec.status = 'paid' then 'gcash' end)
    returning id into oid;
    insert into public.order_items (order_id, listing_id, title, unit, quantity, unit_price, available_qty)
    values (oid, pack, 'Dried Mango 100g Pack (wholesale)', 'pack', 300, case when spec.status = 'requested' then 88 else 88 end, case when spec.status = 'requested' then null else 300 end),
           (oid, bulk, 'Dried Mango 1kg Bulk Bag', 'bag', 5, 780, case when spec.status = 'requested' then null else 5 end);
    insert into public.order_delivery (order_id, recipient_name, phone, address, landmark, region_code, province_code, city_code)
    values (oid, 'Buyer Demo', '09171112222', '123 Sample St., Brgy. Demo', 'Near the plaza', 'R3', 'PAMPANGA', 'SANFER');
  end loop;
end $$;


-- ───────── Phase 4 demo data ─────────
-- FLAME membership tiers for demo accounts so every level can be tried; all other accounts stay on Apprentice (free).
insert into public.subscriptions (user_id, plan, billing, status, note) values
  ('00000000-0000-4000-8000-000000000004', 'pro', 'monthly', 'active', 'Demo: Cebu Sweet Mango Co. (seller2) - FLAME Pro'),
  ('00000000-0000-4000-8000-000000000005', 'neo', 'yearly', 'active', 'Demo: seller3 - FLAME Neo'),
  ('00000000-0000-4000-8000-000000000006', 'champion', 'yearly', 'active', 'Demo: seller4 - FLAME Champion (featured)'),
  ('00000000-0000-4000-8000-000000000002', 'micro', 'monthly', 'active', 'Demo: Buyer Demo - FLAME Micro'),
  ('00000000-0000-4000-8000-000000000001', 'champion', null, 'active', 'Demo: admin');

insert into public.crm_customers (store_id, buyer_id, notes, tags) values
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Reseller in Pampanga. Prefers J&T or bus cargo. Pays by GCash same day.', array['reseller', 'vip']);
insert into public.supplier_notes (buyer_id, store_id, notes, tags, favorite) values
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Reliable. Ask for the 300-pack tier price.', array['dried-mango'], true);

insert into public.restock_reminders (user_id, title, store_id, every_days, next_run_at) values
  ('00000000-0000-4000-8000-000000000002', 'Restock dried mango packs', '10000000-0000-4000-8000-000000000002', 30, now() + interval '20 days');
insert into public.follow_up_rules (store_id, listing_id, every_days, message)
select '10000000-0000-4000-8000-000000000002', id, 30, 'Kumusta po! Time to restock dried mango? Ready stock pa rin kami.'
from public.listings where title = 'Dried Mango 100g Pack (wholesale)';

insert into public.income_entries (user_id, entry_date, amount, category, note) values
  ('00000000-0000-4000-8000-000000000004', current_date - 6, 4200, 'Walk-in sales', 'Weekend bazaar'),
  ('00000000-0000-4000-8000-000000000004', current_date - 20, 3100, 'Walk-in sales', null);
insert into public.expenses (user_id, entry_date, amount, category, vendor, note) values
  ('00000000-0000-4000-8000-000000000004', current_date - 3, 1850, 'Packaging', 'Divisoria Packaging Hub', 'Kraft boxes'),
  ('00000000-0000-4000-8000-000000000004', current_date - 9, 2400, 'Raw materials', 'Mango growers coop', null),
  ('00000000-0000-4000-8000-000000000004', current_date - 15, 600, 'Transport', 'Lalamove', null);

update public.listings set low_stock_threshold = 50 where title = 'Dried Mango 100g Pack (wholesale)';

-- ───────── Phase 5 demo data ─────────
-- Seller2 offers commissions on two listings; the demo buyer is an approved affiliate on one (and pending on the other).
update public.listings set commission_pct = 10 where title = 'Dried Mango 100g Pack (wholesale)' and store_id = '10000000-0000-4000-8000-000000000002';
update public.listings set commission_pct = 5 where store_id = '10000000-0000-4000-8000-000000000002' and title <> 'Dried Mango 100g Pack (wholesale)'
  and id = (select id from public.listings where store_id = '10000000-0000-4000-8000-000000000002' and title <> 'Dried Mango 100g Pack (wholesale)' order by title limit 1);
insert into public.affiliate_links (code, affiliate_id, listing_id, seller_id, status, rate, message, decided_at)
select 'demo2024', '00000000-0000-4000-8000-000000000002', l.id, '00000000-0000-4000-8000-000000000004', 'approved', l.commission_pct, 'I resell in Pampanga.', now()
from public.listings l where l.store_id = '10000000-0000-4000-8000-000000000002' and l.commission_pct = 10;
insert into public.affiliate_links (code, affiliate_id, listing_id, seller_id, status, message)
select 'demo2025', '00000000-0000-4000-8000-000000000002', l.id, '00000000-0000-4000-8000-000000000004', 'pending', 'Can I promote this one too?'
from public.listings l where l.store_id = '10000000-0000-4000-8000-000000000002' and l.commission_pct = 5;
insert into public.affiliate_clicks (link_id) select l.id from public.affiliate_links l, generate_series(1, 14) where l.code = 'demo2024';
update public.stores set website_url = 'https://example.com/cebu-sweet-mango', facebook_url = 'https://facebook.com/cebusweetmango' where id = '10000000-0000-4000-8000-000000000002';

-- The demo deals/reviews above fire notification triggers; start the demo with a clean inbox.
delete from public.notifications;
