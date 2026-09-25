/* Gopher — settings the group may want to change: prices, fees, categories,
 * campus spots, order statuses. Prices are PILOT PLACEHOLDERS until the group's
 * November pricing work; change them here and the whole demo follows.
 */
(function (G) {
  'use strict';

  const config = {
    STORAGE_KEY: 'gopher.demo.v1',
    VERSION: 2, // bump when the data shape changes; old saved demo data is then replaced by fresh sample data

    // ---- Money --------------------------------------------------------------
    SERVICE_FEE: 5,          // ₱ per booking, paid by the requester/renter/buyer. How Gopher earns.
    COMMISSION: 0,           // share of the provider's fee Gopher keeps (0 = go-runners and lenders keep 100%)
    RUSH_FEE: 10,            // errand wanted within 30 minutes
    ERRAND_CANCEL_FEE: 10,   // goes to the go-runner if the requester cancels after they accepted
    CASH_MAX: 200,           // cash on hand-off only up to this total, with no deposit and not digital
    ITEM_BUDGET_MAX: 500,    // pilot cap on what a go-runner buys for you
    PRINT_COST: { bw: 2, color: 5 }, // ₱ per page, passed through at cost
    PAYMENT_METHODS: ['gcash', 'cash'], // remove 'cash' to make Gopher digital-only
    PAYMENT_LABELS: { gcash: 'GCash', cash: 'Cash on hand-off' },

    // ---- Links (empty = demo form that sends nothing) ----------------------
    WAITLIST_URL: '',
    FEEDBACK_URL: '',
    SUPPORT_EMAIL: 'support@gopher.example',

    // ---- Schools -------------------------------------------------------------
    SCHOOLS: [
      { id: 'adnu', name: 'Ateneo de Naga University', short: 'ADNU', open: true },
      { id: 'unc', name: 'University of Nueva Caceres', short: 'UNC', open: false },
      { id: 'usi', name: 'Universidad de Sta. Isabel', short: 'USI', open: false },
      { id: 'ncf', name: 'Naga College Foundation', short: 'NCF', open: false },
    ],
    YEAR_LEVELS: ['1st year', '2nd year', '3rd year', '4th year', '5th year'],

    // How students prove they're currently enrolled. The photo is only used for the
    // check (in the demo it never leaves the device and isn't saved).
    VERIFY_METHODS: {
      id: { label: 'Student ID', short: 'student ID', hint: 'A clear photo of the front of your current school ID.' },
      matriculation: { label: 'Matriculation form', short: 'matriculation form', hint: 'Your matriculation (enrollment) form for this semester.' },
    },

    // ---- Places (generic on purpose) ------------------------------------------
    SPOTS: {
      campus: ['Main Gate', 'Back Gate', 'Library entrance', 'Library 2nd floor', 'Canteen', 'Student lounge',
        'Gym', 'Covered court', 'Computer lab', 'Science lab', 'Admin office window', 'Room 204', 'Room 311', 'Room 412'],
      near: ['Print shop near Main Gate', 'Pharmacy near Main Gate', 'Food stalls outside Back Gate',
        'Convenience store near campus', 'School supplies store near campus'],
      meetup: ['Main Gate', 'Library entrance', 'Canteen', 'Student lounge'],
    },

    // ---- Errands ---------------------------------------------------------------
    // fee = suggested errand fee (paid to the go-runner). doneLabel = status after the buy/print step.
    ERRAND_TYPES: {
      print: { label: 'Print & photocopy', short: 'Printing', icon: 'printer', fee: 20, doneLabel: 'Printed', verb: 'Printed',
        blurb: 'Printed and brought to you' },
      food: { label: 'Food & drinks', short: 'Food run', icon: 'utensils', fee: 25, doneLabel: 'Bought', verb: 'Bought',
        blurb: 'Lunch, snacks, coffee' },
      fetch: { label: 'Get an item', short: 'Get an item', icon: 'package', fee: 25, doneLabel: 'Picked up', verb: 'Picked up',
        blurb: 'Fetch what you forgot' },
      deliver: { label: 'Deliver / pick up', short: 'Delivery', icon: 'bike', fee: 25, doneLabel: 'Picked up', verb: 'Picked up',
        blurb: 'Bring something across campus' },
      supplies: { label: 'School supplies', short: 'Supplies run', icon: 'pencil-ruler', fee: 25, doneLabel: 'Bought', verb: 'Bought',
        blurb: 'Blue books, folders, pens' },
      medicine: { label: 'Medicine & personal', short: 'Pharmacy run', icon: 'pill', fee: 30, doneLabel: 'Bought', verb: 'Bought',
        blurb: 'Over-the-counter only' },
    },
    ERRAND_ORDER: ['print', 'food', 'fetch', 'deliver', 'supplies', 'medicine'], // survey order: printing first
    NOT_ALLOWED: ['Alcohol, tobacco and vapes', 'Prescription-only medicine', 'Anything illegal or dangerous',
      'Taking quizzes or exams, doing graded work, or signing attendance for someone'],

    // ---- Listings --------------------------------------------------------------
    RENTAL_CATS: {
      calc: { label: 'Calculators', icon: 'calculator' },
      supplies: { label: 'School supplies', icon: 'pencil-ruler' },
      tech: { label: 'Tech & vlogging', icon: 'camera' },
      rain: { label: 'Rain gear', icon: 'umbrella' },
    },
    ACADEMIC_CATS: {
      reviewer: { label: 'Reviewers', icon: 'file-text' },
      notes: { label: 'Lecture notes', icon: 'notebook-pen' },
      guide: { label: 'Study guides', icon: 'graduation-cap' },
      book: { label: 'Books', icon: 'book-open' },
    },
    // Suggested daily rates shown on the "List an item" form.
    RATE_HINTS: { calc: [15, 30], supplies: [10, 20], tech: [40, 300], rain: [10, 15] },
    DEPOSIT_RULE: 'Items worth ₱1,000 or more need a refundable deposit (about 20% of their value).',

    // ---- Order statuses ----------------------------------------------------------
    // tone: info | ok | warn | gray. who: whose move it is next (requester | provider | null).
    STATUS: {
      errand: {
        open: { label: 'Finding a go-runner', tone: 'warn', who: 'provider' },
        accepted: { label: 'Go-runner on it', tone: 'info', who: 'provider' },
        bought: { label: 'Bought', tone: 'info', who: 'provider' }, // label swapped per errand type
        on_the_way: { label: 'On the way', tone: 'info', who: 'provider' },
        completed: { label: 'Delivered', tone: 'ok', who: null },
        cancelled: { label: 'Cancelled', tone: 'gray', who: null },
      },
      rental: {
        requested: { label: 'Request sent', tone: 'warn', who: 'provider' },
        confirmed: { label: 'Confirmed', tone: 'info', who: 'provider' },
        in_use: { label: 'In use', tone: 'info', who: 'requester' },
        returned: { label: 'Returned · checking', tone: 'info', who: 'provider' },
        completed: { label: 'Completed', tone: 'ok', who: null },
        declined: { label: 'Declined', tone: 'gray', who: null },
        cancelled: { label: 'Cancelled', tone: 'gray', who: null },
      },
      purchase: {
        requested: { label: 'Order sent', tone: 'warn', who: 'provider' },
        confirmed: { label: 'Meetup confirmed', tone: 'info', who: 'provider' },
        completed: { label: 'Completed', tone: 'ok', who: null },
        unlocked: { label: 'Unlocked', tone: 'ok', who: null },
        declined: { label: 'Declined', tone: 'gray', who: null },
        cancelled: { label: 'Cancelled', tone: 'gray', who: null },
      },
    },

    // Allowed moves: kind → action → { from: [...statuses], to, by }.
    // store.act() refuses anything not listed here.
    FLOW: {
      errand: {
        accept: { from: ['open'], to: 'accepted', by: 'provider' },
        buy: { from: ['accepted'], to: 'bought', by: 'provider' },
        depart: { from: ['bought'], to: 'on_the_way', by: 'provider' },
        deliver: { from: ['on_the_way'], to: 'completed', by: 'provider', code: 'code' },
        cancel: { from: ['open', 'accepted'], to: 'cancelled', by: 'requester' },
      },
      rental: {
        confirm: { from: ['requested'], to: 'confirmed', by: 'provider' },
        decline: { from: ['requested'], to: 'declined', by: 'provider' },
        handover: { from: ['confirmed'], to: 'in_use', by: 'provider', code: 'code' },
        return: { from: ['in_use'], to: 'returned', by: 'requester', code: 'returnCode' },
        close: { from: ['returned'], to: 'completed', by: 'provider' },
        cancel: { from: ['requested', 'confirmed'], to: 'cancelled', by: 'requester' },
      },
      purchase: {
        confirm: { from: ['requested'], to: 'confirmed', by: 'provider' },
        decline: { from: ['requested'], to: 'declined', by: 'provider' },
        handover: { from: ['confirmed'], to: 'completed', by: 'provider', code: 'code' },
        cancel: { from: ['requested'], to: 'cancelled', by: 'requester' },
      },
    },

    // ---- Simulation (ms) -----------------------------------------------------------
    SIM: {
      accept: 5000,       // a go-runner accepts your errand
      step: 7000,         // each errand step after that
      confirm: 6000,      // a lender/seller confirms
      close: 5000,        // lender checks a returned item
      reply: 2200,        // chat auto-reply (always automatic)
      code: 1800,         // the other student posts their hand-off code in chat
      rate: 3500,         // the other student rates you
      review: 5000,       // an academic listing clears review
      request: 8000,      // someone requests the item you just listed
      support: 6000,      // support answers a report
      verify: 6000,       // Gopher's team checks a new student's ID / matriculation
    },
  };

  G.config = config;
})(window.Gopher = window.Gopher || {});
