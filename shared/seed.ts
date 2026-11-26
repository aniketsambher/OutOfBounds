import type { Campus, CampusId, Neighborhood, Place } from './types';

/*
 * Demo data for the hackathon build.
 * Coordinates are approximate and should be double-checked before a live demo.
 * Entries marked `placeholder: true` are generic "local picks" to swap for real businesses.
 */

export const campuses: Campus[] = [
  { id: 'neu', name: 'Northeastern', short: 'NEU', team: 'Huskies', color: '#B7412E', logo: '/logos/northeastern.png', center: [42.3398, -71.0892], radiusM: 600, emailDomain: 'northeastern.edu' },
  { id: 'bu', name: 'Boston University', short: 'BU', team: 'Terriers', color: '#6B3FA0', logo: '/logos/bu.png', center: [42.3505, -71.1054], radiusM: 900, emailDomain: 'bu.edu' },
  { id: 'emerson', name: 'Emerson', short: 'Emerson', team: 'Lions', color: '#2457A6', logo: '/logos/emerson.png', center: [42.3522, -71.0657], radiusM: 450, emailDomain: 'emerson.edu' },
  { id: 'suffolk', name: 'Suffolk', short: 'Suffolk', team: 'Rams', color: '#A15C12', logo: '/logos/suffolk.png', center: [42.359, -71.0614], radiusM: 450, emailDomain: 'suffolk.edu' },
  { id: 'berklee', name: 'Berklee', short: 'Berklee', team: 'Berklee', color: '#1F6F5C', logo: '/logos/berklee.png', center: [42.3467, -71.087], radiusM: 400, emailDomain: 'berklee.edu' },
  { id: 'mit', name: 'MIT', short: 'MIT', team: 'Engineers', color: '#4A5064', logo: '/logos/mit.png', center: [42.3601, -71.0942], radiusM: 800, emailDomain: 'mit.edu' },
];

export const neighborhoods: Neighborhood[] = [
  { id: 'north-end', name: 'North End', tagline: 'Pastry, Paul Revere & the harbor', ink: '#B7412E', tint: '#FBE7E2', stampWord: 'CANNOLI', icon: 'cannoli', tLine: 'Green/Orange · Haymarket', tLineColor: '#00843D', travel: '~20 min', center: [42.3647, -71.0542], phrase: { lang: 'it', text: 'Un cannolo, per favore.', meaning: 'One cannoli, please.' } },
  { id: 'chinatown', name: 'Chinatown', tagline: 'Dim sum, the Gate & the Greenway', ink: '#1F6F5C', tint: '#E3F0EA', stampWord: 'DIM SUM', icon: 'dumpling', tLine: 'Orange · Chinatown', tLineColor: '#C76E00', travel: '~15 min', center: [42.3515, -71.0605], phrase: { lang: 'zh', text: '我要点心。', meaning: "I'd like some dim sum." } },
  { id: 'allston', name: 'Allston', tagline: 'Korean BBQ, bakeries & Ringer Park', ink: '#6B3FA0', tint: '#F0E9F8', stampWord: 'K-BBQ', icon: 'grill', tLine: 'Green B · Harvard Ave', tLineColor: '#00843D', travel: '~30 min', center: [42.3525, -71.1315], phrase: { lang: 'ko', text: '이거 하나 주세요.', meaning: 'One of these, please.' } },
  { id: 'dorchester', name: 'Dorchester', tagline: 'Phở, the JFK Library & river parks', ink: '#A15C12', tint: '#FBF1E4', stampWord: 'PHỞ', icon: 'bowl', tLine: 'Red · Fields Corner', tLineColor: '#DA291C', travel: '~30 min', center: [42.3005, -71.0595], phrase: { lang: 'vi', text: 'Cho tôi một tô phở.', meaning: 'One bowl of phở, please.' } },
  { id: 'eastie', name: 'East Boston', tagline: 'Pizza, pupusas & harbor views', ink: '#2457A6', tint: '#E6EDF8', stampWord: 'PUPUSA', icon: 'pupusa', tLine: 'Blue · Maverick', tLineColor: '#003DA5', travel: '~35 min', center: [42.369, -71.038], phrase: { lang: 'es', text: 'Dos pupusas, por favor.', meaning: 'Two pupusas, please.' } },
  { id: 'jp', name: 'Jamaica Plain', tagline: 'The Arboretum, the Pond & Centre St', ink: '#4E7D2A', tint: '#EAF2E2', stampWord: 'POND', icon: 'tree', tLine: 'Orange · Green St', tLineColor: '#C76E00', travel: '~20 min', center: [42.3105, -71.1145] },
  { id: 'nubian', name: 'Nubian Square', tagline: 'Roxbury history & Caribbean eats', ink: '#8E3B5E', tint: '#F6E6EE', stampWord: 'NUBIAN', icon: 'landmark', tLine: 'Silver · Nubian', tLineColor: '#6B757C', travel: '~15 min', center: [42.329, -71.084] },
  { id: 'mattapan', name: 'Mattapan', tagline: 'Haitian bakeries & the Neponset', ink: '#3D6B8E', tint: '#E5EEF5', stampWord: 'TROLLEY', icon: 'bread', tLine: 'Mattapan trolley', tLineColor: '#DA291C', travel: '~45 min', center: [42.2685, -71.0925], phrase: { lang: 'ht', text: 'Mèsi anpil!', meaning: 'Thank you very much!' } },
];

