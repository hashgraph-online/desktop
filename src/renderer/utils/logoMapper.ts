import BonzoLogo from '../assets/images/logos/dao/Bonzo.png';
import BonzoDarkLogo from '../assets/images/logos/dao/Bonzo_Dark.png';
import BuidlerLabsLogo from '../assets/images/logos/dao/Buidler Labs.png';
import HGraphLogo from '../assets/images/logos/dao/HGRAPH.png';
import HGraphDarkLogo from '../assets/images/logos/dao/HGraph_Dark.png';
import HashgateLogo from '../assets/images/logos/dao/Hashgate.png';
import HashpackLogo from '../assets/images/logos/dao/Hashpack.png';
import KiloscribeLogo from '../assets/images/logos/dao/Kiloscribe.png';
import KiloscribeDarkLogo from '../assets/images/logos/dao/Kiloscribe_Dark.png';
import LaunchbadgeLogo from '../assets/images/logos/dao/Launchbadge.png';
import NeuronLogo from '../assets/images/logos/dao/Neuron.png';
import NeuronDarkLogo from '../assets/images/logos/dao/Neuron_Dark.png';
import SentXLogo from '../assets/images/logos/dao/SentX.png';
import SentXDarkLogo from '../assets/images/logos/dao/SentX_Dark.png';
import TurtlemoonLogo from '../assets/images/logos/dao/Turtlemoon.png';

export interface BookmarkLogo {
  light: string;
  dark: string;
}

export const LOGO_MAP: Record<string, BookmarkLogo> = {
  'kiloscribe': {
    light: KiloscribeLogo,
    dark: KiloscribeDarkLogo,
  },
  'saucerswap': {
    light: '',
    dark: '',
  },
  'bonzo': {
    light: BonzoLogo,
    dark: BonzoDarkLogo,
  },
  'hgraph': {
    light: HGraphLogo,
    dark: HGraphDarkLogo,
  },
  'sentx': {
    light: SentXLogo,
    dark: SentXDarkLogo,
  },
  'hashpack': {
    light: HashpackLogo,
    dark: HashpackLogo,
  },
  'hashgate': {
    light: HashgateLogo,
    dark: HashgateLogo,
  },
  'neuron': {
    light: NeuronLogo,
    dark: NeuronDarkLogo,
  },
  'launchbadge': {
    light: LaunchbadgeLogo,
    dark: LaunchbadgeLogo,
  },
  'turtlemoon': {
    light: TurtlemoonLogo,
    dark: TurtlemoonLogo,
  },
  'buidlerlabs': {
    light: BuidlerLabsLogo,
    dark: BuidlerLabsLogo,
  },
};

export const getLogoForUrl = (url: string): BookmarkLogo | null => {
  const domain = url.toLowerCase();

  if (domain.includes('kiloscribe')) return LOGO_MAP.kiloscribe;
  if (domain.includes('saucerswap')) return LOGO_MAP.saucerswap;
  if (domain.includes('bonzo')) return LOGO_MAP.bonzo;
  if (domain.includes('hgraph')) return LOGO_MAP.hgraph;
  if (domain.includes('sentx')) return LOGO_MAP.sentx;
  if (domain.includes('hashpack')) return LOGO_MAP.hashpack;
  if (domain.includes('hashgate')) return LOGO_MAP.hashgate;
  if (domain.includes('neuron')) return LOGO_MAP.neuron;
  if (domain.includes('launchbadge')) return LOGO_MAP.launchbadge;
  if (domain.includes('turtlemoon')) return LOGO_MAP.turtlemoon;
  if (domain.includes('buidlerlabs')) return LOGO_MAP.buidlerlabs;

  return null;
};