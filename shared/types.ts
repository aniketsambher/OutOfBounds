export type LatLng = [number, number];

export type CampusId = 'neu' | 'bu' | 'emerson' | 'suffolk' | 'berklee' | 'mit';

export type PlaceType = 'eat' | 'bakery' | 'landmark' | 'park';

export type IconName =
  | 'passport' | 'map' | 'trophy' | 'user' | 'lock' | 'arrowRight' | 'back' | 'close'
  | 'pin' | 'check' | 'plus' | 'flag' | 'compass' | 'share' | 'speaker' | 'shield'
  | 'search' | 'info' | 'bowl' | 'dumpling' | 'grill' | 'cannoli' | 'landmark'
  | 'tree' | 'bread' | 'pupusa';

export interface Campus {
  id: CampusId;
  name: string;
  short: string;
  /** Team / mascot name used in capture alerts ("Huskies captured BU"). */
  team: string;
  color: string;
  logo: string;
  center: LatLng;
  /** Radius of the campus's home turf zone, in meters. */
  radiusM: number;
  emailDomain: string;
}

export interface Neighborhood {
  id: string;
  name: string;
  tagline: string;
  /** Stamp ink color. */
  ink: string;
  tint: string;
  stampWord: string;
  icon: IconName;
  tLine: string;
  tLineColor: string;
  travel: string;
  center: LatLng;
  phrase?: { lang: string; text: string; meaning: string };
}

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  /** Missing for campus-zone posts that don't belong to a passport neighborhood. */
  neighborhoodId?: string;
  pos: LatLng;
  blurb: string;
  /** True for generic "local pick" entries that should be swapped for a real business. */
  placeholder?: boolean;
  tags?: string[];
}

export interface CheckIn {
  id: string;
  placeId: string;
  at: number;
  points: number;
  away: boolean;
  zoneId: CampusId | null;
  /** Mix bonus awarded when this check-in completed a neighborhood with food + a place. */
  bonus: number;
  completedNeighborhood?: string;
  /** Zones the player's campus captured because of this check-in. */
  captured?: CampusId[];
}

export interface GameAlert {
  id: string;
  title: string;
  body: string;
  logo?: string;
  at: number;
}