export const places: Place[] = [
  // North End
  { id: 'ne-modern', name: 'Modern Pastry', type: 'bakery', neighborhoodId: 'north-end', pos: [42.3633, -71.0545], blurb: 'Family-run Hanover St bakery. Get the cannoli.', tags: ['Family-run'] },
  { id: 'ne-revere', name: 'Paul Revere House', type: 'landmark', neighborhoodId: 'north-end', pos: [42.3637, -71.0537], blurb: "Boston's oldest downtown house." },
  { id: 'ne-columbus', name: 'Christopher Columbus Park', type: 'park', neighborhoodId: 'north-end', pos: [42.3613, -71.0508], blurb: 'Waterfront park with a long wisteria trellis.' },
  // Chinatown
  { id: 'ct-gate', name: 'Chinatown Gate', type: 'landmark', neighborhoodId: 'chinatown', pos: [42.3512, -71.0607], blurb: 'The gate at the start of Beach St.' },
  { id: 'ct-dimsum', name: 'Dim sum on Beach St', type: 'eat', neighborhoodId: 'chinatown', pos: [42.3509, -71.0601], blurb: 'Local pick: any family-run dim sum spot.', placeholder: true, tags: ['Family-run'] },
  { id: 'ct-park', name: 'Chinatown Park', type: 'park', neighborhoodId: 'chinatown', pos: [42.3517, -71.0592], blurb: 'Greenway park inspired by Chinese gardens.' },
  // Allston
  { id: 'al-kbbq', name: 'Korean BBQ on Brighton Ave', type: 'eat', neighborhoodId: 'allston', pos: [42.3531, -71.1318], blurb: 'Local pick: a family-owned grill.', placeholder: true, tags: ['Family-run'] },
  { id: 'al-bakery', name: 'Harvard Ave bakery', type: 'bakery', neighborhoodId: 'allston', pos: [42.3519, -71.1309], blurb: 'Local pick: an independent bakery.', placeholder: true, tags: ['Independent'] },
  { id: 'al-ringer', name: 'Ringer Park', type: 'park', neighborhoodId: 'allston', pos: [42.3497, -71.1342], blurb: 'Hilly neighborhood park off Harvard Ave.' },
  // Dorchester
  { id: 'do-pho', name: 'Pho Hoa', type: 'eat', neighborhoodId: 'dorchester', pos: [42.3009, -71.0593], blurb: 'Long-running phở spot on Dot Ave.', tags: ['Family-run'] },
  { id: 'do-banhmi', name: 'Bánh mì from a family bakery', type: 'bakery', neighborhoodId: 'dorchester', pos: [42.2998, -71.0601], blurb: 'Local pick: any independent bakery on Dot Ave.', placeholder: true, tags: ['Independent'] },
  { id: 'do-jfk', name: 'JFK Presidential Library', type: 'landmark', neighborhoodId: 'dorchester', pos: [42.3163, -71.0343], blurb: 'Columbia Point, near JFK/UMass station.' },
  { id: 'do-jp2', name: 'Pope John Paul II Park', type: 'park', neighborhoodId: 'dorchester', pos: [42.2812, -71.0565], blurb: 'Walk the Neponset River trail.' },
  // East Boston
  { id: 'eb-santarpio', name: "Santarpio's Pizza", type: 'eat', neighborhoodId: 'eastie', pos: [42.3721, -71.0346], blurb: 'Old-school East Boston pizza and grill.', tags: ['Family-run'] },
  { id: 'eb-pupusa', name: 'Pupusas near Maverick Sq', type: 'eat', neighborhoodId: 'eastie', pos: [42.3693, -71.0398], blurb: 'Local pick: a family-run Salvadoran spot.', placeholder: true, tags: ['Family-run'] },
  { id: 'eb-piers', name: 'Piers Park', type: 'park', neighborhoodId: 'eastie', pos: [42.3641, -71.0331], blurb: 'Harbor-front park with skyline views.' },
  // Jamaica Plain
  { id: 'jp-arboretum', name: 'Arnold Arboretum', type: 'park', neighborhoodId: 'jp', pos: [42.299, -71.123], blurb: 'Olmsted-designed tree museum.' },
  { id: 'jp-pond', name: 'Jamaica Pond', type: 'park', neighborhoodId: 'jp', pos: [42.3166, -71.1201], blurb: 'Walk the loop around the pond.' },
  { id: 'jp-centre', name: 'Centre St café', type: 'eat', neighborhoodId: 'jp', pos: [42.311, -71.1142], blurb: 'Local pick: an independent café on Centre St.', placeholder: true, tags: ['Independent'] },
  // Nubian Square
  { id: 'nu-square', name: 'Nubian Square', type: 'landmark', neighborhoodId: 'nubian', pos: [42.3292, -71.0838], blurb: "Roxbury's historic center." },
  { id: 'nu-caribbean', name: 'Caribbean spot on Warren St', type: 'eat', neighborhoodId: 'nubian', pos: [42.3262, -71.0822], blurb: 'Local pick: a family-run Caribbean kitchen.', placeholder: true, tags: ['Family-run'] },
  { id: 'nu-malcolmx', name: 'Malcolm X Park', type: 'park', neighborhoodId: 'nubian', pos: [42.3198, -71.0893], blurb: 'Roxbury hilltop park.' },
  // Mattapan
  { id: 'ma-bakery', name: 'Haitian bakery on Blue Hill Ave', type: 'bakery', neighborhoodId: 'mattapan', pos: [42.2702, -71.0932], blurb: 'Local pick: a family-run Haitian bakery.', placeholder: true, tags: ['Family-run'] },
  { id: 'ma-square', name: 'Mattapan Square', type: 'landmark', neighborhoodId: 'mattapan', pos: [42.2676, -71.0921], blurb: 'End of the Mattapan trolley line.' },
  { id: 'ma-neponset', name: 'Neponset River Greenway', type: 'park', neighborhoodId: 'mattapan', pos: [42.269, -71.0878], blurb: 'Riverside trail by the trolley.' },
  // Campus-zone posts (count toward turf, not toward a passport neighborhood)
  { id: 'bu-citgo', name: 'Citgo sign', type: 'landmark', pos: [42.3489, -71.0952], blurb: 'Kenmore Square icon.' },
  { id: 'bu-marsh', name: 'Marsh Plaza', type: 'landmark', pos: [42.3504, -71.1061], blurb: "Heart of BU's campus." },
  { id: 'bu-beach', name: 'BU Beach', type: 'park', pos: [42.3517, -71.1047], blurb: 'The lawn by Storrow Drive.' },
  { id: 'bu-fenway', name: 'Fenway Park (Jersey St)', type: 'landmark', pos: [42.3467, -71.0972], blurb: 'Game-day post outside the ballpark.' },
  { id: 'neu-centennial', name: 'Centennial Common', type: 'park', pos: [42.3394, -71.088], blurb: "Northeastern's main quad." },
  { id: 'neu-mfa', name: 'Museum of Fine Arts', type: 'landmark', pos: [42.3394, -71.094], blurb: 'Huntington Ave art museum.' },
  { id: 'be-plaza', name: 'Christian Science Plaza', type: 'landmark', pos: [42.3445, -71.0853], blurb: 'The long reflecting pool.' },
  { id: 'be-massave', name: 'Mass Ave & Boylston', type: 'landmark', pos: [42.3475, -71.0878], blurb: "Berklee's busiest corner." },
  { id: 'em-common', name: 'Boston Common', type: 'park', pos: [42.355, -71.0656], blurb: "America's oldest public park." },
  { id: 'em-theater', name: 'Theater District', type: 'landmark', pos: [42.3513, -71.0645], blurb: 'Marquees along Tremont and Washington.' },
  { id: 'su-statehouse', name: 'Massachusetts State House', type: 'landmark', pos: [42.3588, -71.0638], blurb: 'The gold dome on Beacon Hill.' },
  { id: 'su-granary', name: 'Granary Burying Ground', type: 'landmark', pos: [42.3573, -71.0617], blurb: 'Freedom Trail stop on Tremont St.' },
  { id: 'mit-killian', name: 'Killian Court', type: 'landmark', pos: [42.3591, -71.0918], blurb: 'Under the Great Dome.' },
  { id: 'mit-kresge', name: 'Kresge Oval', type: 'park', pos: [42.3582, -71.0953], blurb: 'Open lawn in the middle of campus.' },
];

