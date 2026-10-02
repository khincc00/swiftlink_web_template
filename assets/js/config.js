/*
  =====================================================================
  SwiftLink site configuration  (window.SWIFTLINK)
  =====================================================================
  Every price, vehicle, region, holiday and demo tracking record used by
  the site's interactive tools lives here, so the business data can be
  updated without touching page code. Loaded on every page BEFORE
  main.js (see <head> in _tools/build.py).

  Who reads what:
    company ........ main.js (contact form errors), quote.js, track.js
    dispatch ....... main.js  → utility-bar "Dispatch online" status
    forms .......... main.js  (contact form), quote.js (quote wizard)
    regions ........ main.js  → coverage map, region selects; pricing
    regionFactor ... main.js  → SL.calc() cross-region distance multiplier
    vehicles ....... main.js  → fleet grid, vehicle matcher, rates table; pricing
    services ....... main.js + quote.js → which vehicles / rules per service
    storage ........ main.js  → warehouse pricing
    addons ......... quote.js → step 4 extras; main.js → rates table
    surcharges ..... main.js  → SL.calc(), rates table
    publicHolidays . main.js  → SL.isHoliday(); quote.js auto-ticks the holiday box
    spread ......... main.js  → the "S$X – Y" range shown around a price
    shipments ...... track.js → DEMO tracking records

  IMPORTANT: the values below are SAMPLE data written for the template.
  Confirm every rate, surcharge and minimum with operations before launch.
*/
window.SWIFTLINK = {
  /* Contact details used by JavaScript. Keep in sync with COMPANY in _tools/build.py. */
  company: {
    phone: '+65 6777 4599',     // display format
    tel: '+6567774599',         // tel: link format
    whatsapp: '6567774599',     // wa.me format; replace with the dispatch MOBILE number used for WhatsApp
    email: 'enquiry@swiftlink.com.sg'
  },

  /*
    Dispatch opening hours (Singapore time), used for the status in the top bar.
      hours: null                       → always "Dispatch online" (24/7 operation)
      hours: { open: '08:00', close: '20:00', days: [1, 2, 3, 4, 5, 6] }
                                        → online only inside those hours;
                                          days use 0 = Sunday … 6 = Saturday
  */
  dispatch: {
    hours: null,
    onlineText: 'Dispatch online',
    offlineText: 'Dispatch closed · leave a message'
  },

  /*
    Form endpoints. Leave empty to fall back to opening the visitor's email
    app (mailto:). Set a URL to submit in the background, e.g. a Formspree,
    Web3Forms, Getform or your own API endpoint that accepts a POST with
    multipart/form-data and returns a 2xx status.
      contact: 'https://formspree.io/f/xxxxxxx'
      quote:   'https://formspree.io/f/yyyyyyy'
  */
  forms: {
    contact: '',
    quote: ''
  },

  currency: 'S$',

  /*
    Planning regions (URA). Keys must match data-region="" on the map paths
    in _src/sgmap.svg.
      eta   = typical dispatch-to-pickup time for urgent jobs
      hub   = which base covers the region
      areas = neighbourhoods listed under the map
  */
  regions: {
    central:   { name: 'Central',    eta: '30–45 min', hub: 'Main dispatch hub', areas: ['CBD & Marina Bay', 'Orchard', 'Bukit Merah', 'Toa Payoh', 'Novena', 'Queenstown'] },
    west:      { name: 'West',       eta: '20–35 min', hub: 'Registered office & warehouse', areas: ['Jurong East & West', 'Tuas', 'Boon Lay', 'Clementi', 'Bukit Batok', 'Choa Chu Kang'] },
    north:     { name: 'North',      eta: '40–55 min', hub: 'Covered from Central hub', areas: ['Woodlands', 'Yishun', 'Sembawang', 'Mandai', 'Kranji'] },
    northeast: { name: 'North-East', eta: '35–50 min', hub: 'Covered from Central hub', areas: ['Ang Mo Kio', 'Serangoon', 'Hougang', 'Sengkang', 'Punggol', 'Seletar'] },
    east:      { name: 'East',       eta: '35–50 min', hub: 'Changi standby crew', areas: ['Changi & Airport', 'Tampines', 'Pasir Ris', 'Bedok', 'Paya Lebar', 'Loyang'] }
  },

  /*
    Distance factor between two regions (multiplies the base trip rate of
    goods vehicles). Same region = 1, neighbouring = 1.2, far apart = 1.45.
    Replace with a postal-code or km-based calculation if needed: SL.calc()
    only expects a number back.
  */
  regionFactor: function (from, to) {
    if (!from || !to) return 1;
    if (from === to) return 1;
    var far = { west: ['east', 'northeast'], east: ['west'], northeast: ['west'] };
    if ((far[from] || []).indexOf(to) > -1) return 1.45;
    return 1.2;
  },

  /*
    Vehicles. The order matters: the vehicle matcher picks the FIRST vehicle
    of a type that fits, so list each type from smallest to largest.
      type      goods | people
      icon      icon name from ICONS in _tools/build.py
      rate      base price per trip (goods) or per hour (people)
      unit      'trip' | 'hour'
      goods  →  capacity (label), payload, cbm (usable m³), pallets, dims
      people →  seats, luggage (a leading number is used by the matcher)
      bestFor   short description; the matcher uses the text before the first comma
  */
  vehicles: [
    { id: 'van',      type: 'goods',  name: 'Panel van',       icon: 'truck', rate: 55,  unit: 'trip', capacity: 'Up to 40 cartons', payload: '800 kg',  cbm: 4,  pallets: 1,  dims: '2.4 × 1.4 × 1.3 m', bestFor: 'Parcels, documents, small retail drops' },
    { id: 'lorry10',  type: 'goods',  name: '10 ft lorry',     icon: 'truck', rate: 90,  unit: 'trip', capacity: 'Up to 100 cartons', payload: '1,500 kg', cbm: 10, pallets: 4,  dims: '3.0 × 1.7 × 1.8 m', bestFor: 'Store restocks, studio moves' },
    { id: 'lorry14',  type: 'goods',  name: '14 ft lorry',     icon: 'truck', rate: 130, unit: 'trip', capacity: 'Up to 200 cartons', payload: '2,500 kg', cbm: 17, pallets: 6,  dims: '4.3 × 2.0 × 2.0 m', bestFor: 'Small office or 3-room HDB moves' },
    { id: 'lorry24',  type: 'goods',  name: '24 ft lorry',     icon: 'truck', rate: 210, unit: 'trip', capacity: 'Up to 400 cartons', payload: '5,000 kg', cbm: 35, pallets: 12, dims: '7.3 × 2.3 × 2.3 m', bestFor: 'Full office moves, event equipment' },
    { id: 'sedan',    type: 'people', name: 'Executive sedan', icon: 'car',   rate: 60,  unit: 'hour', seats: 3,  luggage: '2 large bags', bestFor: 'Directors, VIP and airport transfers' },
    { id: 'mpv',      type: 'people', name: 'Premium MPV',     icon: 'car',   rate: 75,  unit: 'hour', seats: 6,  luggage: '4 large bags', bestFor: 'Small teams, family transfers' },
    { id: 'minibus',  type: 'people', name: '13-seat minibus', icon: 'bus',   rate: 90,  unit: 'hour', seats: 13, luggage: '8 large bags', bestFor: 'Site visits, department outings' },
    { id: 'coach',    type: 'people', name: '40-seat coach',   icon: 'bus',   rate: 120, unit: 'hour', seats: 40, luggage: 'Full luggage hold', bestFor: 'Conferences, events, roadshows' }
  ],

  /*
    Service lines. Keys are used in URLs (quote.html?service=charter) and in
    the radio buttons of quote.html step 1.
      type      goods (priced per trip) | people (per hour) | storage (per pallet/week)
      vehicles  vehicle ids offered, in display order. For goods, the SECOND
                one is pre-selected (a mid-size lorry is the most common job).
      minHours  minimum billable hours for people services
  */
  services: {
    delivery:  { name: 'Goods delivery',    type: 'goods',  vehicles: ['van', 'lorry10', 'lorry14', 'lorry24'] },
    charter:   { name: 'Corporate charter', type: 'people', vehicles: ['minibus', 'coach', 'mpv'], minHours: 3 },
    transfer:  { name: 'Point-to-point',    type: 'people', vehicles: ['sedan', 'mpv'], minHours: 1 },
    warehouse: { name: 'Warehouse support', type: 'storage' }
  },

  /* Warehouse: price per pallet per week, handling per pallet (charged in AND out), minimum pallets. */
  storage: { perPalletWeek: 14, handlingPerPallet: 8, minPallets: 2 },

  /*
    Optional extras shown in quote step 4 and the rates table.
      price      flat price; for per:'person' the wizard books 2 people
      appliesTo  service types (goods | people | storage) that can pick it
  */
  addons: [
    { id: 'mover',     label: 'Extra mover',                 detail: 'Per person, per trip',               price: 35, per: 'person', appliesTo: ['goods'] },
    { id: 'tailgate',  label: 'Tail-lift vehicle',           detail: 'For heavy or palletised loads',      price: 30, appliesTo: ['goods'] },
    { id: 'wrap',      label: 'Wrapping & protection',       detail: 'Blankets, bubble wrap, corner guards', price: 25, appliesTo: ['goods'] },
    { id: 'insurance', label: 'Enhanced cargo cover',        detail: 'Up to S$20,000 declared value',      price: 20, appliesTo: ['goods', 'storage'] },
    { id: 'signage',   label: 'Meet & greet signage',        detail: 'Driver waits with a name board',     price: 15, appliesTo: ['people'] },
    { id: 'water',     label: 'Refreshments on board',       detail: 'Bottled water and wet towels',       price: 10, appliesTo: ['people'] }
  ],

  /* Surcharges as fractions of the base price (0.2 = +20%). They stack. */
  surcharges: {
    urgent: 0.2,       // same-day within 3 hours
    afterHours: 0.25,  // pickup between 22:00 and 07:00
    weekend: 0.15      // Sunday or public holiday
  },

  /*
    Singapore public holidays, 'YYYY-MM-DD': 'Name'. Used to apply the
    Sunday / public holiday surcharge automatically in the quote wizard.
    When a holiday falls on a Sunday, the following Monday is the day off,
    so it is listed as "(observed)".
    MAINTENANCE: add each new year's dates from the Ministry of Manpower
    (mom.gov.sg → Public holidays) when they are announced, and double-check
    the list below against that page before launch.
  */
  publicHolidays: {
    '2026-01-01': "New Year's Day",
    '2026-02-17': 'Chinese New Year',
    '2026-02-18': 'Chinese New Year',
    '2026-03-21': 'Hari Raya Puasa',
    '2026-04-03': 'Good Friday',
    '2026-05-01': 'Labour Day',
    '2026-05-27': 'Hari Raya Haji',
    '2026-05-31': 'Vesak Day',
    '2026-06-01': 'Vesak Day (observed)',
    '2026-08-09': 'National Day',
    '2026-08-10': 'National Day (observed)',
    '2026-11-08': 'Deepavali',
    '2026-11-09': 'Deepavali (observed)',
    '2026-12-25': 'Christmas Day'
  },

  /* Range shown to visitors around the calculated figure (0.12 = ±12%), rounded to S$5. */
  spread: 0.12,

  /*
    DEMO tracking records, keyed by booking number. Replace with a call to
    your dispatch system's API when it is available (see README → Shipment
    tracking, and lookup() in track.js).
      status    in-transit | delivered | scheduled  (labels/colours in track.js STATUS)
      progress  0 … 1, position of the vehicle on the route bar
      events    timeline rows; done:false rows are shown as upcoming
      pod       optional proof of delivery: { signedBy, photos }
  */
  shipments: {
    'SL-240918': {
      status: 'in-transit', service: 'Goods delivery', vehicle: '14 ft lorry', from: 'Jurong West (West)', to: 'Tampines Hub (East)',
      eta: 'Today, 15:40 – 16:10', items: '62 cartons · 1 pallet', driver: 'Ahmad R.', plate: 'GBK 4127 E', progress: 0.62,
      events: [
        { t: 'Today 13:05', title: 'Out for delivery', note: 'Left Jurong warehouse via AYE → PIE', done: true },
        { t: 'Today 12:40', title: 'Loaded and sealed', note: 'Seal no. 448210 · photos on file', done: true },
        { t: 'Today 11:55', title: 'Driver arrived at pickup', note: 'Jurong West Ave 2', done: true },
        { t: 'Today 09:10', title: 'Booking confirmed', note: 'Assigned to Ahmad R.', done: true },
        { t: 'ETA 15:40', title: 'Delivered', note: 'Proof of delivery with signature and photos', done: false }
      ]
    },
    'SL-240917': {
      status: 'delivered', service: 'Office move', vehicle: '24 ft lorry × 2', from: 'Raffles Place (Central)', to: 'Paya Lebar Quarter (East)',
      eta: 'Delivered yesterday, 21:48', items: '318 cartons · 42 workstations', driver: 'Team Lead: Kelvin T.', plate: 'XE 2290 K / XE 2291 H', progress: 1,
      pod: { signedBy: 'P. Nair, Office Manager', photos: 6 },
      events: [
        { t: 'Yesterday 21:48', title: 'Delivered', note: 'Signed by P. Nair · 6 delivery photos', done: true },
        { t: 'Yesterday 19:30', title: 'Unloading at destination', note: 'Levels 7 and 8, service lift B', done: true },
        { t: 'Yesterday 18:15', title: 'In transit', note: 'Both vehicles departed together', done: true },
        { t: 'Yesterday 14:00', title: 'Packing complete', note: 'Labelled by floor and desk number', done: true },
        { t: '3 days ago', title: 'Site survey completed', note: 'Move plan shared with client', done: true }
      ]
    },
    'SL-240920': {
      status: 'scheduled', service: 'Corporate charter', vehicle: '40-seat coach', from: 'Marina Bay Sands Expo (Central)', to: 'Changi Business Park (East)',
      eta: 'Sat, 08:00 pickup', items: '36 passengers · 4 hours', driver: 'Assigned 24 h before trip', plate: 'To be confirmed', progress: 0.12,
      events: [
        { t: 'Mon 10:20', title: 'Booking confirmed', note: 'Deposit received, invoice sent', done: true },
        { t: 'Fri 08:00', title: 'Driver and vehicle assigned', note: 'Details sent by SMS and email', done: false },
        { t: 'Sat 07:45', title: 'Vehicle on standby', note: 'Arrives 15 minutes early', done: false },
        { t: 'Sat 08:00', title: 'Trip starts', note: '', done: false }
      ]
    }
  }
};
