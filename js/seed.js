/* Gopher — sample data for the demo. Every person here is fictional.
 * Times are relative to "now" so the demo always looks current.
 * G.seed(now) returns a fresh state object; store.js calls it on first run and on Reset.
 */
(function (G) {
  'use strict';

  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  function seed(now) {
    // n days ago at hh:mm local time
    const ago = (days, hh, mm) => {
      const d = new Date(now - days * DAY);
      d.setHours(hh, mm || 0, 0, 0);
      return d.getTime();
    };

    // ---- People ---------------------------------------------------------
    const users = {};
    function user(id, first, last, program, year, color, extra) {
      users[id] = Object.assign({
        id, first, last, schoolId: 'adnu', program, year,
        email: first.toLowerCase() + '.' + last.toLowerCase().replace(/\s+/g, '') + '@gbox.adnu.edu.ph',
        verified: true, verification: { method: 'id', status: 'verified' }, color, bio: '',
        online: false,
        ratings: { provider: { sum: 0, count: 0 }, requester: { sum: 0, count: 0 } },
        stats: { jobs: 0, onTime: 0, lent: 0, sold: 0 },
        wallet: { available: 0, tx: [] },
        joinedAt: ago(60, 9),
        persona: false,
      }, extra || {});
      users[id].verification.at = users[id].joinedAt + 20 * MIN;
    }
    const rate = (avg, count) => ({ sum: Math.round(avg * count * 10) / 10, count });

    user('u_bea', 'Bea', 'Santos', 'BS Accountancy', '3rd year', '#0B67AD', {
      persona: true, verification: { method: 'matriculation', status: 'verified' }, bio: 'Org officer, always between meetings. Selling my Marketing finals reviewer.',
      ratings: { provider: rate(4.8, 4), requester: rate(4.8, 14) }, stats: { jobs: 0, onTime: 0, lent: 0, sold: 4 },
      joinedAt: ago(52, 10),
    });
    user('u_migs', 'Migs', 'Reyes', 'BS Civil Engineering', '2nd year', '#0F766E', {
      persona: true, online: false,
      bio: 'Free Mon/Wed/Fri 1–3 PM. Fast on errands, lends a tripod and a powerbank.',
      ratings: { provider: rate(4.9, 41), requester: rate(4.8, 6) }, stats: { jobs: 41, onTime: 97, lent: 9, sold: 0 },
      joinedAt: ago(58, 9),
    });
    user('u_mika', 'Mika', 'Rosales', 'AB Psychology', '3rd year', '#BE185D', {
      online: true, bio: 'Top go-runner. Printing runs are my specialty.',
      ratings: { provider: rate(4.9, 38), requester: rate(5, 3) }, stats: { jobs: 38, onTime: 98, lent: 2, sold: 0 },
    });
    user('u_nico', 'Nico', 'Aquino', 'BSBA Marketing', '2nd year', '#6D28D9', {
      online: true, bio: 'New go-runner! Also sharing my Consumer Behavior notes.',
      joinedAt: ago(6, 13),
    });
    user('u_joaquin', 'Joaquin', 'Lim', 'AB Communication', '4th year', '#9A3412', {
      bio: 'Vlogging gear for your org videos and projects.',
      ratings: { provider: rate(4.8, 12), requester: rate(4.9, 4) }, stats: { jobs: 0, onTime: 0, lent: 12, sold: 0 },
    });
    user('u_kyla', 'Kyla', 'Bautista', 'BS Biology', '3rd year', '#15803D', {
      verification: { method: 'matriculation', status: 'verified' },
      bio: 'Umbrellas, a raincoat, a lab gown, and science reviewers.',
      ratings: { provider: rate(4.9, 19), requester: rate(4.8, 5) }, stats: { jobs: 0, onTime: 0, lent: 19, sold: 6 },
    });
    user('u_enzo', 'Enzo', 'Mendoza', 'BS Architecture', '2nd year', '#4338CA', {
      bio: 'Calculators and a full drafting set.',
      ratings: { provider: rate(4.7, 15), requester: rate(4.6, 3) }, stats: { jobs: 0, onTime: 0, lent: 15, sold: 3 },
    });
    user('u_rica', 'Rica', 'Torres', 'BS Accountancy', '4th year', '#A21CAF', {
      bio: 'Accountancy reviewers I made myself. Dean’s lister, happy to help.',
      ratings: { provider: rate(4.8, 23), requester: rate(5, 2) }, stats: { jobs: 0, onTime: 0, lent: 1, sold: 23 },
    });
    user('u_lara', 'Lara', 'Evangelista', 'AB Political Science', '4th year', '#0E7490', {
      verification: { method: 'matriculation', status: 'verified' },
      bio: 'Notes, secondhand books, and an arts kit.',
      ratings: { provider: rate(4.6, 8), requester: rate(4.7, 4) }, stats: { jobs: 0, onTime: 0, lent: 3, sold: 5 },
    });
    user('u_trish', 'Trish', 'Navarro', 'BS Nursing', '2nd year', '#B45309', {
      verification: { method: 'matriculation', status: 'verified' },
      ratings: { provider: rate(5, 1), requester: rate(4.7, 9) },
    });
    user('u_gab', 'Gab', 'Santiago', 'BS Computer Science', '3rd year', '#1D4ED8', {
      ratings: { provider: rate(4.5, 2), requester: rate(4.5, 6) },
    });
    user('u_ivan', 'Ivan', 'Cruz', 'BSBA Financial Management', '3rd year', '#7C3AED', {
      ratings: { provider: rate(0, 0), requester: rate(4.6, 5) },
    });

    // ---- Listings ----------------------------------------------------------
    const listings = {};
    function listing(id, kind, cat, ownerId, title, desc, extra) {
      listings[id] = Object.assign({
        id, kind, cat, ownerId, title, desc,
        rent: null, buy: null, deposit: 0, value: 0,
        format: null, subject: '', pages: 0,
        condition: 'Good', spot: 'Library entrance',
        photo: null, status: 'live', createdAt: ago(20, 10),
      }, extra || {});
    }
    const perDay = (price) => ({ price, per: 'day' });

    // Rentals: calculators
    listing('ls_calc991', 'rental', 'calc', 'u_enzo', 'Casio fx-991ES Plus scientific calculator',
      'Works for Calculus, Statistics and Engineering exams. Fresh batteries, cover included.',
      { rent: perDay(20), value: 1200, spot: 'Main Gate', createdAt: ago(30, 9) });
    listing('ls_calc82', 'rental', 'calc', 'u_kyla', 'Casio fx-82MS basic scientific calculator',
      'Simple and reliable. Good for Chemistry and Physics quizzes.',
      { rent: perDay(15), value: 650, createdAt: ago(18, 15) });
    listing('ls_fincalc', 'rental', 'calc', 'u_rica', 'Financial calculator (HP 10bII+)',
      'For Financial Management and Accounting problem sets. Manual included.',
      { rent: perDay(30), deposit: 300, value: 2200, spot: 'Student lounge', createdAt: ago(25, 11) });
    listing('ls_calc789', 'rental', 'calc', 'u_nico', 'Canon F-789SGA scientific calculator',
      'Has all the stat functions. Slightly scratched case, works perfectly.',
      { rent: perDay(20), value: 1100, condition: 'Fair', spot: 'Canteen', createdAt: ago(5, 14) });
    // Rentals: school supplies
    listing('ls_drafting', 'rental', 'supplies', 'u_enzo', 'Drafting set: T-square, triangles, compass',
      'Complete set in a tube. Please return the compass lead case.',
      { rent: perDay(20), value: 800, spot: 'Main Gate', createdAt: ago(28, 13) });
    listing('ls_labgown', 'rental', 'supplies', 'u_kyla', 'Lab gown, size M (freshly laundered)',
      'For lab days when you forgot yours. Returned washed, please!',
      { rent: perDay(20), value: 450, createdAt: ago(22, 9) });
    listing('ls_extcord', 'rental', 'supplies', 'u_gab', 'Extension cord, 5 m with 4 outlets',
      'For group study sessions and booth setups.',
      { rent: perDay(15), value: 500, spot: 'Student lounge', createdAt: ago(12, 16) });
    listing('ls_artkit', 'rental', 'supplies', 'u_lara', 'Arts & crafts kit: glue gun, cutter, metal ruler',
      'Great for exhibit boards and org booth decorations.',
      { rent: perDay(20), value: 900, spot: 'Canteen', createdAt: ago(16, 10) });
    // Rentals: tech & vlogging
    listing('ls_tripod', 'rental', 'tech', 'u_migs', 'Tripod 1.5 m + phone mount',
      'Sturdy aluminum tripod with a phone clamp and Bluetooth remote. Perfect for group vlogs and presentations.',
      { rent: perDay(50), deposit: 200, value: 1500, spot: 'Library entrance', createdAt: ago(21, 14) });
    listing('ls_ringlight', 'rental', 'tech', 'u_joaquin', 'Ring light 10" with stand',
      'Three light modes, USB powered. Stand extends to 1.6 m.',
      { rent: perDay(60), deposit: 250, value: 1300, spot: 'Student lounge', createdAt: ago(19, 11) });
    listing('ls_lapelmic', 'rental', 'tech', 'u_joaquin', 'Wireless lapel mic (USB-C and Lightning)',
      'Two clip-on mics with one receiver. Clean audio for interviews and reports.',
      { rent: perDay(80), deposit: 300, value: 1800, spot: 'Student lounge', createdAt: ago(17, 11) });
    listing('ls_camera', 'rental', 'tech', 'u_joaquin', 'Mirrorless camera (Sony a6000) with kit lens',
      'Includes 2 batteries, charger and a 64 GB card. For thesis defense videos and events.',
      { rent: perDay(300), deposit: 1000, value: 18000, spot: 'Student lounge', condition: 'Very good', createdAt: ago(24, 15) });
    listing('ls_powerbank', 'rental', 'tech', 'u_migs', 'Powerbank 20,000 mAh (fast charge)',
      'Fully charged when you get it. USB-C and USB-A cables included.',
      { rent: perDay(15), value: 1200, spot: 'Canteen', createdAt: ago(14, 12) });
    listing('ls_minitripod', 'rental', 'tech', 'u_mika', 'Mini tripod + Bluetooth remote',
      'Tabletop tripod for selfie videos and online reports.',
      { rent: perDay(25), value: 600, spot: 'Library entrance', createdAt: ago(9, 10) });
    // Rentals: rain gear
    listing('ls_umbrella_navy', 'rental', 'rain', 'u_kyla', 'Automatic umbrella (navy, big canopy)',
      'Opens with one button. Fits two people if you squeeze.',
      { rent: perDay(15), value: 450, spot: 'Library entrance', createdAt: ago(35, 8) });
    listing('ls_umbrella_golf', 'rental', 'rain', 'u_mika', 'Golf umbrella (extra large)',
      'For heavy downpours. Keeps your laptop bag dry.',
      { rent: perDay(15), value: 600, spot: 'Main Gate', createdAt: ago(11, 8) });
    listing('ls_umbrella_pink', 'rental', 'rain', 'u_trish', 'Compact folding umbrella (pink)',
      'Light enough for any bag.',
      { rent: perDay(15), value: 300, spot: 'Canteen', createdAt: ago(7, 9) });
    listing('ls_raincoat', 'rental', 'rain', 'u_kyla', 'Raincoat poncho (free size)',
      'Covers you and your backpack.',
      { rent: perDay(15), value: 350, spot: 'Library entrance', createdAt: ago(35, 8) });

    // Academic: reviewers, notes, guides, books
    const digital = (buy, rent7, pages) => ({ format: 'digital', buy, rent: rent7 ? { price: rent7, per: '7 days' } : null, pages });
    listing('ac_fa1', 'academic', 'reviewer', 'u_rica', 'FA1 Midterm Reviewer — Financial Accounting 1',
      'Summary of the accounting cycle, adjusting entries and worksheets, with 40 practice problems and answers I solved myself.',
      Object.assign(digital(45, 20, 18), { subject: 'Financial Accounting 1', createdAt: ago(10, 20) }));
    listing('ac_mktg', 'academic', 'reviewer', 'u_bea', 'Principles of Marketing Finals Reviewer',
      'The 4Ps, STP and consumer decision process in one-page summaries, plus sample essay answers.',
      Object.assign(digital(40, 20, 14), { subject: 'Principles of Marketing', createdAt: ago(30, 19) }));
    listing('ac_stats', 'academic', 'reviewer', 'u_rica', 'Business Statistics Reviewer with worked problems',
      'Hypothesis testing, regression and probability, each with a worked example.',
      Object.assign(digital(50, 25, 22), { subject: 'Business Statistics', createdAt: ago(26, 21) }));
    listing('ac_anaphy', 'academic', 'reviewer', 'u_kyla', 'Anatomy & Physiology Prelim Reviewer',
      'Body systems tables and mnemonics that helped me ace prelims.',
      Object.assign(digital(45, 20, 20), { subject: 'Anatomy & Physiology', createdAt: ago(15, 20) }));
    listing('ac_calc1', 'academic', 'reviewer', 'u_enzo', 'Calculus 1 Reviewer: limits to derivatives',
      'Step-by-step solutions and a formula sheet.',
      Object.assign(digital(40, null, 16), { subject: 'Calculus 1', createdAt: ago(13, 18) }));
    listing('ac_genchem', 'academic', 'reviewer', 'u_kyla', 'General Chemistry Reviewer (printed & bound)',
      'Printed, ring-bound copy with color-coded tables. Pick up at the Library entrance.',
      { format: 'printed', buy: 70, pages: 24, subject: 'General Chemistry', createdAt: ago(12, 17) });
    listing('ac_rph', 'academic', 'reviewer', 'u_lara', 'Readings in Philippine History Reviewer',
      'Primary sources, key dates and possible essay questions.',
      Object.assign(digital(35, null, 12), { subject: 'Readings in Philippine History', createdAt: ago(8, 19) }));
    listing('ac_conbeh', 'academic', 'notes', 'u_nico', 'Consumer Behavior lecture notes (complete, typed)',
      'Typed notes for the whole semester, organized by topic.',
      Object.assign(digital(30, 15, 26), { subject: 'Consumer Behavior', createdAt: ago(5, 21) }));
    listing('ac_purcom', 'academic', 'notes', 'u_lara', 'Purposive Communication notes',
      'Clean notes with examples for each writing style.',
      Object.assign(digital(30, null, 18), { subject: 'Purposive Communication', createdAt: ago(9, 20) }));
    listing('ac_micro', 'academic', 'notes', 'u_rica', 'Microeconomics handwritten notes (printed copy)',
      'Photocopy of my own handwritten notes with graphs.',
      { format: 'printed', buy: 50, pages: 30, subject: 'Microeconomics', createdAt: ago(20, 16) });
    listing('ac_costacc', 'academic', 'guide', 'u_rica', 'Cost Accounting study guide (board-exam style)',
      'Topic outlines and 60 multiple-choice questions with explanations.',
      Object.assign(digital(60, 25, 40), { subject: 'Cost Accounting', createdAt: ago(18, 20) }));
    listing('ac_bk_mktg', 'academic', 'book', 'u_lara', 'Principles of Marketing textbook (secondhand)',
      'Some highlights, no missing pages.',
      { format: 'book', rent: { price: 50, per: 'week' }, buy: 350, deposit: 300, value: 1400, condition: 'Good', subject: 'Principles of Marketing', createdAt: ago(23, 15) });
    listing('ac_bk_labman', 'academic', 'book', 'u_kyla', 'General Chemistry lab manual (used)',
      'Clean copy; answers not written in.',
      { format: 'book', buy: 150, condition: 'Very good', subject: 'General Chemistry', createdAt: ago(21, 14) });
    listing('ac_bk_psych', 'academic', 'book', 'u_mika', 'Introduction to Psychology textbook',
      'Latest edition used in our class. Borrow it for the week before exams.',
      { format: 'book', rent: { price: 50, per: 'week' }, deposit: 300, value: 1600, condition: 'Very good', subject: 'Introduction to Psychology', spot: 'Main Gate', createdAt: ago(16, 12) });

    // ---- Orders -------------------------------------------------------------
    const orders = {};
    function order(id, kind, requesterId, providerId, status, extra) {
      const o = Object.assign({
        id, kind, requesterId, providerId, listingId: null,
        status, statusAt: 0, createdAt: 0,
        errand: null, rental: null, purchase: null,
        money: { fee: 0, rush: 0, items: 0, deposit: 0, service: 5, total: 0, method: 'gcash', state: 'held' },
        code: '', returnCode: '', timeline: [], chat: [],
        rated: { requester: false, provider: false }, ticketId: null,
      }, extra || {});
      const m = o.money;
      m.total = m.fee + m.rush + m.items + m.deposit + m.service;
      if (!o.statusAt) o.statusAt = o.timeline.length ? o.timeline[o.timeline.length - 1].at : o.createdAt;
      orders[id] = o;
      return o;
    }
    const tl = (pairs) => pairs.map(([status, at, note]) => ({ status, at, note: note || '' }));

    // Open errand jobs from other students (what a go-runner sees).
    const job = (id, requesterId, type, title, details, from, to, fee, items, minsAgo, dueIn, method) => order(id, 'errand', requesterId, null, 'open', {
      createdAt: now - minsAgo * MIN,
      errand: { type, title, details, from, to, neededBy: now + dueIn * MIN, rush: false, budget: items, actual: null },
      money: { fee, rush: 0, items, deposit: 0, service: 5, total: 0, method: method || 'gcash', state: method === 'cash' ? 'due' : 'held' },
      code: String(3600 + (id.charCodeAt(id.length - 1) % 10) * 7 + 15),
      timeline: tl([['open', now - minsAgo * MIN, 'Posted']]),
    });
    job('GPH-10501', 'u_trish', 'food', '2 siomai rice + 2 iced tea', { items: '2 siomai rice, 2 iced tea (less ice). No onions please!' },
      'Food stalls outside Back Gate', 'Room 311', 25, 180, 6, 40);
    job('GPH-10502', 'u_gab', 'print', 'Print Thesis_Ch2_revised.pdf', { file: 'Thesis_Ch2_revised.pdf', pages: 32, copies: 1, color: 'bw', size: 'Short', staple: true },
      'Print shop near Main Gate', 'Computer lab', 20, 64, 12, 60);
    job('GPH-10503', 'u_ivan', 'print', 'Print Case_Study_Final.pdf (color)', { file: 'Case_Study_Final.pdf', pages: 12, copies: 1, color: 'color', size: 'A4', staple: false },
      'Print shop near Main Gate', 'Library 2nd floor', 20, 60, 18, 90, 'cash');
    job('GPH-10504', 'u_lara', 'fetch', 'Get my ID from the Admin office window', { item: 'School ID (claim stub is with the guard)', contact: 'Ms. Reyes at the window' },
      'Admin office window', 'Canteen', 25, 0, 20, 75);
    job('GPH-10505', 'u_kyla', 'deliver', 'Bring my lab gown to the Science lab', { item: 'Lab gown in a white paper bag', bulky: false },
      'Main Gate', 'Science lab', 25, 0, 25, 50);
    job('GPH-10506', 'u_rica', 'medicine', 'Paracetamol + throat lozenges', { items: 'Paracetamol 500 mg (1 strip), throat lozenges (1 pack)' },
      'Pharmacy near Main Gate', 'Library entrance', 30, 80, 9, 45);
    job('GPH-10507', 'u_enzo', 'supplies', '2 blue books + 1 long folder', { items: '2 blue books, 1 long plastic folder (blue)' },
      'School supplies store near campus', 'Room 412', 25, 60, 15, 80);

    // History (finished orders) — give profiles and Activity some life.
    function doneErrand(id, requesterId, providerId, type, title, details, from, to, fee, items, daysAgo, hh) {
      const t0 = ago(daysAgo, hh, 5);
      return order(id, 'errand', requesterId, providerId, 'completed', {
        createdAt: t0,
        errand: { type, title, details, from, to, neededBy: t0 + 60 * MIN, rush: false, budget: items, actual: items },
        money: { fee, rush: 0, items, deposit: 0, service: 5, total: 0, method: 'gcash', state: 'released' },
        code: '4406',
        timeline: tl([['open', t0, 'Posted'], ['accepted', t0 + 3 * MIN], ['bought', t0 + 18 * MIN, 'Receipt ₱' + items],
          ['on_the_way', t0 + 22 * MIN], ['completed', t0 + 31 * MIN, 'Hand-off code confirmed']]),
        rated: { requester: true, provider: true },
      });
    }
    doneErrand('GPH-10482', 'u_bea', 'u_mika', 'print', 'Print Marketing_Report_v3.pdf', { file: 'Marketing_Report_v3.pdf', pages: 15, copies: 2, color: 'bw', size: 'Short', staple: true },
      'Print shop near Main Gate', 'Room 204', 20, 60, 3, 9);
    doneErrand('GPH-10486', 'u_gab', 'u_migs', 'print', 'Print Lab_Report_4.pdf', { file: 'Lab_Report_4.pdf', pages: 32, copies: 1, color: 'bw', size: 'Short', staple: true },
      'Print shop near Main Gate', 'Computer lab', 20, 64, 2, 13);
    doneErrand('GPH-10478', 'u_trish', 'u_migs', 'food', 'Pancit canton + buko juice', { items: '1 pancit canton, 1 buko juice' },
      'Food stalls outside Back Gate', 'Room 311', 25, 95, 4, 12);
    doneErrand('GPH-10471', 'u_bea', 'u_migs', 'food', 'Chicken rice meal + iced coffee', { items: '1 chicken rice meal, 1 iced coffee' },
      'Food stalls outside Back Gate', 'Student lounge', 25, 120, 6, 12);
    doneErrand('GPH-10466', 'u_bea', 'u_migs', 'print', 'Print Org_Proposal.pdf', { file: 'Org_Proposal.pdf', pages: 8, copies: 3, color: 'bw', size: 'Long', staple: true },
      'Print shop near Main Gate', 'Student lounge', 20, 48, 10, 15);
    doneErrand('GPH-10462', 'u_ivan', 'u_migs', 'fetch', 'Get my calculator from Room 412', { item: 'Black Casio calculator on the 2nd row desk' },
      'Room 412', 'Library entrance', 25, 0, 9, 10);
    doneErrand('GPH-10444', 'u_bea', 'u_mika', 'medicine', 'Antacid + tissue', { items: 'Antacid (1 strip), pocket tissue' },
      'Pharmacy near Main Gate', 'Room 204', 30, 55, 20, 14);

    function doneRental(id, listingId, renterId, lenderId, price, days, daysAgo) {
      const t0 = ago(daysAgo, 8, 20);
      return order(id, 'rental', renterId, lenderId, 'completed', {
        listingId, createdAt: t0,
        rental: { start: t0 + 20 * MIN, days, returnBy: t0 + days * DAY },
        money: { fee: price * days, rush: 0, items: 0, deposit: 0, service: 5, total: 0, method: 'gcash', state: 'released' },
        code: '7302', returnCode: '5190',
        timeline: tl([['requested', t0], ['confirmed', t0 + 6 * MIN], ['in_use', t0 + 20 * MIN],
          ['returned', t0 + 9 * HOUR], ['completed', t0 + 9 * HOUR + 10 * MIN, 'Returned in good condition']]),
        rated: { requester: true, provider: true },
      });
    }
    doneRental('GPH-10458', 'ls_umbrella_navy', 'u_bea', 'u_kyla', 15, 1, 12);
    doneRental('GPH-10470', 'ls_powerbank', 'u_lara', 'u_migs', 15, 1, 7);

    function doneDigital(id, listingId, buyerId, sellerId, price, daysAgo, hh) {
      const t0 = ago(daysAgo, hh, 40);
      return order(id, 'purchase', buyerId, sellerId, 'unlocked', {
        listingId, createdAt: t0,
        purchase: { format: 'digital', access: 'keep', expiresAt: null },
        money: { fee: price, rush: 0, items: 0, deposit: 0, service: 5, total: 0, method: 'gcash', state: 'released' },
        timeline: tl([['unlocked', t0, 'Paid with GCash · access unlocked']]),
        rated: { requester: true, provider: true },
      });
    }
    doneDigital('GPH-10450', 'ac_stats', 'u_bea', 'u_rica', 50, 14, 20);
    doneDigital('GPH-10460', 'ac_mktg', 'u_ivan', 'u_bea', 40, 11, 21);
    doneDigital('GPH-10475', 'ac_mktg', 'u_trish', 'u_bea', 40, 5, 19);

    // Active: Bea is borrowing Kyla's umbrella today.
    order('GPH-10490', 'rental', 'u_bea', 'u_kyla', 'in_use', {
      listingId: 'ls_umbrella_navy', createdAt: now - 3 * HOUR,
      rental: { start: now - 2.5 * HOUR, days: 1, returnBy: now + 5 * HOUR },
      money: { fee: 15, rush: 0, items: 0, deposit: 0, service: 5, total: 0, method: 'gcash', state: 'held' },
      code: '2718', returnCode: '6043',
      timeline: tl([['requested', now - 3 * HOUR], ['confirmed', now - 3 * HOUR + 4 * MIN, 'Meet at Library entrance'],
        ['in_use', now - 2.5 * HOUR, 'Picked up']]),
      chat: [
        { id: 'm_seed_1', from: 'u_kyla', text: 'Hi Bea! The umbrella is on the Library entrance shelf, yellow tag 🙂', at: now - 3 * HOUR + 5 * MIN },
        { id: 'm_seed_2', from: 'u_bea', text: 'Got it, thank you!', at: now - 2.5 * HOUR },
        { id: 'm_seed_3', from: 'u_kyla', text: 'Sige! Just return it at the Library entrance later.', at: now - 2.5 * HOUR + MIN },
      ],
    });
    orders['GPH-10482'].chat = [
      { id: 'm_seed_4', from: 'u_mika', text: 'Printing now — 2 copies, stapled ✔️', at: orders['GPH-10482'].createdAt + 12 * MIN },
      { id: 'm_seed_5', from: 'u_bea', text: 'Thank you!!', at: orders['GPH-10482'].createdAt + 13 * MIN },
    ];

    // ---- Reviews -----------------------------------------------------------------
    const reviews = [];
    let rv = 0;
    function review(orderId, fromId, toId, role, stars, text, at, listingId, tags) {
      reviews.push({ id: 'rv_' + (++rv), orderId, fromId, toId, role, stars, text, tags: tags || [], at, listingId: listingId || null });
    }
    review('GPH-10482', 'u_bea', 'u_mika', 'provider', 5, 'Super fast — printed and stapled before my 10:30 class!', ago(3, 9, 40), null, ['On time', 'Receipt included']);
    review('GPH-10486', 'u_gab', 'u_migs', 'provider', 5, 'On time, receipt included. Will book again.', ago(2, 13, 40), null, ['On time']);
    review('GPH-10478', 'u_trish', 'u_migs', 'provider', 5, 'No onions, as requested 😄 Salamat!', ago(4, 12, 45));
    review('GPH-10471', 'u_bea', 'u_migs', 'provider', 4, 'Food was still warm. The line was long but he kept me updated.', ago(6, 12, 50), null, ['Kept me updated']);
    review('GPH-10466', 'u_bea', 'u_migs', 'provider', 5, 'Kept me updated the whole time. Long bond paper, stapled.', ago(10, 15, 40));
    review('GPH-10462', 'u_ivan', 'u_migs', 'provider', 4, 'Took a while but kept me updated.', ago(9, 10, 50));
    review('GPH-10444', 'u_bea', 'u_mika', 'provider', 5, 'Life saver when I was sick in class.', ago(20, 14, 45));
    review('GPH-10458', 'u_bea', 'u_kyla', 'provider', 5, 'Umbrella saved me during the downpour!', ago(12, 17, 40), 'ls_umbrella_navy', ['Easy meetup']);
    review('GPH-10470', 'u_lara', 'u_migs', 'provider', 5, 'Fully charged, cables included. Thanks!', ago(7, 17, 50), 'ls_powerbank');
    review('GPH-10450', 'u_bea', 'u_rica', 'provider', 5, 'Clear and well-organized. Helped me pass the long exam!', ago(13, 21), 'ac_stats');
    review('GPH-10460', 'u_ivan', 'u_bea', 'provider', 4, 'Nice summaries of the 4Ps and STP.', ago(10, 20), 'ac_mktg');
    review('GPH-10475', 'u_trish', 'u_bea', 'provider', 5, 'Worth it — complete and neat.', ago(4, 21), 'ac_mktg');
    // Ratings the requesters received back
    review('GPH-10482', 'u_mika', 'u_bea', 'requester', 5, 'Clear instructions and quick to answer.', ago(3, 9, 42));
    review('GPH-10486', 'u_migs', 'u_gab', 'requester', 5, 'Easy hand-off at the lab.', ago(2, 13, 42));
    // Extra reviews for established lenders/sellers/runners (from older bookings)
    const older = [
      ['u_mika', 'u_trish', 5, 'Friendly and on time. Brought exact change.', 'provider', null],
      ['u_mika', 'u_gab', 5, 'Printed in color exactly as asked.', 'provider', null],
      ['u_joaquin', 'u_ivan', 5, 'Camera was complete and clean. Explained the settings too.', 'provider', 'ls_camera'],
      ['u_joaquin', 'u_trish', 4, 'Ring light worked great for our org video.', 'provider', 'ls_ringlight'],
      ['u_joaquin', 'u_gab', 5, 'Lapel mics made our interview audio so clear.', 'provider', 'ls_lapelmic'],
      ['u_kyla', 'u_ivan', 5, 'Lab gown was clean and ironed.', 'provider', 'ls_labgown'],
      ['u_kyla', 'u_gab', 5, 'Easy meetup at the Library entrance.', 'provider', 'ls_calc82'],
      ['u_enzo', 'u_lara', 5, 'Calculator works perfectly, batteries included.', 'provider', 'ls_calc991'],
      ['u_enzo', 'u_trish', 4, 'Drafting set was complete. Slightly late meetup.', 'provider', 'ls_drafting'],
      ['u_rica', 'u_ivan', 5, 'Best FA1 reviewer out there. The practice problems are gold.', 'provider', 'ac_fa1'],
      ['u_rica', 'u_trish', 5, 'Reviewer helped me pass the midterm!', 'provider', 'ac_fa1'],
      ['u_rica', 'u_gab', 4, 'Good guide. A few typos but the explanations are clear.', 'provider', 'ac_costacc'],
      ['u_lara', 'u_ivan', 5, 'Book was in good shape, easy pickup.', 'provider', 'ac_bk_mktg'],
      ['u_lara', 'u_trish', 4, 'Notes were complete. Some pages were a bit crowded.', 'provider', 'ac_purcom'],
      ['u_migs', 'u_kyla', 5, 'Tripod was clean and complete.', 'provider', 'ls_tripod'],
      ['u_migs', 'u_ivan', 5, 'Brought the remote even though I forgot to ask.', 'provider', 'ls_tripod'],
    ];
    older.forEach((r, i) => review('seed-' + i, r[1], r[0], r[4], r[2], r[3], ago(15 + i, 11 + (i % 7), 10), r[5]));

    // ---- Wallets --------------------------------------------------------------------
    function wallet(uid, lines) {
      let bal = 0;
      const tx = lines.map(([label, amount, days, orderId], i) => {
        bal += amount;
        return { id: 'tx_' + uid + '_' + i, label, amount, at: ago(days, 17, 30), orderId: orderId || null };
      }).reverse();
      users[uid].wallet = { available: bal, tx };
    }
    wallet('u_migs', [
      ['Earnings before this month', 1296, 30],
      ['Cashed out to GCash', -500, 12],
      ['Errand fee · GPH-10466', 20, 10, 'GPH-10466'], ['Reimbursed printing · GPH-10466', 48, 10, 'GPH-10466'],
      ['Errand fee · GPH-10462', 25, 9, 'GPH-10462'],
      ['Rental · GPH-10470', 15, 7, 'GPH-10470'],
      ['Errand fee · GPH-10471', 25, 6, 'GPH-10471'], ['Reimbursed food · GPH-10471', 120, 6, 'GPH-10471'],
      ['Errand fee · GPH-10478', 25, 4, 'GPH-10478'], ['Reimbursed food · GPH-10478', 95, 4, 'GPH-10478'],
      ['Cashed out to GCash', -400, 3],
      ['Errand fee · GPH-10486', 20, 2, 'GPH-10486'], ['Reimbursed printing · GPH-10486', 64, 2, 'GPH-10486'],
    ]);
    wallet('u_bea', [['Sale · GPH-10460', 40, 11, 'GPH-10460'], ['Sale · GPH-10475', 40, 5, 'GPH-10475']]);
    wallet('u_mika', [['Earnings before this month', 1860, 30]]);
    wallet('u_kyla', [['Earnings before this month', 540, 30]]);
    wallet('u_rica', [['Earnings before this month', 1120, 30]]);

    // ---- Notifications ------------------------------------------------------------------
    let nt = 0;
    const notifs = [];
    const notif = (userId, text, href, at, read) => notifs.push({ id: 'nt_' + (++nt), userId, text, href, at, read: !!read });
    notif('u_bea', 'New midterm reviewers are up in Accountancy.', '#/explore?tab=notes&cat=reviewer', ago(1, 18), true);
    notif('u_bea', 'Kyla: “Sige! Just return it at the Library entrance later.”', '#/order/GPH-10490', now - 2.5 * HOUR + MIN, false);
    notif('u_bea', 'Return Kyla’s umbrella by ' + new Date(now + 5 * HOUR).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) + ' today.', '#/order/GPH-10490', now - 20 * MIN, false);
    notif('u_migs', 'You earned ₱20 + ₱64 reimbursed from GPH-10486.', '#/wallet', ago(2, 13, 40), true);
    notif('u_migs', '7 errand jobs are open near you. Go online to take one.', '#/explore?tab=jobs', now - 5 * MIN, false);

    return {
      v: G.config.VERSION,
      seq: 10510,
      seed: 20260925,
      createdAt: now,
      meId: null,
      settings: { sim: 'auto' },
      users, listings, orders, reviews, notifs,
      tickets: {}, drafts: {},
    };
  }

  G.seed = seed;
})(window.Gopher = window.Gopher || {});