/**
 * Stamps other students have collected in each campus zone this week (sample data).
 * BU is tied 40–40 with Northeastern, so one more Northeastern check-in captures it.
 * Suffolk is tied with Emerson (contested).
 */
export const seedZoneCounts: Record<CampusId, Partial<Record<CampusId, number>>> = {
  bu: { bu: 40, neu: 40, emerson: 6 },
  neu: { neu: 52, berklee: 18, bu: 9 },
  berklee: { berklee: 31, neu: 24 },
  emerson: { emerson: 44, suffolk: 12 },
  suffolk: { suffolk: 27, emerson: 27 },
  mit: { mit: 38, bu: 5 },
};

/** Average neighborhoods stamped per student this semester (sample data). */
export const bubbleCupAverages: Record<CampusId, number> = {
  emerson: 4.1,
  neu: 3.6,
  suffolk: 3.4,
  bu: 3.2,
  berklee: 3.0,
  mit: 2.7,
};

/** Check-ins preloaded for the demo profile, so the passport isn't empty on stage. */
export const demoHistory: Array<[placeId: string, isoDate: string]> = [
  ['ne-modern', '2026-10-12T15:00:00'],
  ['ne-revere', '2026-10-12T16:10:00'],
  ['ct-gate', '2026-10-26T13:00:00'],
  ['ct-dimsum', '2026-10-26T13:40:00'],
  ['al-kbbq', '2026-11-02T18:30:00'],
  ['al-ringer', '2026-11-02T19:45:00'],
];

/** This week's featured neighborhood: check-ins there earn extra points (stacks with the 2× away bonus). */
export const weeklyChallenge = {
  neighborhoodId: 'chinatown',
  title: 'Chinatown Dumpling Dash',
  multiplier: 2,
};
